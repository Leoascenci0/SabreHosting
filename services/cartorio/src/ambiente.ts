import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { type AjudanteEntrada, CAMINHO_SOCKET, CHAVE_WG, criarAjudanteSocket } from "./ajudante.js";
import type { Grupo } from "./convite.js";

type Ambiente = Record<string, string | undefined>;

export const pastaDados = (env: Ambiente) =>
  env["SABRE_CARTORIO_DADOS"] || "/var/lib/sabre/cartorio";
export const caminhoBanco = (env: Ambiente) =>
  env["SABRE_CARTORIO_BANCO"] || join(pastaDados(env), "cartorio.db");
export const portaCartorio = (env: Ambiente) => Number(env["SABRE_CARTORIO_PORTA"] || 7710);

/** Só o ajudante de verdade: socket ausente = sem ajudante (o cartório recusa convite; nunca cai num falso). */
export function ajudanteDoAmbiente(env: Ambiente): AjudanteEntrada | undefined {
  const caminho = env["SABRE_AJUDANTE_SOCKET"] || CAMINHO_SOCKET;
  return existsSync(caminho) ? criarAjudanteSocket(caminho) : undefined;
}

/** Fonte única do endereço do hub: gravado pelo instalar.sh e lido também pelo ajudante. */
export const CAMINHO_HUB_ENV = "/etc/sabre/hub.env";

/** Dados do grupo para o convite; faltou ou veio torto = sem grupo (o cartório recusa convite).
 *  O endereço do hub vem do `hub.env`; `SABRE_HUB_ENDPOINT` só vale sem ele (teste, máquina sem instalador). */
export function grupoDoAmbiente(env: Ambiente, hubEnv = CAMINHO_HUB_ENV): Grupo | undefined {
  const nome = env["SABRE_GRUPO_NOME"]?.trim();
  const enderecoJogar = env["SABRE_GRUPO_ENDERECO_JOGAR"]?.trim();
  const doArquivo = existsSync(hubEnv)
    ? /^SABRE_ENDPOINT_HUB=(.*)$/m.exec(readFileSync(hubEnv, "utf8"))?.[1]
    : env["SABRE_HUB_ENDPOINT"];
  const hubEndpoint = doArquivo?.trim() ?? "";
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
