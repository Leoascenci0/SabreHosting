import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, win32 } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gerarMundo, hashesDoMundo } from "../../test/ajuda/mundos.js";
import { criarPacote } from "./pacote.js";
import { MARCADOR_RESTAURACAO, MARCADOR_TROCA } from "../servidor/configurar.js";

// Simula o EPERM do antivírus só ao apagar o marcador da troca.
const estado = vi.hoisted(() => ({ falhar: false }));
vi.mock("node:fs/promises", async (original) => {
  const real = await original<typeof import("node:fs/promises")>();
  return {
    ...real,
    rm: async (p: string, o?: Parameters<typeof real.rm>[1]) => {
      if (estado.falhar && String(p).endsWith("TROCA-EM-ANDAMENTO.json")) {
        throw Object.assign(new Error("EPERM"), { code: "EPERM" });
      }
      return real.rm(p, o);
    },
  };
});
const { aplicarDelta } = await import("../sync/aplicar.js");
const { gravarMarcadorTroca, mesmoLugar, recuperarTroca, restaurarBackup } =
  await import("./restaurar.js");
const { gerarManifesto } = await import("./manifesto.js");

const pastas: string[] = [];
afterEach(() => {
  estado.falhar = false;
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

describe("falha ao apagar o marcador depois do 2º rename", () => {
  it("aplicarDelta: o mundo novo fica, sem desfazer e sem aviso falso; a partida seguinte só limpa", async () => {
    const base = mkdtempSync(join(tmpdir(), "sabre-marc-"));
    pastas.push(base);
    const mundo = gerarMundo({ tamanho: "1MB", semente: "A", pasta: join(base, "mundo") });
    const remoto = join(base, "remoto");
    cpSync(mundo, remoto, { recursive: true });
    writeFileSync(join(remoto, "region", "r.0.0.mca"), "região mudada no host");
    const alvo = await gerarManifesto(remoto, { versao: 7, epoca: 2 });
    const depois = hashesDoMundo(remoto);
    estado.falhar = true;
    await aplicarDelta({
      pastaDoMundo: mundo,
      alvo,
      baixar: async (a, destino) => {
        await mkdir(dirname(destino), { recursive: true });
        await copyFile(join(remoto, a.caminho), destino);
      },
      temAtualizacao: async () => true,
      hospedaAgora: async () => false,
      servidorParado: () => true,
      avisarCopia: async () => undefined,
    });
    expect(hashesDoMundo(mundo)).toEqual(depois);
    expect(existsSync(join(base, MARCADOR_RESTAURACAO))).toBe(false);
    expect(existsSync(join(base, MARCADOR_TROCA))).toBe(true);
    estado.falhar = false;
    expect(await recuperarTroca(base)).toBe("limpou");
    expect(hashesDoMundo(mundo)).toEqual(depois);
  });
});

/** Mundo de teste + um backup bom de outro estado, para `restaurarBackup`. */
async function cenarioRestaurar() {
  const base = mkdtempSync(join(tmpdir(), "sabre-marc-"));
  pastas.push(base);
  const mundo = gerarMundo({ tamanho: "1MB", semente: "A", pasta: join(base, "mundo") });
  const outro = gerarMundo({ tamanho: "1MB", semente: "B", pasta: join(base, "outro") });
  const pacote = await criarPacote(outro, join(base, "guardado.tar.gz"), { versao: 4, epoca: 1 });
  const o = {
    pacote: pacote.caminho,
    sha256: pacote.sha256,
    pastaDoMundo: mundo,
    pastaBackups: join(base, "backups"),
    temTrava: async () => true,
    servidorParado: () => true,
    versao: 5,
    epoca: 2,
    agora: () => new Date("2026-10-31T10:00:00.000Z"),
  };
  return { base, mundo, o, antes: hashesDoMundo(mundo), depois: hashesDoMundo(outro) };
}

describe("restaurarBackup: falha ao apagar o marcador depois do 2º rename (syncmel-1.5 a)", () => {
  it("o mundo restaurado fica, sem desfazer e sem aviso falso; a partida seguinte só limpa", async () => {
    const { base, mundo, o, depois } = await cenarioRestaurar();
    estado.falhar = true;
    const r = await restaurarBackup(o);
    expect(r.restaurado).toMatchObject({ versao: 4, epoca: 1 });
    expect(hashesDoMundo(mundo)).toEqual(depois);
    expect(existsSync(join(base, MARCADOR_RESTAURACAO))).toBe(false);
    expect(existsSync(join(base, MARCADOR_TROCA))).toBe(true);
    estado.falhar = false;
    expect(await recuperarTroca(base)).toBe("limpou");
    expect(hashesDoMundo(mundo)).toEqual(depois);
  }, 30_000);
});

describe("marcador que não grava antes do 1º rename (syncmel-1.5 d)", () => {
  /** Uma pasta no lugar do arquivo faz o `rename` do marcador falhar (EISDIR). */
  const impedirMarcador = (base: string) => mkdirSync(join(base, MARCADOR_TROCA));

  it("restaurarBackup: apaga a temporária, o mundo fica como estava", async () => {
    const { base, mundo, o, antes } = await cenarioRestaurar();
    impedirMarcador(base);
    await expect(restaurarBackup(o)).rejects.toThrow();
    expect(hashesDoMundo(mundo)).toEqual(antes);
    expect(readdirSync(base).filter((n) => n.startsWith("mundo."))).toEqual([]);
  }, 30_000);

  it("aplicarDelta: apaga a temporária, o mundo fica como estava", async () => {
    const base = mkdtempSync(join(tmpdir(), "sabre-marc-"));
    pastas.push(base);
    const mundo = gerarMundo({ tamanho: "1MB", semente: "A", pasta: join(base, "mundo") });
    const antes = hashesDoMundo(mundo);
    const remoto = join(base, "remoto");
    cpSync(mundo, remoto, { recursive: true });
    writeFileSync(join(remoto, "region", "r.0.0.mca"), "região mudada no host");
    const alvo = await gerarManifesto(remoto, { versao: 7, epoca: 2 });
    impedirMarcador(base);
    await expect(
      aplicarDelta({
        pastaDoMundo: mundo,
        alvo,
        baixar: async (a, destino) => {
          await mkdir(dirname(destino), { recursive: true });
          await copyFile(join(remoto, a.caminho), destino);
        },
        temAtualizacao: async () => true,
        hospedaAgora: async () => false,
        servidorParado: () => true,
        avisarCopia: async () => undefined,
      }),
    ).rejects.toThrow();
    expect(hashesDoMundo(mundo)).toEqual(antes);
    expect(readdirSync(base).filter((n) => n.startsWith("mundo."))).toEqual([]);
  });
});

describe("recuperarTroca: texto de tela (syncmel-1.5 c)", () => {
  it("sem mundo nem .antigo, a mensagem não traz caminho absoluto nem o nome do arquivo de aviso", async () => {
    const base = mkdtempSync(join(tmpdir(), "sabre-marc-"));
    pastas.push(base);
    const mundo = join(base, "mundo");
    await gravarMarcadorTroca({
      mundo,
      antigo: `${mundo}.antigo-v1`,
      temp: `${mundo}.atualizando-v1`,
    });
    const erro = await recuperarTroca(base).then(
      () => undefined,
      (e: unknown) => e as Error,
    );
    expect(erro).toBeInstanceOf(Error);
    expect(erro?.message).not.toContain(MARCADOR_TROCA);
    expect(erro?.message).not.toContain(base);
    expect(existsSync(join(base, MARCADOR_TROCA))).toBe(true); // continua travando
  });
});

describe("recuperarTroca: marcador ilegível (syncmel-1.5 c)", () => {
  it("a mensagem não traz o nome do arquivo nem caminho, e o marcador fica", async () => {
    const base = mkdtempSync(join(tmpdir(), "sabre-marc-"));
    pastas.push(base);
    writeFileSync(join(base, MARCADOR_TROCA), "{ não é json");
    const erro = await recuperarTroca(base).then(
      () => undefined,
      (e: unknown) => e as Error,
    );
    expect(erro).toBeInstanceOf(Error);
    expect(erro?.message).not.toContain(MARCADOR_TROCA);
    expect(erro?.message).not.toContain(base);
    expect(existsSync(join(base, MARCADOR_TROCA))).toBe(true);
  });
});

describe("mesmoLugar com caminhos do Windows (syncmel-1.5 e)", () => {
  it("C:\\ e c:\\ são o mesmo lugar; outra pasta não", () => {
    expect(mesmoLugar("C:\\Servidor", "c:\\servidor", win32)).toBe(true);
    expect(mesmoLugar("C:\\Servidor\\", "c:\\SERVIDOR", win32)).toBe(true);
    expect(mesmoLugar("C:\\Servidor", "C:\\Servidor\\mundo", win32)).toBe(false);
    expect(mesmoLugar("C:\\Servidor", "D:\\Servidor", win32)).toBe(false);
  });
});
