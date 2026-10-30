import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";

/** Hash do arquivo lido em fluxo (nunca o arquivo inteiro na memória). */
export async function hashDoArquivo(caminho: string, algoritmo = "sha256"): Promise<string> {
  const hash = createHash(algoritmo);
  await pipeline(createReadStream(caminho), hash);
  return hash.digest("hex");
}
