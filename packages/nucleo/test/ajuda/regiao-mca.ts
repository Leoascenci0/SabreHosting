import { mkdirSync, truncateSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const SETOR = 4096;

/** Escreve um `.mca` de teste com cabeçalho real (1024 posições + 1024 datas); `chunks` = índices 0..1023 presentes. */
export function escreverRegiao(caminho: string, chunks: number[], tamanhoTotal?: number): void {
  mkdirSync(dirname(caminho), { recursive: true });
  const cabecalho = Buffer.alloc(2 * SETOR);
  chunks.forEach((indice, ordem) => {
    const setor = 2 + ordem;
    cabecalho.writeUIntBE(setor, indice * 4, 3);
    cabecalho.writeUInt8(1, indice * 4 + 3);
    cabecalho.writeUInt32BE(1_700_000_000, SETOR + indice * 4);
  });
  const corpo = Buffer.alloc(chunks.length * SETOR, 0x5a);
  writeFileSync(caminho, Buffer.concat([cabecalho, corpo]));
  if (tamanhoTotal !== undefined) truncateSync(caminho, tamanhoTotal);
}
