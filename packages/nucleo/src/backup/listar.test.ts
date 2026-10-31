import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { gerarMundo } from "../../test/ajuda/mundos.js";
import { nomeDoBackup } from "./agendador.js";
import { listarBackups } from "./listar.js";
import { criarPacote } from "./pacote.js";

const pastas: string[] = [];
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});
const pasta = (): string => {
  const p = mkdtempSync(join(tmpdir(), "sabre-listar-"));
  pastas.push(p);
  return p;
};

describe("listarBackups", () => {
  it("devolve nome, data, tamanho e versão de cada pacote, do mais novo para o mais antigo", async () => {
    const mundo = gerarMundo({ tamanho: "1MB" });
    pastas.push(mundo);
    const backups = pasta();
    const antigo = nomeDoBackup(new Date("2026-10-30T10:00:00Z"), 3);
    const novo = nomeDoBackup(new Date("2026-10-31T10:00:00Z"), 4);
    await criarPacote(mundo, join(backups, antigo), { versao: 3, epoca: 1 });
    await criarPacote(mundo, join(backups, novo), { versao: 4, epoca: 1 });

    const lista = await listarBackups(backups);

    expect(lista.map((b) => b.nome)).toEqual([novo, antigo]);
    expect(lista[0]).toMatchObject({ versao: 4, tamanho: 1024 * 1024 + 1024 });
    expect(new Date(lista[0]!.criadoEm).getTime()).toBeGreaterThan(0);
  });

  it("ignora o que não é pacote fechado (parcial, lixo, arquivo quebrado) sem apagar nada", async () => {
    const backups = pasta();
    writeFileSync(join(backups, "x.tar.gz.parcial"), "meio");
    writeFileSync(join(backups, "quebrado.tar.gz"), "não é tar");
    writeFileSync(join(backups, "notas.txt"), "oi");
    expect(await listarBackups(backups)).toEqual([]);
  });

  it("pasta que não existe é lista vazia", async () => {
    expect(await listarBackups(join(pasta(), "nada"))).toEqual([]);
  });
});
