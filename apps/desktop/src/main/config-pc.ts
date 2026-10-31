import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { IP_DO_HUB } from "@sabrehosting/nucleo/rede/wireguard";
import { lerSalvo, pastaPermitida } from "./boas-vindas.js";

/** Forma `host:porta` (mesma regra do `abrirJogo`); o que vem do disco ou da rede só vale se couber nela. */
export const ENDERECO_VALIDO = /^[A-Za-z0-9][A-Za-z0-9.-]*:\d{1,5}$/;

/**
 * Configuração deste PC (app-1.3c-i): vem do que o assistente gravou (`boas-vindas.json`) e do token no cofre real.
 * Nada daqui é lido de variável de ambiente, exceto Java/NeoForge, e só em modo teste (app não empacotado).
 */
export interface ConfigPc {
  /** `http://<IP do hub>:<porta>`: o cartório só é alcançável pela rede privada do grupo. */
  urlCartorio?: string;
  token?: string;
  /** O arquivo do cofre existe mas não decifra: o assistente deve pedir convite novo (não é "primeira vez"). */
  cofreCorrompido?: true;
  grupo?: string;
  /** Último endereço do Jogar que o cartório deu (o `GET /grupo` mais novo vale mais). */
  enderecoGravado?: string;
  pastaBase?: string;
  /** `<base>\servidor` */
  pastaServidor?: string;
  /** `<base>\servidor\<level-name>` (padrão `world`): o mundo fica direto dentro da pasta do servidor. */
  pastaMundo?: string;
  /** `<base>\mundos`: onde ficam os backups. */
  pastaBackups?: string;
  java?: string;
  neoforge?: string;
}

/** Só o `ler` do cofre; o token nunca é gravado por aqui. */
export interface LeitorDeToken {
  ler(): Promise<string | undefined>;
  estado?(): Promise<{ tipo: string }>;
}

/**
 * Nome da pasta do mundo: o `level-name` do `server.properties` (padrão `world`). O arquivo é entrada não confiável
 * (S-07): só vale nome simples de pasta (sem separador, `..`, letra de unidade ou caminho absoluto); o resto vira `world`.
 */
export async function nomeDoMundo(pastaServidor: string): Promise<string> {
  const props = await readFile(join(pastaServidor, "server.properties"), "utf8").catch(() => "");
  const nome = /^level-name=(.*)$/m.exec(props)?.[1]?.trim() ?? "";
  const simples = nome !== "" && nome !== "." && nome !== ".." && !/[\\/:\0]/.test(nome);
  return simples ? nome : "world";
}

/** `modoTeste`: só nele `SABRE_JAVA`/`SABRE_NEOFORGE` do ambiente viram executável do servidor (app empacotado ignora). */
export async function lerConfigPc(
  dados: string,
  cofre: LeitorDeToken,
  env: NodeJS.ProcessEnv,
  modoTeste = false,
): Promise<ConfigPc> {
  const salvo = lerSalvo(dados);
  const urlCartorio =
    salvo.grupo && salvo.portaCartorio ? `http://${IP_DO_HUB}:${salvo.portaCartorio}` : undefined;
  // Cofre que falha vale como "sem token": o app diz "ainda não entrou no grupo" (a mensagem do erro pode ter segredo).
  const token = urlCartorio ? await cofre.ler().catch(() => undefined) : undefined;
  const corrompido =
    urlCartorio && !token && cofre.estado
      ? (await cofre.estado().catch(() => undefined))?.tipo === "corrompido"
      : false;
  // O arquivo do disco é entrada não confiável (S-07): pasta torta ("..", relativa, raiz, Windows) vale como ausente.
  const pastaBase =
    salvo.concluido && pastaPermitida(salvo.pastaBase) ? salvo.pastaBase : undefined;
  const pastaServidor = pastaBase ? join(pastaBase, "servidor") : undefined;
  const mundo = pastaServidor ? await nomeDoMundo(pastaServidor) : "world";
  return {
    ...(urlCartorio ? { urlCartorio } : {}),
    ...(token ? { token } : {}),
    ...(corrompido ? { cofreCorrompido: true as const } : {}),
    ...(salvo.grupo ? { grupo: salvo.grupo.nome } : {}),
    ...(salvo.grupo?.endereco && ENDERECO_VALIDO.test(salvo.grupo.endereco)
      ? { enderecoGravado: salvo.grupo.endereco }
      : {}),
    ...(pastaBase && pastaServidor
      ? {
          pastaBase,
          pastaServidor,
          pastaMundo: join(pastaServidor, mundo),
          pastaBackups: join(pastaBase, "mundos"),
        }
      : {}),
    ...(modoTeste && env["SABRE_JAVA"] ? { java: env["SABRE_JAVA"] } : {}),
    ...(modoTeste && env["SABRE_NEOFORGE"] ? { neoforge: env["SABRE_NEOFORGE"] } : {}),
  };
}

/**
 * Ponte para os pedaços que ainda recebem as variáveis no formato `SABRE_*` (backups, atualizar mundo): o conteúdo vem
 * da configuração acima, nunca do `process.env`. Migrar esses pedaços para `ConfigPc` fica como melhoria.
 */
export function ambienteLegado(c: ConfigPc): NodeJS.ProcessEnv {
  const e: NodeJS.ProcessEnv = {};
  if (c.urlCartorio) e["SABRE_CARTORIO_URL"] = c.urlCartorio;
  if (c.token) e["SABRE_CARTORIO_TOKEN"] = c.token;
  if (c.pastaServidor) e["SABRE_PASTA_SERVIDOR"] = c.pastaServidor;
  if (c.pastaMundo) e["SABRE_PASTA_MUNDO"] = c.pastaMundo;
  if (c.pastaBackups) e["SABRE_PASTA_BACKUPS"] = c.pastaBackups;
  if (c.java) e["SABRE_JAVA"] = c.java;
  if (c.neoforge) e["SABRE_NEOFORGE"] = c.neoforge;
  return e;
}
