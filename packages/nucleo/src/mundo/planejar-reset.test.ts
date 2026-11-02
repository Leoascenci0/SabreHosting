import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gerarMundo, hashesDoMundo } from "../../test/ajuda/mundos.js";
import { levelDatComSpawn } from "../../test/ajuda/nbt.js";
import { escreverRegiao } from "../../test/ajuda/regiao-mca.js";
import {
  ErroDoPlanoDeReset,
  MAX_CHUNKS_SEM_CONFIRMAR,
  MAX_RAIO_SEM_CONFIRMAR,
  planejarReset,
} from "./index.js";

const todos = Array.from({ length: 1024 }, (_, i) => i);
const retangulo = (x1: number, z1: number, x2: number, z2: number) =>
  ({ tipo: "retangulo", x1, z1, x2, z2 }) as const;

function mundo(spawn: [number, number] = [5000, 5000]): string {
  const p = mkdtempSync(join(tmpdir(), "sabre-reset-"));
  writeFileSync(join(p, "level.dat"), levelDatComSpawn("novo", spawn[0], 64, spawn[1]));
  return p;
}

describe("planejarReset", () => {
  it("área sem chunk nenhum: plano zerado e aviso", async () => {
    const m = mundo();
    escreverRegiao(join(m, "region", "r.0.0.mca"), [0]);
    const p = await planejarReset(m, "overworld", retangulo(100, 100, 101, 101));
    expect([p.chunksNaArea, p.chunksExistentes, p.regioesTocadas, p.arquivos.length]).toEqual([
      4, 0, 0, 0,
    ]);
    expect(p.avisos.some((a) => a.includes("Nenhum chunk"))).toBe(true);
  });

  it("área parcial: conta chunks, setores reaproveitáveis e arquivos das 3 pastas", async () => {
    const m = mundo();
    escreverRegiao(join(m, "region", "r.0.0.mca"), [0, 1, 33, 500], undefined, 2);
    escreverRegiao(join(m, "entities", "r.0.0.mca"), [1]);
    escreverRegiao(join(m, "poi", "r.0.0.mca"), [500]);
    const p = await planejarReset(m, "overworld", retangulo(0, 0, 1, 0)); // chunks 0 e 1 da linha 0
    expect(p.chunksNaArea).toBe(2);
    expect(p.chunksExistentes).toBe(2);
    expect(p.regioesTocadas).toBe(1);
    const reg = p.arquivos.find((a) => a.tipo === "region");
    expect(reg).toMatchObject({
      chunksAfetados: 2,
      chunksRestantes: 2,
      apagarArquivo: false,
      bytesLiberados: null,
    });
    expect(reg?.setoresReaproveitaveis).toBe(4);
    expect(p.arquivos.map((a) => a.tipo)).toEqual(["region", "entities"]); // poi (500) fora da área
    expect(p.setoresReaproveitaveis).toBe(4); // entities: arquivo todo some, conta em bytes
    expect(p.regioesApagadasInteiras).toBe(1);
    expect(p.bytesLiberados).toBe(2 * 4096 + 4096);
  });

  it("região inteira: arquivo apagado, tamanho em bytes e aviso", async () => {
    const m = mundo();
    escreverRegiao(join(m, "region", "r.0.0.mca"), todos);
    const p = await planejarReset(m, "overworld", retangulo(0, 0, 31, 31));
    expect(p.chunksNaArea).toBe(1024);
    expect(p.chunksExistentes).toBe(1024);
    expect(p.arquivos[0]).toMatchObject({
      apagarArquivo: true,
      bytesLiberados: 2 * 4096 + 1024 * 4096,
    });
    expect(p.bytesLiberados).toBe(2 * 4096 + 1024 * 4096);
    expect(p.setoresReaproveitaveis).toBe(0);
    expect(p.avisos.some((a) => a.includes("apagados por inteiro"))).toBe(true);
  });

  it("coordenadas negativas e cantos em qualquer ordem", async () => {
    const m = mundo();
    escreverRegiao(join(m, "region", "r.-1.-1.mca"), [31 + 31 * 32, 0]); // chunk (-1,-1) e (-32,-32)
    const p = await planejarReset(m, "overworld", retangulo(0, 0, -1, -1));
    expect(p.area).toEqual(retangulo(-1, -1, 0, 0));
    expect(p.chunksExistentes).toBe(1);
    expect(p.arquivos[0]?.chunksAfetados).toBe(1);
  });

  it("raio em blocos: pega os chunks que encostam no círculo, e só eles", async () => {
    const m = mundo();
    escreverRegiao(join(m, "region", "r.0.0.mca"), [0, 1, 32, 33, 3]);
    // centro no bloco (0,0), raio 16: chunk (0,0) sim; (1,0) começa no bloco 16 (distância 16): sim; (1,1): fora
    const p = await planejarReset(m, "overworld", { tipo: "raio", x: 0, z: 0, raio: 16 });
    expect(p.chunksExistentes).toBe(3); // (0,0) (1,0) (0,1) dentro; (1,1) fora (distância²=512>256); (3,0) longe
    expect(p.chunksNaArea).toBe(6); // colunas -1, 0 e 1 com 2, 3 e 1 chunks
  });

  it("contagem do raio por fórmula bate com a conta chunk a chunk", async () => {
    const m = mundo();
    for (const [x, z, raio] of [
      [-37, 90, 100],
      [8, 8, 1],
      [500, -500, 333],
    ] as const) {
      let bruto = 0;
      for (let cx = Math.floor((x - raio) / 16); cx <= Math.floor((x + raio) / 16); cx++)
        for (let cz = Math.floor((z - raio) / 16); cz <= Math.floor((z + raio) / 16); cz++) {
          const dx = Math.max(0, cx * 16 - x, x - (cx * 16 + 15));
          const dz = Math.max(0, cz * 16 - z, z - (cz * 16 + 15));
          if (dx * dx + dz * dz <= raio * raio) bruto++;
        }
      expect(
        (await planejarReset(m, "overworld", { tipo: "raio", x, z, raio }, { confirmado: true }))
          .chunksNaArea,
      ).toBe(bruto);
    }
  });

  it("avisa quando a área inclui o ponto de nascimento (formato antigo e novo)", async () => {
    for (const formato of ["antigo", "novo"] as const) {
      const m = mkdtempSync(join(tmpdir(), "sabre-reset-"));
      writeFileSync(join(m, "level.dat"), levelDatComSpawn(formato, -20, 64, 40));
      escreverRegiao(join(m, "region", "r.-1.1.mca"), [0]);
      const p = await planejarReset(m, "overworld", retangulo(-2, 2, -2, 2)); // chunk do bloco (-20,40)
      expect(p.avisos).toContain("A área inclui o ponto de nascimento do mundo.");
      const longe = await planejarReset(m, "overworld", retangulo(10, 10, 11, 11));
      expect(longe.avisos.some((a) => a.includes("nascimento"))).toBe(false);
    }
  });

  it("level.dat ausente: avisa que não deu para conferir; outra dimensão não confere", async () => {
    const m = mkdtempSync(join(tmpdir(), "sabre-reset-"));
    escreverRegiao(join(m, "region", "r.0.0.mca"), [0]);
    escreverRegiao(join(m, "DIM-1", "region", "r.0.0.mca"), [0]);
    expect((await planejarReset(m, "overworld", retangulo(0, 0, 0, 0))).avisos.join()).toContain(
      "conferir o ponto de nascimento",
    );
    expect((await planejarReset(m, "nether", retangulo(0, 0, 0, 0))).avisos.join()).not.toContain(
      "nascimento",
    );
  });

  it("recusa valor torto com texto fixo, sem repetir o valor", async () => {
    const m = mundo();
    const tortos: unknown[] = [
      retangulo(NaN, 0, 1, 1),
      retangulo(0, Infinity, 1, 1),
      retangulo(0.5, 0, 1, 1),
      retangulo(1_875_000, 0, 1, 1),
      retangulo(0, -1_875_000, 1, 1),
      { tipo: "retangulo", x1: "1", z1: 0, x2: 1, z2: 1 },
      { tipo: "raio", x: 0, z: 0, raio: 0 },
      { tipo: "raio", x: 30_000_000, z: 0, raio: 10 },
      { tipo: "raio", x: 0, z: 0, raio: -5 },
      { tipo: "circulo" },
      null,
      "texto",
    ];
    for (const torto of tortos) {
      const erro = await planejarReset(m, "overworld", torto).catch((e: unknown) => e);
      expect(erro).toBeInstanceOf(ErroDoPlanoDeReset);
      expect((erro as ErroDoPlanoDeReset).codigo).toBe("area-invalida");
      expect((erro as Error).message).toBe(
        "Área inválida: confira os números e os limites do mundo.",
      );
    }
    const dim = await planejarReset(m, "../../etc" as never, retangulo(0, 0, 1, 1)).catch(
      (e: unknown) => e,
    );
    expect((dim as ErroDoPlanoDeReset).codigo).toBe("dimensao-invalida");
    expect((dim as Error).message).not.toContain("etc");
  });

  it("aceita os limites exatos do mundo", async () => {
    const p = await planejarReset(
      mundo(),
      "overworld",
      retangulo(-1_874_999, -1_874_999, -1_874_999, -1_874_999),
    );
    expect(p.chunksNaArea).toBe(1);
  });

  it("área gigante exige confirmação; com confirmado segue", async () => {
    const m = mundo();
    escreverRegiao(join(m, "region", "r.0.0.mca"), [0]);
    const grande = retangulo(0, 0, 32, 31); // 33*32 = 1056
    const erro = await planejarReset(m, "overworld", grande).catch((e: unknown) => e);
    expect((erro as ErroDoPlanoDeReset).codigo).toBe("confirmacao-necessaria");
    expect((erro as ErroDoPlanoDeReset).chunksNaArea).toBe(1056);
    expect((await planejarReset(m, "overworld", grande, { confirmado: true })).chunksNaArea).toBe(
      1056,
    );
    expect((await planejarReset(m, "overworld", retangulo(0, 0, 31, 31))).chunksNaArea).toBe(
      MAX_CHUNKS_SEM_CONFIRMAR,
    );
  });

  it("raio acima de 1000 exige confirmação; o mundo todo em um raio não estoura", async () => {
    const m = mundo();
    const c = (raio: number) => ({ tipo: "raio", x: 0, z: 0, raio }) as const;
    await expect(
      planejarReset(m, "overworld", c(MAX_RAIO_SEM_CONFIRMAR + 1)),
    ).rejects.toMatchObject({
      codigo: "confirmacao-necessaria",
    });
    const t0 = Date.now();
    const p = await planejarReset(m, "overworld", c(29_999_984), { confirmado: true });
    expect(p.chunksNaArea).toBeGreaterThan(1_000_000_000_000);
    expect(Date.now() - t0).toBeLessThan(5000);
  });

  it("só calcula: o hash do mundo é o mesmo depois", async () => {
    const m = gerarMundo({ tamanho: "1MB" });
    escreverRegiao(join(m, "region", "r.0.0.mca"), [0, 1, 2]);
    mkdirSync(join(m, "poi"), { recursive: true });
    const antes = hashesDoMundo(m);
    await planejarReset(m, "overworld", retangulo(0, 0, 1, 0));
    expect(hashesDoMundo(m)).toEqual(antes);
  });
});
