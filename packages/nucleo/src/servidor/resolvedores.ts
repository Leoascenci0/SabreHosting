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
 * Instalador do NeoForge no Maven oficial. `sidecar` é o texto do `.sha1` do mesmo Maven
 * (protege de download corrompido, não de servidor comprometido).
 */
export function resolverNeoForge(versao: string, sidecar: string): Alvo {
  if (!/^[\w.+-]+$/.test(versao)) throw new Error("Informe a versão do NeoForge (sem padrão).");
  const url = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${versao}/neoforge-${versao}-installer.jar`;
  return alvo(url, "sha1", sidecar.trim().split(/\s+/)[0], "Maven do NeoForge");
}
