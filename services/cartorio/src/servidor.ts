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
import { type AjudanteEntrada, CHAVE_WG, naSalaDeEntrada } from "./ajudante.js";
import {
  type Banco,
  type Pc,
  donoAtual,
  lerConvite,
  nomeOcupado,
  pcDoToken,
  usarConvite,
} from "./banco.js";
import {
  type Grupo,
  HORA_MS,
  NOME_PC,
  VALIDADE_MAXIMA_H,
  VALIDADE_PADRAO_H,
  confirmarEntrada,
  emitirConvite,
  entrarNoGrupo,
  limparProvisorios,
} from "./convite.js";
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
  logger?: { level?: string; stream?: Writable };
  agora?: () => number;
  trava?: Partial<TemposTrava>;
  /** Onde guardar a cópia do mundo (sem isto, as rotas do pacote não existem). */
  armazem?: { pasta: string; tetoBytes?: number };
  /** Quem mexe no WireGuard da nuvem. Sem ele (ou sem `grupo`), o cartório não cria convite (falha fechada). */
  ajudante?: AjudanteEntrada;
  grupo?: Grupo;
  /** De quanto em quanto tempo a limpeza tira os peers provisórios vencidos. Padrão: 60 s. */
  limpezaMs?: number;
}

/** Caminhos que o log apaga: cabeçalho de autorização e qualquer token ou convite. */
const REDACT = [
  "req.headers.authorization",
  "headers.authorization",
  "token",
  "convite",
  "*.token",
  "*.convite",
  "body.convite",
];
const NAO_AUTORIZADO = { erro: "Acesso negado. Peça um convite novo ao administrador do grupo." };
const SO_DONO = { erro: "Só o dono do grupo cria convites." };
const SEM_AJUDANTE = {
  erro: "O cartório não está pronto para criar convites (rede da nuvem não configurada). Avise o dono do grupo.",
};
const AJUDANTE_FALHOU = { erro: "A rede da nuvem não respondeu. Tente de novo em instantes." };
const NOME_EM_USO = {
  erro: "Já existe um PC ou um convite pendente com esse nome. Escolha outro.",
};
const SALA_DE_ENTRADA = { erro: "Termine a entrada no grupo pelo app antes de usar o cartório." };
const IP_ERRADO = { erro: "Confirme a entrada pela rede definitiva deste PC." };
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
const SO_OCTETO = {
  erro: "O pacote do mundo vai como application/octet-stream. Atualize o app e envie de novo.",
};
const SEM_COPIA = { erro: "A nuvem não tem essa versão do mundo guardada." };
const VERSAO_INEXISTENTE = { erro: "Essa versão do mundo não existe no cartório." };
/** Inteiro exato em JS (≤ 2^53 − 1): número maior viraria decimal e ficaria gravado para sempre em `versoes`. */
const EPOCA = { type: "integer", minimum: 1, maximum: Number.MAX_SAFE_INTEGER };
const TOTAL = { type: "integer", minimum: 0, maximum: Number.MAX_SAFE_INTEGER };

const MUITAS_TENTATIVAS = {
  erro: "Muitas tentativas erradas deste PC. Espere 15 minutos e tente de novo.",
};
/** Limite de tentativas erradas (convite ou token) por IP: 20 em 15 min, contadas do primeiro erro. */
const MAX_FALHAS = 20;
const JANELA_FALHAS_MS = 15 * 60_000;

/** Onde o cartório pode escutar: loopback e faixas privadas (CGNAT 100.64/10 fica fora). */
const PERMITIDOS = new BlockList();
PERMITIDOS.addSubnet("127.0.0.0", 8, "ipv4");
PERMITIDOS.addSubnet("10.0.0.0", 8, "ipv4");
PERMITIDOS.addSubnet("172.16.0.0", 12, "ipv4");
PERMITIDOS.addSubnet("192.168.0.0", 16, "ipv4");
PERMITIDOS.addAddress("::1", "ipv6");
PERMITIDOS.addSubnet("fc00::", 7, "ipv6");
/** O BlockList casa IPv4 mapeado em IPv6 (::ffff:10.0.0.1) com a regra IPv4; essa grafia fica fora. */
const IPV4_MAPEADO = new BlockList();
IPV4_MAPEADO.addSubnet("::ffff:0:0", 96, "ipv6");

