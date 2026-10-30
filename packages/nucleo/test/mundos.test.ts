import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { corromperArquivo, gerarMundo, hashesDoMundo, mudarRegioes } from "./ajuda/mundos.js";

const MB = 1024 * 1024;
const pastas: string[] = [];

function pastaNova(): string {
  const pasta = mkdtempSync(join(tmpdir(), "sabre-teste-"));
  pastas.push(pasta);
  return pasta;
}

function tamanhoTotal(pasta: string): number {
  const hashes = hashesDoMundo(pasta);
  return Object.keys(hashes).reduce((soma, arq) => soma + statSync(join(pasta, arq)).size, 0);
}

afterEach(() => {
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true });
});

describe("gerador de mundos de teste", () => {
  it("gera level.dat e regiões com cerca de 1 MB", () => {
    const mundo = gerarMundo({ tamanho: "1MB", pasta: pastaNova() });
    const arquivos = Object.keys(hashesDoMundo(mundo));
    expect(arquivos).toContain("level.dat");
    expect(arquivos.filter((a) => a.startsWith("region/r.") && a.endsWith(".mca")).length).toBe(4);
    expect(tamanhoTotal(mundo)).toBeGreaterThanOrEqual(MB);
    expect(tamanhoTotal(mundo)).toBeLessThan(MB + 4096);
  });

  it("é determinístico: mesma semente, mesmos bytes; outra semente, outros bytes", () => {
    const a = hashesDoMundo(gerarMundo({ tamanho: "1MB", semente: "a", pasta: pastaNova() }));
    const b = hashesDoMundo(gerarMundo({ tamanho: "1MB", semente: "a", pasta: pastaNova() }));
    const c = hashesDoMundo(gerarMundo({ tamanho: "1MB", semente: "c", pasta: pastaNova() }));
    expect(b).toEqual(a);
    expect(c["region/r.0.0.mca"]).not.toBe(a["region/r.0.0.mca"]);
  });

  it("mudarRegioes(2) muda o hash só dessas 2 regiões", () => {
    const mundo = gerarMundo({ tamanho: "1MB", pasta: pastaNova() });
    const antes = hashesDoMundo(mundo);
    const mudadas = mudarRegioes(mundo, 2);
    const depois = hashesDoMundo(mundo);
    const diferentes = Object.keys(antes).filter((arq) => antes[arq] !== depois[arq]);
    expect(mudadas).toHaveLength(2);
    expect(diferentes.sort()).toEqual([...mudadas].sort());
  });

  it("corromperArquivo muda só 1 arquivo e mantém o tamanho", () => {
    const mundo = gerarMundo({ tamanho: "1MB", pasta: pastaNova() });
    const antes = hashesDoMundo(mundo);
    const tamanhoAntes = tamanhoTotal(mundo);
    const arquivo = corromperArquivo(mundo);
    const depois = hashesDoMundo(mundo);
    const diferentes = Object.keys(antes).filter((arq) => antes[arq] !== depois[arq]);
    expect(diferentes).toEqual([arquivo]);
    expect(tamanhoTotal(mundo)).toBe(tamanhoAntes);
  });

  it("gera 20 MB, e recusa 200 MB sem pedido explícito", () => {
    const mundo = gerarMundo({ tamanho: "20MB", pasta: pastaNova() });
    expect(tamanhoTotal(mundo)).toBeGreaterThanOrEqual(20 * MB);
    expect(tamanhoTotal(mundo)).toBeLessThan(21 * MB);
    if (process.env["SABRE_MUNDO_GRANDE"] !== "1") {
      expect(() => gerarMundo({ tamanho: "200MB", pasta: pastaNova() })).toThrow(
        /SABRE_MUNDO_GRANDE/,
      );
    }
  }, 30_000);
});
