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
});
