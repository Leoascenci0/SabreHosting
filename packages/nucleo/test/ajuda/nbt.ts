import { gzipSync } from "node:zlib";

/** Monta NBT (só para teste; mundo inventado). Cada função devolve os bytes de UMA tag COM tipo e nome. */
const str = (s: string) => {
  const b = Buffer.from(s, "utf8");
  const l = Buffer.alloc(2);
  l.writeUInt16BE(b.length);
  return Buffer.concat([l, b]);
};
const cabeca = (tipo: number, nome: string) => Buffer.concat([Buffer.from([tipo]), str(nome)]);
export const nbtInt = (nome: string, v: number) => {
  const b = Buffer.alloc(4);
  b.writeInt32BE(v);
  return Buffer.concat([cabeca(3, nome), b]);
};
export const nbtString = (nome: string, v: string) => Buffer.concat([cabeca(8, nome), str(v)]);
export const nbtByte = (nome: string, v: number) =>
  Buffer.concat([cabeca(1, nome), Buffer.from([v])]);
export const nbtCompound = (nome: string, filhos: Buffer[]) =>
  Buffer.concat([cabeca(10, nome), ...filhos, Buffer.from([0])]);

/** level.dat de verdade: gzip de Compound "" { Data { Version { Id, Name, Snapshot } } }. */
export function levelDat(nome: string, id: number): Buffer {
  return gzipSync(
    nbtCompound("", [
      nbtCompound("Data", [
        nbtInt("DataVersion", id),
        nbtCompound("Version", [nbtInt("Id", id), nbtString("Name", nome), nbtByte("Snapshot", 0)]),
      ]),
    ]),
  );
}
