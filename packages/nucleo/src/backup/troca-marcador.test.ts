import { cpSync, existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { copyFile, mkdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gerarMundo, hashesDoMundo } from "../../test/ajuda/mundos.js";
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
const { recuperarTroca } = await import("./restaurar.js");
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
      temTrava: async () => true,
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
