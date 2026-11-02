import { mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { gerarMundo } from "../../../../packages/nucleo/test/ajuda/mundos.js";
import { tamanhoDoMundo } from "./tamanho-mundo.js";

const criadas: string[] = [];
afterEach(() => {
  for (const p of criadas.splice(0)) rmSync(p, { recursive: true, force: true });
});

describe("tamanho do mundo no disco (appuimel-2.3)", () => {
  it("soma o tamanho dos arquivos do mundo inventado (1 KB de level.dat + 4 regiões de 256 KB)", async () => {
    const mundo = gerarMundo({ tamanho: "1MB" });
    criadas.push(mundo);
    expect(await tamanhoDoMundo(mundo)).toBe(1024 + 4 * 256 * 1024);
  });

  it("sem pasta ou pasta que não existe = undefined (a tela mostra —)", async () => {
    expect(await tamanhoDoMundo(undefined)).toBeUndefined();
    expect(await tamanhoDoMundo(join(tmpdir(), "sabre-nao-existe-2-3"))).toBeUndefined();
  });

  it("não segue atalho: o que está fora da pasta do mundo não entra na conta", async () => {
    const mundo = gerarMundo({ tamanho: "1MB" });
    const fora = gerarMundo({ tamanho: "1MB", semente: "fora" });
    criadas.push(mundo, fora);
    symlinkSync(fora, join(mundo, "atalho"), "dir");
    writeFileSync(join(mundo, "extra.txt"), "abc");
    mkdirSync(join(mundo, "vazia"));
    expect(await tamanhoDoMundo(mundo)).toBe(1024 + 4 * 256 * 1024 + 3);
  });

  it("teto de entradas: mundo com arquivos demais devolve undefined (a tela mostra —)", async () => {
    const mundo = gerarMundo({ tamanho: "1MB" });
    criadas.push(mundo);
    // O mundo inventado tem 6 entradas (5 arquivos + a pasta region); teto 3 estoura, teto 6 passa.
    expect(await tamanhoDoMundo(mundo, { maxEntradas: 3 })).toBeUndefined();
    expect(await tamanhoDoMundo(mundo, { maxEntradas: 6 })).toBe(1024 + 4 * 256 * 1024);
  });

  it("teto de tempo: percurso que passa do prazo devolve undefined", async () => {
    const mundo = gerarMundo({ tamanho: "1MB" });
    criadas.push(mundo);
    let t = 0;
    const agora = (): number => (t += 100);
    expect(await tamanhoDoMundo(mundo, { maxMs: 250, agora })).toBeUndefined();
  });
});
