import type { SpawnOptions, ChildProcess } from "node:child_process";
import { criarCliente } from "@sabrehosting/nucleo/cartorio/cliente";
import { hospedar } from "@sabrehosting/nucleo/cartorio/hospedar";
import { erroSemGrupo, type DepsInicio } from "./inicio.js";

/** Ganchos só dos testes: rede e processo falsos no lugar dos reais. */
export interface ExtrasDepsReais {
  fetchFn?: typeof fetch;
  spawnFn?: (cmd: string, args: readonly string[], opcoes: SpawnOptions) => ChildProcess;
  prefixoArgs?: string[];
  plataforma?: NodeJS.Platform;
}

// Cartório, endereço e pasta do servidor vêm do ambiente até a tela de primeira vez (app-1.3); ver .env.exemplo.
export function depsReais(
  env: NodeJS.ProcessEnv,
  copiar: (texto: string) => void,
  extras: ExtrasDepsReais = {},
): DepsInicio {
  const { SABRE_CARTORIO_URL: url, SABRE_CARTORIO_TOKEN: token } = env;
  const { SABRE_PASTA_SERVIDOR: pasta, SABRE_JAVA: java, SABRE_NEOFORGE: neoforge } = env;
  let cliente: ReturnType<typeof criarCliente> | undefined;
  let falha: unknown;
  if (url && token) {
    try {
      cliente = criarCliente({
        url,
        cofre: { guardar: async () => {}, ler: async () => token },
        ...(extras.fetchFn ? { fetchFn: extras.fetchFn } : {}),
      });
    } catch (e) {
      falha = e;
    }
  }
  const exigir = () => {
    if (cliente) return cliente;
    throw falha ?? erroSemGrupo();
  };
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
    endereco: env["SABRE_ENDERECO"] ?? "",
    copiar,
  };
}
