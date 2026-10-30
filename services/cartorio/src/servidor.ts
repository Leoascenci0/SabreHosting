import { BlockList, isIP } from "node:net";
import type { Writable } from "node:stream";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
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

export interface OpcoesCartorio {
  banco: Banco;
  segredoAdmin: string;
  logger?: { level?: string; stream?: Writable };
  agora?: () => number;
  trava?: Partial<TemposTrava>;
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
const EPOCA = { type: "integer", minimum: 1 };

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
  function responderTrava(resp: FastifyReply, r: ResultadoTrava) {
    if (r.ok) return { ...r, renovarMs };
    const erro = RECUSA_TRAVA[r.motivo](pcPorId(r.donoPcId)?.nome ?? "outro PC");
    return resp.code(409).send({ erro, ...r });
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

  return app;
}
