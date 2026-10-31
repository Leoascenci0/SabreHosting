import type { SpawnOptions, ChildProcess } from "node:child_process";
import { readdir, readFile, readlink, realpath, stat } from "node:fs/promises";
import { join } from "node:path";
import { criarCliente } from "@sabrehosting/nucleo/cartorio/cliente";
import { hospedar } from "@sabrehosting/nucleo/cartorio/hospedar";
import { erroSemGrupo, type DepsInicio } from "./inicio.js";

/** Ganchos só dos testes: rede e processo falsos no lugar dos reais. */
export interface ExtrasDepsReais {
  fetchFn?: typeof fetch;
  spawnFn?: (cmd: string, args: readonly string[], opcoes: SpawnOptions) => ChildProcess;
  prefixoArgs?: string[];
  plataforma?: NodeJS.Platform;
  /** Pasta no lugar de `/proc` (Linux). */
  raizProc?: string;
}

/**
 * Há servidor vivo na pasta (sobra de app fechado à força com o Java no ar)? Lado seguro: `true` também quando não
 * dá para saber, e quem chama trata erro como `true`.
 */
async function servidorNaPasta(
  pasta: string,
  plataforma: NodeJS.Platform,
  raizProc = "/proc",
): Promise<boolean> {
  if (plataforma === "linux") {
    const alvo = await realpath(pasta);
    const ausente = (e: unknown) => (e as NodeJS.ErrnoException).code === "ENOENT";
    for (const pid of await readdir(raizProc)) {
      if (!/^\d+$/.test(pid) || Number(pid) === process.pid) continue;
      try {
        // Processo de outro usuário não é o Java deste app (que roda como o próprio usuário).
        if ((await stat(join(raizProc, pid))).uid !== process.getuid?.()) continue;
        if ((await readlink(join(raizProc, pid, "cwd"))) === alvo) return true;
      } catch (e) {
        if (!ausente(e)) return true; // processo que não deixa conferir: talvez seja o órfão
      }
    }
    return false;
  }
  if (plataforma === "win32") {
    // O Java prende o session.lock do mundo com trava obrigatória do Windows: ler falha enquanto ele vive.
    const props = await readFile(join(pasta, "server.properties"), "utf8").catch(() => "");
    const mundo = /^level-name=(.*)$/m.exec(props)?.[1]?.trim() || "world";
    try {
      await readFile(join(pasta, mundo, "session.lock"));
      return false;
    } catch (e) {
      return (e as NodeJS.ErrnoException).code !== "ENOENT";
    }
  }
  return true;
}

/** O cliente do cartório feito do ambiente; `exigir()` lança o erro de "sem grupo" quando falta ou é inválido. */
export function clienteDoAmbiente(
  env: NodeJS.ProcessEnv,
  fetchFn?: typeof fetch,
): () => ReturnType<typeof criarCliente> {
  const { SABRE_CARTORIO_URL: url, SABRE_CARTORIO_TOKEN: token } = env;
  let cliente: ReturnType<typeof criarCliente> | undefined;
  let falha: unknown;
  if (url && token) {
    try {
      cliente = criarCliente({
        url,
        cofre: { guardar: async () => {}, ler: async () => token },
        ...(fetchFn ? { fetchFn } : {}),
      });
    } catch (e) {
      falha = e;
    }
  }
  return () => {
    if (cliente) return cliente;
    throw falha ?? erroSemGrupo();
  };
}

// Cartório, endereço e pasta do servidor vêm do ambiente até a tela de primeira vez (app-1.3); ver .env.exemplo.
export function depsReais(
  env: NodeJS.ProcessEnv,
  copiar: (texto: string) => void,
  extras: ExtrasDepsReais = {},
): DepsInicio {
  const { SABRE_PASTA_SERVIDOR: pasta, SABRE_JAVA: java, SABRE_NEOFORGE: neoforge } = env;
  const exigir = clienteDoAmbiente(env, extras.fetchFn);
  return {
    lerTrava: async () => exigir().estadoTrava(),
    // Único caminho que sobe o servidor: pega a trava antes e devolve depois (regra de ouro 1).
    hospedar: async (aoPerder) => {
      if (!pasta || !java || !neoforge) {
        throw new Error("Este PC ainda não está configurado para hospedar o servidor.");
      }
      return hospedar({
        cliente: exigir(),
        aoPerder,
        pasta,
        javaPath: java,
        versaoNeoForge: neoforge,
        ...(extras.spawnFn ? { spawnFn: extras.spawnFn } : {}),
        ...(extras.prefixoArgs ? { prefixoArgs: extras.prefixoArgs } : {}),
        ...(extras.plataforma ? { plataforma: extras.plataforma } : {}),
      });
    },
    eu: async () => exigir().eu(),
    // Sem pasta não dá para conferir: na dúvida, não oferece Hospedar (que também recusaria sem configuração).
    servidorOrfao: async () =>
      pasta ? servidorNaPasta(pasta, extras.plataforma ?? process.platform, extras.raizProc) : true,
    endereco: env["SABRE_ENDERECO"] ?? "",
    copiar,
  };
}