/** O cartório só escuta na rede privada: recusa IP público, "todas as interfaces" e nome que não é IP. */
export function conferirEndereco(endereco: string): string {
  const versao = isIP(endereco);
  const tipo = versao === 4 ? "ipv4" : "ipv6";
  if (
    versao === 0 ||
    (versao === 6 && IPV4_MAPEADO.check(endereco, "ipv6")) ||
    !PERMITIDOS.check(endereco, tipo)
  ) {
    throw new Error(
      `Endereço "${endereco}" recusado: use o IP do cartório na rede privada (ex.: 10.8.0.1).`,
    );
  }
  return endereco;
}

/**
 * Tentativas erradas por IP. `req.ip` é o endereço da conexão (`trustProxy` desligado de propósito): cada PC tem IP
 * próprio no WireGuard; um proxy na frente do cartório exigiria configurar isso.
 */
export function criarLimitador(agora: () => number) {
  const falhas = new Map<string, { falhas: number; inicio: number }>();
  return {
    barrado(ip: string): boolean {
      const f = falhas.get(ip);
      return f !== undefined && f.falhas >= MAX_FALHAS && agora() - f.inicio < JANELA_FALHAS_MS;
    },
    contarFalha(ip: string) {
      const t = agora();
      // Tira as vencidas (de qualquer IP) para o Map não crescer sem fim.
      for (const [chave, f] of falhas) if (t - f.inicio >= JANELA_FALHAS_MS) falhas.delete(chave);
      const f = falhas.get(ip);
      if (f) f.falhas++;
      else falhas.set(ip, { falhas: 1, inicio: t });
    },
    tamanho: () => falhas.size,
  };
}

function bearer(req: FastifyRequest): string | undefined {
  const [tipo, valor] = (req.headers.authorization ?? "").split(" ");
  return tipo === "Bearer" && valor ? valor : undefined;
}

