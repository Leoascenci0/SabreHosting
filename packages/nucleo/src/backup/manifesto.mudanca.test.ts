import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gerarMundo } from "../../test/ajuda/mundos.js";

const MENSAGEM = /O mundo mudou durante a leitura; o servidor ainda está gravando\?/;
const falha = vi.hoisted(() => ({ modo: "nenhum" as "nenhum" | "apagou" | "cresceu" }));

vi.mock("../integridade/hash.js", async (original) => {
  const real = await original<typeof import("../integridade/hash.js")>();
  return {
    ...real,
    hashComTamanho: async (caminho: string, algoritmo?: string) => {
      if (falha.modo === "apagou") {
        throw Object.assign(new Error("ENOENT"), { code: "ENOENT" });
      }
      const lido = await real.hashComTamanho(caminho, algoritmo);
      return falha.modo === "cresceu" ? { ...lido, tamanho: lido.tamanho + 10 } : lido;
    },
  };
});

const { gerarManifesto } = await import("./manifesto.js");
const pastas: string[] = [];

afterEach(() => {
  falha.modo = "nenhum";
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true });
});

function mundo(): string {
  const pasta = mkdtempSync(join(tmpdir(), "sabre-mudanca-"));
  pastas.push(pasta);
  return gerarMundo({ tamanho: "1MB", pasta });
}

describe("mundo que muda durante a leitura", () => {
  const opcoes = { versao: 1, epoca: 1 };

  it("arquivo apagado entre a listagem e a leitura: erro claro", async () => {
    falha.modo = "apagou";
    await expect(gerarManifesto(mundo(), opcoes)).rejects.toThrow(MENSAGEM);
  });

  it("arquivo que cresce durante a leitura: erro claro", async () => {
    falha.modo = "cresceu";
    await expect(gerarManifesto(mundo(), opcoes)).rejects.toThrow(MENSAGEM);
  });

  it("sem mudança, gera normalmente", async () => {
    const m = await gerarManifesto(mundo(), opcoes);
    expect(m.arquivos.length).toBeGreaterThan(0);
  });
});
