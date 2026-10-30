import { createHash } from "node:crypto";
import { createReadStream } from "node:fs";
import { pipeline } from "node:stream/promises";

/** Hash do arquivo lido em fluxo (nunca o arquivo inteiro na memória). */
export async function hashDoArquivo(caminho: string, algoritmo = "sha256"): Promise<string> {
  const hash = createHash(algoritmo);
  await pipeline(createReadStream(caminho), hash);
  return hash.digest("hex");
}

/** Hash e quantidade de bytes lidos na MESMA passada, para que tamanho e hash sejam do mesmo instante. */
export async function hashComTamanho(
  caminho: string,
  algoritmo = "sha256",
): Promise<{ hash: string; tamanho: number }> {
  const hash = createHash(algoritmo);
  let tamanho = 0;
  for await (const pedaco of createReadStream(caminho) as AsyncIterable<Buffer>) {
    hash.update(pedaco);
    tamanho += pedaco.length;
  }
  return { hash: hash.digest("hex"), tamanho };
}
