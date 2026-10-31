import { existsSync } from "node:fs";
import { join } from "node:path";
import { type AjudanteEntrada, CAMINHO_AJUDANTE, CHAVE_WG, criarAjudanteSudo } from "./ajudante.js";
import type { Grupo } from "./convite.js";

type Ambiente = Record<string, string | undefined>;

export const pastaDados = (env: Ambiente) =>
  env["SABRE_CARTORIO_DADOS"] || "/var/lib/sabre/cartorio";
export const caminhoBanco = (env: Ambiente) =>
  env["SABRE_CARTORIO_BANCO"] || join(pastaDados(env), "cartorio.db");
export const portaCartorio = (env: Ambiente) => Number(env["SABRE_CARTORIO_PORTA"] || 7710);

/** Só o ajudante de verdade: arquivo ausente = sem ajudante (o cartório recusa convite; nunca cai num falso). */
export function ajudanteDoAmbiente(env: Ambiente): AjudanteEntrada | undefined {
  const caminho = env["SABRE_AJUDANTE_ENTRADA"] || CAMINHO_AJUDANTE;
  return existsSync(caminho) ? criarAjudanteSudo(undefined, caminho) : undefined;
}

/** Dados do grupo para o convite; faltou ou veio torto = sem grupo (o cartório recusa convite). */
export function grupoDoAmbiente(env: Ambiente): Grupo | undefined {
  const nome = env["SABRE_GRUPO_NOME"]?.trim();
  const enderecoJogar = env["SABRE_GRUPO_ENDERECO_JOGAR"]?.trim();
  const hubEndpoint = env["SABRE_HUB_ENDPOINT"]?.trim() ?? "";
  const hubChavePub = env["SABRE_HUB_CHAVE_PUB"]?.trim() ?? "";
  if (
    !nome ||
    nome.length > 40 ||
    !enderecoJogar ||
    !/^[A-Za-z0-9.-]+:\d{1,5}$/.test(hubEndpoint) ||
    !CHAVE_WG.test(hubChavePub)
  )
    return undefined;
  return { nome, enderecoJogar, hubEndpoint, hubChavePub, portaCartorio: portaCartorio(env) };
}
