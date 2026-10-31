import { createReadStream, openSync } from "node:fs";
import { BlockList, isIP } from "node:net";
import type { Readable, Writable } from "node:stream";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import {
  type Declarado,
  type MotivoPacote,
  criarArmazem,
  pacoteGuardado,
  receberPacote,
} from "./armazem.js";
import { type Banco, type Pc, criarConvite, pcDoToken, usarConvite } from "./banco.js";
import { iguais } from "./segredo.js";
import {
  type MotivoRecusa,
  type ResultadoTrava,
  type TemposTrava,
  conferirTempos,
  estadoTrava,
  passar,
  pegar,
  renovar,
  soltar,
} from "./trava.js";
import { type DadosVersao, informarCopia, maisNova, quemTem, registrarVersao } from "./versoes.js";

export interface OpcoesCartorio {
  banco: Banco;
  segredoAdmin: string;
  logger?: { level?: string; stream?: Writable };
  agora?: () => number;
  trava?: Partial<TemposTrava>;
  /** Onde guardar a cópia do mundo (sem isto, as rotas do pacote não existem). */
  armazem?: { pasta: string; tetoBytes?: number };
}

/** Caminhos que o log apaga: cabeçalho de autorização e qualquer token ou convite. */
const REDACT = [
  "req.headers.authorization",
  "headers.authorization",
  "token",
  "convite",
  "*.token",
  "*.convite",
];
const NAO_AUTORIZADO = { erro: "Acesso negado. Peça um convite novo ao administrador do grupo." };
const CONVITE_INVALIDO = {
  erro: "Convite inválido, já usado ou vencido. Peça um novo ao administrador.",
};
const RECUSA_TRAVA: Record<MotivoRecusa, (dono: string) => string> = {
  ocupada: (dono) => `O servidor já está no ${dono}. Entre por lá como jogador ou espere ele sair.`,
  epoca_velha: () => "Outro PC assumiu o servidor. Pare o servidor deste PC e entre como jogador.",
  nao_e_dono: () => "Este PC não está hospedando agora.",
  vencida: () =>
    "Este PC ficou tempo demais sem avisar o cartório e perdeu a vez. Pare o servidor.",
  destino_desconhecido: () =>
    "O PC para onde o servidor iria não faz parte do grupo ou perdeu o acesso.",
  destino_invalido: () => "O servidor já está neste PC. Escolha outro PC para receber.",
};
const RECUSA_PACOTE: Record<MotivoPacote, { status: number; erro: string }> = {
  nao_e_a_mais_nova: {
    status: 409,
    erro: "Essa não é a versão mais nova do mundo. Atualize antes de enviar.",
  },
  nao_registrou: { status: 409, erro: "Essa versão do mundo foi registrada por outro PC." },
  ja_guardada: { status: 409, erro: "A nuvem já tem essa versão do mundo guardada." },
  grande_demais: { status: 413, erro: "O mundo passou do tamanho máximo que a nuvem guarda." },
  tamanho_errado: { status: 422, erro: "O pacote chegou com tamanho diferente. Envie de novo." },
  hash_errado: { status: 422, erro: "O pacote chegou diferente do enviado. Envie de novo." },
  interrompido: { status: 400, erro: "O envio do mundo foi interrompido. Envie de novo." },
};
const SEM_COPIA = { erro: "A nuvem não tem essa versão do mundo guardada." };
const VERSAO_INEXISTENTE = { erro: "Essa versão do mundo não existe no cartório." };
/** Inteiro exato em JS (≤ 2^53 − 1): número maior viraria decimal e ficaria gravado para sempre em `versoes`. */
const EPOCA = { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
const TOTAL = { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER };

/** Endereços que significam "todas as interfaces", em qualquer grafia (inclusive ::ffff:0.0.0.0). */
const TODAS_AS_INTERFACES = new BlockList();
TODAS_AS_INTERFACES.addAddress("0.0.0.0", "ipv4");
TODAS_AS_INTERFACES.addAddress("::", "ipv6");

/** O cartório só escuta na rede privada: recusa "todas as interfaces" e nome que não é IP. */
export function conferirEndereco(endereco: string): string {
  const versao = isIP(endereco);
  if (versao === 0 || TODAS_AS_INTERFACES.check(endereco, versao === 4 ? "ipv4" : "ipv6")) {
    throw new Error(
      `Endereço "${endereco}" recusado: use o IP do cartório na rede privada (ex.: 10.8.0.1).`,
    );
  }
  return endereco;
}

function bearer(req: FastifyRequest): string | undefined {
  const [tipo, valor] = (req.headers.authorization ?? "").split(" ");
  return tipo === "Bearer" && valor ? valor : undefined;
}

export function criarCartorio({
  banco,
  segredoAdmin,
  logger,
  agora = Date.now,
  trava,
  armazem: opcoesArmazem,
}: OpcoesCartorio) {
  if (segredoAdmin.length < 32)
    throw new Error("Segredo de administrador ausente ou curto (mínimo 32 caracteres).");
  const { prazoMs, renovarMs } = conferirTempos(trava);
  const app = Fastify({
    logger: { level: "info", ...logger, redact: { paths: REDACT, censor: "[oculto]" } },
  });
  app.addHook("onClose", () => banco.close());

  function soAdmin(req: FastifyRequest, resp: FastifyReply, pronto: () => void) {
    const segredo = bearer(req);
    if (segredo && iguais(segredo, segredoAdmin)) pronto();
    else void resp.code(401).send(NAO_AUTORIZADO);
  }

  const pcDaChamada = new WeakMap<FastifyRequest, Pc>();
  function soPc(req: FastifyRequest, resp: FastifyReply, pronto: () => void) {
    const token = bearer(req);
    const pc = token ? pcDoToken(banco, token) : undefined;
    if (!pc) return void resp.code(401).send(NAO_AUTORIZADO);
    pcDaChamada.set(req, pc);
    pronto();
  }
  function pcDe(req: FastifyRequest): Pc {
    const pc = pcDaChamada.get(req);
    if (!pc) throw new Error("Rota de PC sem o soPc.");
    return pc;
  }
  function pcPorId(id: number | null): Pc | null {
    if (id === null) return null;
    return (
      (banco.prepare("SELECT id, nome FROM pcs WHERE id = ?").get(id) as Pc | undefined) ?? null
    );
  }
  function recusar(resp: FastifyReply, r: Extract<ResultadoTrava, { ok: false }>) {
    const erro = RECUSA_TRAVA[r.motivo](pcPorId(r.donoPcId)?.nome ?? "outro PC");
    return resp.code(409).send({ erro, ...r });
  }
  function responderTrava(resp: FastifyReply, r: ResultadoTrava) {
    return r.ok ? { ...r, renovarMs } : recusar(resp, r);
  }
  const corpoTrava = (...campos: string[]) => ({
    onRequest: soPc,
    schema: {
      body: {
        type: "object",
        required: campos,
        properties: Object.fromEntries(campos.map((c) => [c, EPOCA])),
      },
    },
  });

  app.get("/saude", () => ({ ok: true }));

  app.post<{ Body: { nomePc: string; validadeMinutos?: number } }>(
    "/convites",
    {
      onRequest: soAdmin,
      schema: {
        body: {
          type: "object",
          required: ["nomePc"],
          properties: {
            nomePc: { type: "string", minLength: 1, maxLength: 60 },
            validadeMinutos: { type: "integer", minimum: 1, maximum: 1440, default: 30 },
          },
        },
      },
    },
    (req, resp) => {
      const { nomePc, validadeMinutos = 30 } = req.body;
      const convite = criarConvite(banco, nomePc, agora(), validadeMinutos * 60_000);
      return resp.code(201).send({ convite });
    },
  );

  app.post<{ Body: { convite: string } }>(
    "/convites/usar",
    {
      schema: {
        body: {
          type: "object",
          required: ["convite"],
          properties: { convite: { type: "string", minLength: 1, maxLength: 100 } },
        },
      },
    },
    (req, resp) => {
      const token = usarConvite(banco, req.body.convite, agora());
      if (!token) return resp.code(401).send(CONVITE_INVALIDO);
      return { token };
    },
  );

  app.get("/eu", (req, resp) => {
    const token = bearer(req);
    const pc = token ? pcDoToken(banco, token) : undefined;
    if (!pc) return resp.code(401).send(NAO_AUTORIZADO);
    return pc;
  });

  app.get("/trava", { onRequest: soPc }, () => {
    const { donoPcId, epoca, expiraEm } = estadoTrava(banco, agora());
    return { dono: pcPorId(donoPcId), epoca, expiraEm, prazoMs, renovarMs };
  });
  app.post("/trava/pegar", { onRequest: soPc }, (req, resp) =>
    responderTrava(resp, pegar(banco, pcDe(req).id, agora(), prazoMs)),
  );
  app.post<{ Body: { epoca: number } }>("/trava/renovar", corpoTrava("epoca"), (req, resp) =>
    responderTrava(resp, renovar(banco, pcDe(req).id, req.body.epoca, agora(), prazoMs)),
  );
  app.post<{ Body: { epoca: number; para: number } }>(
    "/trava/passar",
    corpoTrava("epoca", "para"),
    (req, resp) =>
      responderTrava(
        resp,
        passar(banco, pcDe(req).id, req.body.para, req.body.epoca, agora(), prazoMs),
      ),
  );
  app.post<{ Body: { epoca: number } }>("/trava/soltar", corpoTrava("epoca"), (req, resp) =>
    responderTrava(resp, soltar(banco, pcDe(req).id, req.body.epoca)),
  );

  app.post<{ Body: DadosVersao & { epoca: number } }>(
    "/versoes",
    {
      onRequest: soPc,
      schema: {
        body: {
          type: "object",
          required: ["epoca", "manifestoSha256", "arquivos", "bytes"],
          properties: {
            epoca: EPOCA,
            manifestoSha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
            arquivos: TOTAL,
            bytes: TOTAL,
          },
        },
      },
    },
    (req, resp) => {
      const { epoca, ...dados } = req.body;
      const r = registrarVersao(banco, pcDe(req).id, epoca, agora(), dados);
      return r.ok ? resp.code(201).send({ numero: r.numero }) : recusar(resp, r);
    },
  );
  app.get("/versoes/mais-nova", { onRequest: soPc }, () => ({ versao: maisNova(banco) }));
  app.post<{ Body: { versao: number } }>(
    "/copias",
    {
      onRequest: soPc,
      schema: {
        body: { type: "object", required: ["versao"], properties: { versao: EPOCA } },
      },
    },
    (req, resp) =>
      informarCopia(banco, pcDe(req).id, req.body.versao, agora())
        ? resp.code(204).send()
        : resp.code(404).send(VERSAO_INEXISTENTE),
  );
  app.get<{ Params: { n: number } }>(
    "/versoes/:n/copias",
    {
      onRequest: soPc,
      schema: { params: { type: "object", required: ["n"], properties: { n: EPOCA } } },
    },
    (req) => ({ numero: req.params.n, pcs: quemTem(banco, req.params.n) }),
  );

  if (opcoesArmazem) {
    const armazem = criarArmazem({ banco, agora, ...opcoesArmazem });
    const paramN = { type: "object", required: ["n"], properties: { n: EPOCA } };
    // O corpo do PUT chega como fluxo, direto para o disco (nunca o mundo inteiro na memória).
    app.addContentTypeParser("application/octet-stream", (_req, corpo, pronto) =>
      pronto(null, corpo),
    );
    app.put<{ Params: { n: number }; Querystring: Declarado & { epoca: number }; Body: Readable }>(
      "/versoes/:n/pacote",
      {
        onRequest: soPc,
        bodyLimit: armazem.tetoBytes,
        schema: {
          params: paramN,
          querystring: {
            type: "object",
            required: ["epoca", "sha256", "bytes"],
            properties: {
              epoca: EPOCA,
              sha256: { type: "string", pattern: "^[0-9a-f]{64}$" },
              bytes: TOTAL,
            },
          },
        },
      },
      async (req, resp) => {
        const { epoca, sha256, bytes } = req.query;
        const r = await receberPacote(armazem, req.params.n, pcDe(req).id, epoca, req.body, {
          sha256,
          bytes,
        });
        if (r.ok)
          return resp.code(201).send({ versao: r.versao, sha256: r.sha256, bytes: r.bytes });
        if ("donoPcId" in r) return recusar(resp, r);
        const { status, erro } = RECUSA_PACOTE[r.motivo];
        return resp.code(status).send({ erro, motivo: r.motivo });
      },
    );
    app.get<{ Params: { n: number } }>(
      "/versoes/:n/pacote",
      { onRequest: soPc, schema: { params: paramN } },
      (req, resp) => {
        const copia = pacoteGuardado(armazem, req.params.n);
        if (!copia) return resp.code(404).send(SEM_COPIA);
        // Aberto na mesma volta em que a linha foi lida: a rotação não apaga o arquivo no meio do download.
        const fluxo = createReadStream("", { fd: openSync(copia.caminho, "r") });
        return resp
          .header("content-type", "application/octet-stream")
          .header("content-length", copia.bytes)
          .header("x-sabre-sha256", copia.sha256)
          .send(fluxo);
      },
    );
  }

  return app;
}
