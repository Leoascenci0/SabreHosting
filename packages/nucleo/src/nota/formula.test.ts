import { describe, expect, it } from "vitest";
import { calcularNota, REFERENCIA, type Medicao } from "./formula.js";

const media: Medicao = { cpuUmNucleo: 150, cpuNucleos: 600, ramLivreMb: 4096, uploadMbps: 25 };

describe("calcularNota", () => {
  it("dá a mesma nota para a mesma medição", () => {
    expect(calcularNota(media)).toBe(calcularNota({ ...media }));
  });

  it("devolve um inteiro", () => {
    expect(Number.isInteger(calcularNota(media))).toBe(true);
  });

  it("cresce quando cada medida melhora", () => {
    const base = calcularNota(media);
    expect(calcularNota({ ...media, cpuUmNucleo: 200 })).toBeGreaterThan(base);
    expect(calcularNota({ ...media, cpuNucleos: 800 })).toBeGreaterThan(base);
    expect(calcularNota({ ...media, ramLivreMb: 6144 })).toBeGreaterThan(base);
    expect(calcularNota({ ...media, uploadMbps: 40 })).toBeGreaterThan(base);
  });

  it("fica em 0–100 nos extremos", () => {
    expect(calcularNota({ cpuUmNucleo: 0, cpuNucleos: 0, ramLivreMb: 0, uploadMbps: 0 })).toBe(0);
    expect(
      calcularNota({ cpuUmNucleo: 1e9, cpuNucleos: 1e9, ramLivreMb: 1e9, uploadMbps: 1e9 }),
    ).toBe(100);
    expect(calcularNota({ cpuUmNucleo: -5, cpuNucleos: NaN, ramLivreMb: -1, uploadMbps: -1 })).toBe(
      0,
    );
  });

  it("dá 100 a um PC exatamente na referência", () => {
    expect(calcularNota({ ...REFERENCIA })).toBe(100);
  });
});
