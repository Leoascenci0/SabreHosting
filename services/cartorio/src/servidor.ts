import { isIP } from "node:net";
import type { Writable } from "node:stream";
import Fastify, { type FastifyReply, type FastifyRequest } from "fastify";
import { type Banco, criarConvite, pcDoToken, usarConvite } from "./banco.js";
import { iguais } from "./segredo.js";

export interface OpcoesCartorio {
  banco: Banco;
  segredoAdmin: string;
  logger?: { level?: string; stream?: Writable };
  agora?: () => number;
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

/** O cartório só escuta na rede privada: recusa "todas as interfaces" e nome que não é IP. */
export function conferirEndereco(endereco: string): string {
  const versao = isIP(endereco);
  const todas = versao === 4 ? endereco === "0.0.0.0" : /^[0:]+$/.test(endereco);
  if (versao === 0 || todas) {
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

export function criarCartorio({ banco, segredoAdmin, logger, agora = Date.now }: OpcoesCartorio) {
  if (segredoAdmin.length < 32)
    throw new Error("Segredo de administrador ausente ou curto (mínimo 32 caracteres).");
  const app = Fastify({
    logger: { level: "info", ...logger, redact: { paths: REDACT, censor: "[oculto]" } },
  });
  app.addHook("onClose", () => banco.close());

  function soAdmin(req: FastifyRequest, resp: FastifyReply, pronto: () => void) {
    const segredo = bearer(req);
    if (segredo && iguais(segredo, segredoAdmin)) pronto();
    else void resp.code(401).send(NAO_AUTORIZADO);
  }

  app.get("/saude", () => ({ ok: true }));

  app.post<{ Body: { nomePc: string; validadeMinutos?: number } }>(
    "/convites",
    {
      preHandler: soAdmin,
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

  return app;
}
