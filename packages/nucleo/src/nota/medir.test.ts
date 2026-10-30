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
