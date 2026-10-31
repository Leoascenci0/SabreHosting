import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { gerarMundo } from "../../../../packages/nucleo/test/ajuda/mundos.js";
import { criarPacote } from "@sabrehosting/nucleo/backup/pacote";
import { nomeDoBackup } from "@sabrehosting/nucleo/backup/agendador";
import { depsBackups } from "./deps-backups.js";

const pastas: string[] = [];
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});
const temp = (): string => {
  const p = mkdtempSync(join(tmpdir(), "sabre-depsbkp-"));
  pastas.push(p);
  return p;
};

function cenario() {
  const mundo = gerarMundo({ tamanho: "1MB" });
  pastas.push(mundo);
  const backups = temp();
  const eventos: string[] = [];
  const cliente = {
    pegar: async () => (
      eventos.push("pegar"),
      { ok: true as const, epoca: 3, expiraEm: 0, renovarMs: 20_000 }
    ),
    renovar: async () => ({ ok: true as const, epoca: 3, expiraEm: 0, renovarMs: 20_000 }),
    soltar: async () => (
      eventos.push("soltar"),
      { ok: true as const, epoca: 4, expiraEm: 0, renovarMs: 20_000 }
    ),
    estadoTrava: async () => ({ epoca: 3 }),
  };
  return { mundo, backups, eventos, cliente };
}

describe("depsBackups", () => {
  it("restaurar pega a trava, troca o mundo, guarda o estado de antes e solta a trava", async () => {
    const c = cenario();
    const nome = nomeDoBackup(new Date("2026-10-30T10:00:00Z"), 2);
    await criarPacote(c.mundo, join(c.backups, nome), { versao: 2, epoca: 1 });
    const original = readFileSync(join(c.mundo, "level.dat"));
    writeFileSync(join(c.mundo, "level.dat"), "mundo mexido depois do backup");

    const d = depsBackups({
      pastaBackups: c.backups,
      pastaDoMundo: c.mundo,
      cliente: c.cliente,
      servidorRodando: () => false,
    });
    await d.restaurar(nome);

    expect(readFileSync(join(c.mundo, "level.dat")).equals(original)).toBe(true);
    expect(readdirSync(c.backups).filter((n) => n.endsWith(".tar.gz"))).toHaveLength(2); // o de antes + o novo
    expect(c.eventos).toEqual(["pegar", "soltar"]);
  });

  it("com o servidor rodando recusa antes de pegar a trava e o mundo não muda", async () => {
    const c = cenario();
    const nome = nomeDoBackup(new Date("2026-10-30T10:00:00Z"), 2);
    await criarPacote(c.mundo, join(c.backups, nome), { versao: 2, epoca: 1 });
    writeFileSync(join(c.mundo, "level.dat"), "atual");
    const d = depsBackups({
      pastaBackups: c.backups,
      pastaDoMundo: c.mundo,
      cliente: c.cliente,
      servidorRodando: () => true,
    });
    await expect(d.restaurar(nome)).rejects.toThrow(/servidor/i);
    expect(readFileSync(join(c.mundo, "level.dat")).toString()).toBe("atual");
    expect(c.eventos).toEqual([]); // recusou antes de pegar a vez
  });

  it("sem pasta configurada diz o que falta e não toca o cartório", async () => {
    const c = cenario();
    const d = depsBackups({
      pastaBackups: undefined,
      pastaDoMundo: undefined,
      cliente: c.cliente,
      servidorRodando: () => false,
    });
    await expect(d.listar()).rejects.toThrow(/pasta de backups/);
    await expect(d.restaurar("x.tar.gz")).rejects.toThrow(/pasta de backups/);
    expect(c.eventos).toEqual([]);
    expect(existsSync(c.mundo)).toBe(true);
  });

  it("se o cartório recusa a vez, nada é solto nem trocado e a mensagem é em pt-BR", async () => {
    const c = cenario();
    const nome = nomeDoBackup(new Date("2026-10-30T10:00:00Z"), 2);
    await criarPacote(c.mundo, join(c.backups, nome), { versao: 2, epoca: 1 });
    writeFileSync(join(c.mundo, "level.dat"), "atual");
    const cliente = {
      ...c.cliente,
      pegar: async () => ({
        ok: false as const,
        erro: "ocupada",
        motivo: "ocupada" as const,
        donoPcId: 2,
        epoca: 5,
        expiraEm: 0,
      }),
    };
    const d = depsBackups({
      pastaBackups: c.backups,
      pastaDoMundo: c.mundo,
      cliente,
      servidorRodando: () => false,
    });
    await expect(d.restaurar(nome)).rejects.toThrow(/Não consegui pegar a vez/);
    expect(c.eventos).toEqual([]); // não soltou o que não pegou
    expect(readFileSync(join(c.mundo, "level.dat")).toString()).toBe("atual");
  });

  it("servidor órfão vivo (app reaberto) bloqueia a restauração sem tocar o cartório", async () => {
    const c = cenario();
    const nome = nomeDoBackup(new Date("2026-10-30T10:00:00Z"), 2);
    await criarPacote(c.mundo, join(c.backups, nome), { versao: 2, epoca: 1 });
    writeFileSync(join(c.mundo, "level.dat"), "atual");
    const d = depsBackups({
      pastaBackups: c.backups,
      pastaDoMundo: c.mundo,
      cliente: c.cliente,
      servidorRodando: () => false,
      servidorOrfao: async () => true,
    });
    await expect(d.restaurar(nome)).rejects.toThrow(/ainda está no ar/);
    expect(c.eventos).toEqual([]);
    expect(readFileSync(join(c.mundo, "level.dat")).toString()).toBe("atual");
  });
});
