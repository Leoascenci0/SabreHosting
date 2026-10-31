import { gzipSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { levelDat, nbtCompound, nbtString } from "../test/ajuda/nbt.js";
import { lerVersaoDoLevelDat } from "./nbt.js";

describe("lerVersaoDoLevelDat", () => {
  it("lê Data.Version.Name e Id de um level.dat válido", () => {
    expect(lerVersaoDoLevelDat(levelDat("1.21.4", 4189))).toEqual({ nome: "1.21.4", id: 4189 });
  });

  it("level.dat antigo sem Version vira null (desconhecida)", () => {
    const gz = gzipSync(nbtCompound("", [nbtCompound("Data", [nbtString("LevelName", "x")])]));
    expect(lerVersaoDoLevelDat(gz)).toBeNull();
  });

  it("lixo que não é gzip vira null, sem lançar", () => {
    expect(lerVersaoDoLevelDat(Buffer.from("isto não é um level.dat"))).toBeNull();
  });

  it("bomba gzip (explode além do teto) vira null sem estourar a memória", () => {
    const bomba = gzipSync(Buffer.alloc(64 * 1024 * 1024));
    expect(bomba.length).toBeLessThan(200_000);
    expect(lerVersaoDoLevelDat(bomba, { maxBytes: 1024 * 1024 })).toBeNull();
  });

  it("comprimento de string maior que o arquivo vira null", () => {
    // String com comprimento declarado 60000, mas só 3 bytes de verdade.
    const mentira = Buffer.concat([
      Buffer.from([10, 0, 0]), // raiz ""
      Buffer.from([8, 0, 1, 0x41, 0xea, 0x60, 0x61, 0x62, 0x63]), // string "A" com tamanho 60000
    ]);
    expect(lerVersaoDoLevelDat(gzipSync(mentira))).toBeNull();
  });

  it("comprimento de lista maior que o arquivo vira null", () => {
    const mentira = Buffer.concat([
      Buffer.from([10, 0, 0]),
      Buffer.from([9, 0, 1, 0x4c, 3, 0x7f, 0xff, 0xff, 0xff]), // lista de 2 bilhões de ints, sem dados
    ]);
    expect(lerVersaoDoLevelDat(gzipSync(mentira))).toBeNull();
  });

  it("profundidade excessiva de compounds aninhados vira null sem estourar a pilha", () => {
    const n = 100_000;
    const abre = Buffer.concat(Array.from({ length: n }, () => Buffer.from([10, 0, 1, 0x41])));
    expect(
      lerVersaoDoLevelDat(gzipSync(Buffer.concat([Buffer.from([10, 0, 0]), abre]))),
    ).toBeNull();
  });
});