export function criarCartorio({
  banco,
  logger,
  agora = Date.now,
  trava,
  armazem: opcoesArmazem,
  ajudante,
  grupo,
  limpezaMs = 60_000,
}: OpcoesCartorio) {
  const { prazoMs, renovarMs } = conferirTempos(trava);
  const app = Fastify({
    // JSON pequeno; o PUT do pacote tem o próprio teto (o do armazém).
    bodyLimit: 4096,
    logger: { level: "info", ...logger, redact: { paths: REDACT, censor: "[oculto]" } },
  });
  app.addHook("onClose", () => banco.close());
  // A sala de entrada (IP provisório) só alcança o `usar`; o resto espera o PC estar na rede definitiva.
  app.addHook("onRequest", (req, resp, pronto) => {
    if (naSalaDeEntrada(req.ip) && req.url.split("?")[0] !== "/convites/usar")
      return void resp.code(403).send(SALA_DE_ENTRADA);
    pronto();
  });
  if (ajudante) {
    let limpando = false;
    const relogio = setInterval(() => {
      if (limpando) return;
      limpando = true;
      limparProvisorios(banco, ajudante, agora())
        .then(({ falhas }) => {
          if (falhas) app.log.warn({ falhas }, "peer provisório não removido; tento de novo");
        })
        .catch((err: unknown) => app.log.error({ err }, "limpeza dos provisórios falhou"))
        .finally(() => (limpando = false));
    }, limpezaMs);
    relogio.unref();
    app.addHook("onClose", () => clearInterval(relogio));
  }

  const { barrado, contarFalha } = criarLimitador(agora);
  /** Confere o limite antes de olhar convite, token ou segredo. */
  function limiteFalhas(req: FastifyRequest, resp: FastifyReply, pronto: () => void) {
    if (barrado(req.ip)) void resp.code(429).send(MUITAS_TENTATIVAS);
    else pronto();
  }
  const pcDaChamada = new WeakMap<FastifyRequest, Pc>();
  function soPc(req: FastifyRequest, resp: FastifyReply, pronto: () => void) {
    if (barrado(req.ip)) return void resp.code(429).send(MUITAS_TENTATIVAS);
    const token = bearer(req);
    const pc = token ? pcDoToken(banco, token) : undefined;
    if (!pc) {
      contarFalha(req.ip);
      return void resp.code(401).send(NAO_AUTORIZADO);
    }
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

  app.get("/grupo", { onRequest: soPc }, (_req, resp) =>
    grupo
      ? { nome: grupo.nome, endereco_jogar: grupo.enderecoJogar }
      : resp.code(503).send(SEM_AJUDANTE),
  );

  app.post<{ Body: { nomePc: string; validadeHoras?: number } }>(
    "/convites",
    {
      onRequest: soPc,
      schema: {
        body: {
          type: "object",
          required: ["nomePc"],
          properties: {
            nomePc: { type: "string", pattern: NOME_PC },
            validadeHoras: {
              type: "integer",
              minimum: 1,
              maximum: VALIDADE_MAXIMA_H,
              default: VALIDADE_PADRAO_H,
            },
          },
        },
      },
    },
    async (req, resp) => {
      if (donoAtual(banco)?.id !== pcDe(req).id) return resp.code(403).send(SO_DONO);
      if (!ajudante || !grupo) return resp.code(503).send(SEM_AJUDANTE);
      const { nomePc, validadeHoras = VALIDADE_PADRAO_H } = req.body;
      if (nomeOcupado(banco, nomePc, agora())) return resp.code(409).send(NOME_EM_USO);
      try {
        const r = await emitirConvite(
          banco,
          ajudante,
          grupo,
          { nomePc, validadeMs: validadeHoras * HORA_MS },
          agora(),
        );
        return await resp.code(201).send(r);
      } catch (err) {
        req.log.error({ err }, "convite não criado");
        return resp.code(503).send(AJUDANTE_FALHOU);
      }
    },
  );

  app.post<{ Body: { convite: string; chave_publica?: string } }>(
    "/convites/usar",
    {
      onRequest: limiteFalhas,
      schema: {
        body: {
          type: "object",
          required: ["convite"],
          properties: {
            convite: { type: "string", minLength: 1, maxLength: 100 },
            chave_publica: { type: "string", pattern: CHAVE_WG.source },
          },
        },
      },
    },
    async (req, resp) => {
      const { convite, chave_publica } = req.body;
      // Convite antigo (sem sala de entrada, de antes do cart-1.5): o PC já estava na rede; segue como era.
      if (lerConvite(banco, convite)?.ip_prov === null) {
        const token = usarConvite(banco, convite, agora());
        if (token) return { token };
      } else if (chave_publica && ajudante) {
        const r = await entrarNoGrupo(
          banco,
          ajudante,
          { convite, chavePub: chave_publica, ip: req.ip },
          agora(),
        );
        if (r.ok) return { token: r.token, pacote: r.pacote };
        if (r.motivo === "ajudante") return resp.code(503).send(AJUDANTE_FALHOU);
      }
      contarFalha(req.ip);
      return resp.code(401).send(CONVITE_INVALIDO);
    },
  );

  app.post("/convites/confirmar", { onRequest: soPc }, async (req, resp) => {
    if (!ajudante) return resp.code(503).send(SEM_AJUDANTE);
    try {
      const r = await confirmarEntrada(banco, ajudante, pcDe(req).id, req.ip, agora());
      return r === "ok" ? resp.code(204).send() : resp.code(403).send(IP_ERRADO);
    } catch (err) {
      req.log.error({ err }, "peer provisório não removido na confirmação");
      return resp.code(503).send(AJUDANTE_FALHOU);
    }
  });

  app.get("/eu", { onRequest: soPc }, (req) => pcDe(req));

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
    // O teto grande só vale para o leitor em fluxo: outro tipo é recusado antes de qualquer leitor ler o corpo.
    function soOcteto(req: FastifyRequest, resp: FastifyReply, pronto: () => void) {
      const tipo = (req.headers["content-type"] ?? "").split(";")[0]?.trim().toLowerCase();
      if (tipo === "application/octet-stream") pronto();
      else void resp.code(415).send(SO_OCTETO);
    }
    app.put<{ Params: { n: number }; Querystring: Declarado & { epoca: number }; Body: Readable }>(
      "/versoes/:n/pacote",
      {
        onRequest: [soPc, soOcteto],
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
        let fd: number;
        try {
          fd = openSync(copia.caminho, "r");
        } catch (erro) {
          req.log.error({ err: erro, versao: req.params.n }, "cópia registrada sem arquivo");
          return resp.code(404).send(SEM_COPIA);
        }
        const fluxo = createReadStream("", { fd });
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
