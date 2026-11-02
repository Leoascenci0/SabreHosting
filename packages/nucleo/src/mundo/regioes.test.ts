import { mkdirSync, mkdtempSync, symlinkSync, truncateSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { gerarMundo, hashesDoMundo } from "../../test/ajuda/mundos.js";
import { escreverRegiao } from "../../test/ajuda/regiao-mca.js";
import { listarRegioes } from "./index.js";

const todos = Array.from({ length: 1024 }, (_, i) => i);

function mundoVazio(): string {
  return mkdtempSync(join(tmpdir(), "sabre-regioes-"));
}

describe("listarRegioes", () => {
  it("região parcial e cheia: diz quais chunks existem e o tamanho em disco", async () => {
    const mundo = mundoVazio();
    escreverRegiao(join(mundo, "region", "r.0.0.mca"), [0, 5, 1023]);
    escreverRegiao(join(mundo, "region", "r.-1.2.mca"), todos);
    const r = await listarRegioes(mundo, "overworld");
    expect(r.map((x) => [x.tipo, x.x, x.z, x.chunks.length])).toEqual([
      ["region", -1, 2, 1024],
      ["region", 0, 0, 3],
    ]);
    expect(r[1]?.chunks).toEqual([0, 5, 1023]);
    expect(r[1]?.arquivo).toBe("region/r.0.0.mca");
    expect(r[1]?.tamanho).toBe(2 * 4096 + 3 * 4096);
  });

  it("inclui entities/ e poi/ quando existem", async () => {
    const mundo = mundoVazio();
    escreverRegiao(join(mundo, "region", "r.0.0.mca"), [1]);
    escreverRegiao(join(mundo, "entities", "r.0.0.mca"), [2]);
    escreverRegiao(join(mundo, "poi", "r.0.0.mca"), [3]);
    const r = await listarRegioes(mundo, "overworld");
    expect(r.map((x) => x.arquivo)).toEqual([
      "region/r.0.0.mca",
      "entities/r.0.0.mca",
      "poi/r.0.0.mca",
    ]);
  });

  it("nether fica em DIM-1 e end em DIM1; uma dimensão não vê a outra", async () => {
    const mundo = mundoVazio();
    escreverRegiao(join(mundo, "region", "r.0.0.mca"), [1]);
    escreverRegiao(join(mundo, "DIM-1", "region", "r.1.1.mca"), [1]);
    escreverRegiao(join(mundo, "DIM1", "region", "r.2.2.mca"), [1]);
    expect((await listarRegioes(mundo, "nether")).map((x) => x.arquivo)).toEqual([
      "DIM-1/region/r.1.1.mca",
    ]);
    expect((await listarRegioes(mundo, "end")).map((x) => x.arquivo)).toEqual([
      "DIM1/region/r.2.2.mca",
    ]);
    expect(await listarRegioes(mundo, "overworld")).toHaveLength(1);
  });

  it("pasta ou dimensão que não existe dá lista vazia", async () => {
    expect(await listarRegioes(mundoVazio(), "end")).toEqual([]);
    expect(await listarRegioes(join(mundoVazio(), "nao-existe"), "overworld")).toEqual([]);
  });

  it("arquivo fora do padrão é ignorado com aviso, sem quebrar", async () => {
    const mundo = mundoVazio();
    escreverRegiao(join(mundo, "region", "r.0.0.mca"), [1]);
    for (const nome of ["r.torto.mca", "r.01.0.mca", "r.0.0.mcc", "r.1.mca", "level.dat"]) {
      writeFileSync(join(mundo, "region", nome), Buffer.alloc(9000));
    }
    mkdirSync(join(mundo, "region", "r.5.5.mca"));
    const avisos: string[] = [];
    const r = await listarRegioes(mundo, "overworld", { aviso: (t) => avisos.push(t) });
    expect(r.map((x) => x.arquivo)).toEqual(["region/r.0.0.mca"]);
    expect(avisos.some((a) => a.includes("r.torto.mca"))).toBe(true);
  });

  it("link simbólico (arquivo ou pasta) é ignorado", async () => {
    const mundo = mundoVazio();
    const fora = mundoVazio();
    escreverRegiao(join(fora, "r.9.9.mca"), [1]);
    escreverRegiao(join(mundo, "region", "r.0.0.mca"), [1]);
    symlinkSync(join(fora, "r.9.9.mca"), join(mundo, "region", "r.3.3.mca"));
    mkdirSync(join(fora, "region"));
    escreverRegiao(join(fora, "region", "r.7.7.mca"), [1]);
    symlinkSync(join(fora, "region"), join(mundo, "entities"));
    const avisos: string[] = [];
    const r = await listarRegioes(mundo, "overworld", { aviso: (t) => avisos.push(t) });
    expect(r.map((x) => x.arquivo)).toEqual(["region/r.0.0.mca"]);
    expect(avisos.length).toBeGreaterThanOrEqual(2);
  });

  it("arquivo menor que o cabeçalho é ignorado com aviso", async () => {
    const mundo = mundoVazio();
    mkdirSync(join(mundo, "region"));
    writeFileSync(join(mundo, "region", "r.0.0.mca"), Buffer.alloc(100));
    const avisos: string[] = [];
    expect(await listarRegioes(mundo, "overworld", { aviso: (t) => avisos.push(t) })).toEqual([]);
    expect(avisos).toHaveLength(1);
  });

  it("posição que aponta além do fim do arquivo não conta como chunk", async () => {
    const mundo = mundoVazio();
    const arq = join(mundo, "region", "r.0.0.mca");
    escreverRegiao(arq, [0, 1]);
    truncateSync(arq, 2 * 4096 + 4096); // só o setor do chunk 0 sobrou
    const avisos: string[] = [];
    const r = await listarRegioes(mundo, "overworld", { aviso: (t) => avisos.push(t) });
    expect(r[0]?.chunks).toEqual([0]);
    expect(avisos).toHaveLength(1);
  });

  it("lê só o cabeçalho: arquivo esparso de 3 GiB lista na hora", async () => {
    const mundo = mundoVazio();
    const arq = join(mundo, "region", "r.0.0.mca");
    escreverRegiao(arq, [10]);
    truncateSync(arq, 3 * 1024 ** 3);
    const t0 = Date.now();
    const r = await listarRegioes(mundo, "overworld");
    expect(r[0]?.chunks).toEqual([10]);
    expect(r[0]?.tamanho).toBe(3 * 1024 ** 3);
    expect(Date.now() - t0).toBeLessThan(2000);
  });

  it("só lê: o hash do mundo é o mesmo depois", async () => {
    const mundo = gerarMundo({ tamanho: "1MB" });
    escreverRegiao(join(mundo, "poi", "r.0.0.mca"), [4, 8]);
    const antes = hashesDoMundo(mundo);
    await listarRegioes(mundo, "overworld");
    expect(hashesDoMundo(mundo)).toEqual(antes);
  });

  it("devolve os setores de cada chunk (o que o Minecraft pode reaproveitar)", async () => {
    const mundo = mundoVazio();
    escreverRegiao(join(mundo, "region", "r.0.0.mca"), [3, 9], undefined, 3);
    const r = await listarRegioes(mundo, "overworld");
    expect(r[0]?.chunks).toEqual([3, 9]);
    expect(r[0]?.setoresDosChunks).toEqual([3, 3]);
  });

  it("DIM-1 e DIM1 como link simbólico são ignorados com aviso", async () => {
    const mundo = mundoVazio();
    const fora = mundoVazio();
    escreverRegiao(join(fora, "region", "r.0.0.mca"), [1]);
    symlinkSync(fora, join(mundo, "DIM-1"));
    symlinkSync(fora, join(mundo, "DIM1"));
    for (const dim of ["nether", "end"] as const) {
      const avisos: string[] = [];
      expect(await listarRegioes(mundo, dim, { aviso: (t) => avisos.push(t) })).toEqual([]);
      expect(avisos).toHaveLength(1);
    }
  });
});
