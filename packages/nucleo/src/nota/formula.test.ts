import { describe, expect, it } from "vitest";
import { calcularNota, NOTA_MAXIMA, REFERENCIA, type Medicao } from "./formula.js";

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

  it("fica em 0–NOTA_MAXIMA nos extremos", () => {
    const todas = (v: number): Medicao => ({
      cpuUmNucleo: v,
      cpuNucleos: v,
      ramLivreMb: v,
      uploadMbps: v,
    });
    expect(calcularNota(todas(0))).toBe(0);
    expect(calcularNota(todas(-5))).toBe(0);
    expect(calcularNota(todas(NaN))).toBe(0);
    expect(calcularNota(todas(-Infinity))).toBe(0);
    expect(calcularNota(todas(1e12))).toBe(NOTA_MAXIMA);
    expect(calcularNota(todas(Infinity))).toBe(NOTA_MAXIMA);
  });

  it("não satura em 100: PC 2× mais forte dá cerca de 200", () => {
    const dobro = Object.fromEntries(
      Object.entries(REFERENCIA).map(([k, v]) => [k, v * 2]),
    ) as unknown as Medicao;
    expect(calcularNota(dobro)).toBe(200);
  });

  it("host com nota 90 é superado por um PC com medições 1,3× maiores", () => {
    const escalar = (f: number): Medicao => ({
      cpuUmNucleo: REFERENCIA.cpuUmNucleo * f,
      cpuNucleos: REFERENCIA.cpuNucleos * f,
      ramLivreMb: REFERENCIA.ramLivreMb * f,
      uploadMbps: REFERENCIA.uploadMbps * f,
    });
    const host = calcularNota(escalar(0.9));
    expect(host).toBe(90);
    expect(calcularNota(escalar(0.9 * 1.3))).toBeGreaterThanOrEqual(1.3 * host);
  });

  it("dá 100 a um PC exatamente na referência", () => {
    expect(calcularNota({ ...REFERENCIA })).toBe(100);
  });
});
