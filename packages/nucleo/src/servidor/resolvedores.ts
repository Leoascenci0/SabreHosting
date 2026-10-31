import type { HashEsperado } from "./baixar.js";

export interface Alvo {
  url: string;
  hashEsperado: HashEsperado;
}

const HEX = { sha1: 40, sha256: 64, sha512: 128 } as const;

function alvo(url: unknown, algoritmo: keyof typeof HEX, valor: unknown, fonte: string): Alvo {
  if (typeof url !== "string" || !url)
    throw new Error(`Resposta do ${fonte} sem endereço de download.`);
  if (typeof valor !== "string" || !new RegExp(`^[0-9a-f]{${HEX[algoritmo]}}$`, "i").test(valor)) {
    throw new Error(
      `Resposta do ${fonte} sem hash ${algoritmo} válido; não vou baixar sem conferir.`,
    );
  }
  return { url, hashEsperado: { algoritmo, valor: valor.toLowerCase() } };
}

/** `GET /v3/assets/latest/<versão>/hotspot…` da Adoptium (array de pacotes). */
export function resolverAdoptium(json: unknown): Alvo {
  const pacote = (json as { binary?: { package?: Record<string, unknown> } }[] | undefined)?.[0]
    ?.binary?.package;
  if (!pacote) throw new Error("A Adoptium não devolveu nenhum pacote de Java para essa versão.");
  return alvo(pacote.link, "sha256", pacote.checksum, "Adoptium");
}

/** Um objeto de versão do Modrinth (`/v2/version/<id>`): arquivo primário, `hashes.sha512`. */
export function resolverModrinth(versao: unknown): Alvo {
  const arquivos = (
    versao as { files?: { url?: string; primary?: boolean; hashes?: Record<string, string> }[] }
  )?.files;
  const arquivo = arquivos?.find((a) => a.primary) ?? arquivos?.[0];
  if (!arquivo) throw new Error("O Modrinth não devolveu nenhum arquivo para essa versão.");
  return alvo(arquivo.url, "sha512", arquivo.hashes?.sha512, "Modrinth");
}

/**
 * Hash sha1 do instalador de cada versão do NeoForge, conferido pelo grupo (versão → sha1). Vazia de valores reais
 * até o Eliel escolher a versão e o hash ser tirado num PC com acesso ao Maven (ver PR do hostmel-1.1).
 */
export const HASHES_NEOFORGE: Readonly<Record<string, string>> = {};

/**
 * Instalador do NeoForge no Maven oficial. O hash que vale é o da `tabela` (fixado pelo grupo); o `sidecar` (texto do
 * `.sha1` do mesmo Maven) só é conferido contra ela, porque um servidor comprometido serviria jar e sidecar combinados.
 */
export function resolverNeoForge(
  versao: string,
  sidecar: string,
  tabela: Readonly<Record<string, string>> = HASHES_NEOFORGE,
): Alvo {
  if (!/^\w[\w.+-]*$/.test(versao)) throw new Error("Informe a versão do NeoForge (sem padrão).");
  const fixado = Object.hasOwn(tabela, versao) ? tabela[versao] : undefined;
  if (!fixado)
    throw new Error(
      `O NeoForge ${versao} ainda não tem o hash conferido pelo grupo; não vou baixar.`,
    );
  const url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${versao}/neoforge-${versao}-installer.jar`;
  const lido = alvo(url, "sha1", sidecar.trim().split(/\s+/)[0], "Maven do NeoForge");
  const esperado = alvo(url, "sha1", fixado, "grupo");
  if (lido.hashEsperado.valor !== esperado.hashEsperado.valor)
    throw new Error(
      `O hash do NeoForge ${versao} no Maven não confere com o fixado pelo grupo; não vou baixar.`,
    );
  return esperado;
}
