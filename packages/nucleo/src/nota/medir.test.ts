import { describe, expect, it } from "vitest";
import { medirPc, TETO_MS } from "./medir.js";

describe("medirPc", () => {
  it("corta com erro em português uma medição que passa do teto", async () => {
    const lenta = (sinal: AbortSignal) =>
      new Promise<number>((_, rejeitar) =>
        sinal.addEventListener("abort", () => rejeitar(sinal.reason)),
      );
    await expect(medirPc({ uploadMbps: 10, tetoMs: 50, cpuUmNucleo: lenta })).rejects.toThrow(
      /passou de/,
    );
  });

  it("corta com erro em português a fase de vários núcleos que passa do teto", async () => {
    const inicio = Date.now();
    await expect(
      medirPc({ uploadMbps: 10, tetoMs: 300, janelaMs: 5000, cpuUmNucleo: async () => 1 }),
    ).rejects.toThrow(/passou de/);
    expect(Date.now() - inicio).toBeLessThan(2000);
  });

  it("ao um worker da fase de vários núcleos falhar, aborta os demais", async () => {
    const sinais: AbortSignal[] = [];
    const lenta = (sinal: AbortSignal) => {
      sinais.push(sinal);
      return new Promise<number>((_, rejeitar) =>
        sinal.addEventListener("abort", () => rejeitar(sinal.reason)),
      );
    };
    const cpuNucleos = (sinal: AbortSignal) =>
      Promise.all([
        lenta(sinal),
        lenta(sinal),
        new Promise<number>((_, rejeitar) =>
          setTimeout(() => rejeitar(new Error("worker caiu")), 50),
        ),
      ]).then((v) => v.reduce((a, b) => a + b, 0));
    const inicio = Date.now();
    await expect(
      medirPc({ uploadMbps: 10, tetoMs: 10_000, cpuUmNucleo: async () => 1, cpuNucleos }),
    ).rejects.toThrow(/worker caiu/);
    expect(Date.now() - inicio).toBeLessThan(2000);
    expect(sinais.every((s) => s.aborted)).toBe(true);
  });

  it("termina em menos de 15 s e devolve medidas plausíveis (medição real, curta)", async () => {
    const inicio = Date.now();
    const m = await medirPc({ uploadMbps: 20, janelaMs: 300 });
    const levou = Date.now() - inicio;
    console.info(`medição real: ${levou} ms`, m);
    expect(levou).toBeLessThan(TETO_MS);
    expect(m.cpuUmNucleo).toBeGreaterThan(0);
    expect(m.cpuNucleos).toBeGreaterThan(0);
    expect(m.ramLivreMb).toBeGreaterThan(0);
    expect(m.uploadMbps).toBe(20);
  });
});
