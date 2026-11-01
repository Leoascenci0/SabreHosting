import { describe, expect, it } from "vitest";
import { dataEmPalavras, haQuanto } from "./ha-quanto.js";

const AGORA = Date.parse("2026-11-01T12:00:00Z");
const antes = (min: number): string => new Date(AGORA - min * 60_000).toISOString();

describe("haQuanto", () => {
  it("diz o tempo em palavras, no singular e no plural", () => {
    expect(haQuanto(antes(0.5), AGORA)).toBe("há menos de 1 minuto");
    expect(haQuanto(antes(1), AGORA)).toBe("há 1 minuto");
    expect(haQuanto(antes(45), AGORA)).toBe("há 45 minutos");
    expect(haQuanto(antes(60), AGORA)).toBe("há 1 hora");
    expect(haQuanto(antes(180), AGORA)).toBe("há 3 horas");
    expect(haQuanto(antes(1440), AGORA)).toBe("há 1 dia");
    expect(haQuanto(antes(3 * 1440 + 5), AGORA)).toBe("há 3 dias");
  });
  it("relógio adiantado não vira tempo negativo; data torta = sem resposta", () => {
    expect(haQuanto(antes(-10), AGORA)).toBe("há menos de 1 minuto");
    expect(haQuanto("ontem", AGORA)).toBeUndefined();
  });
});

describe("dataEmPalavras", () => {
  // Datas montadas no fuso local: o texto também sai no fuso local.
  const agora = new Date(2026, 10, 1, 16, 0).getTime();
  const em = (d: number, h: number, m: number): string => new Date(2026, 10, d, h, m).toISOString();

  it("hoje e ontem em palavras, com a hora", () => {
    expect(dataEmPalavras(em(1, 14, 32), agora)).toBe("hoje 14:32");
    expect(dataEmPalavras(em(1, 0, 5), agora)).toBe("hoje 00:05");
    expect(dataEmPalavras(new Date(2026, 9, 31, 23, 50).toISOString(), agora)).toBe("ontem 23:50");
  });
  it("mais velho que ontem mostra dia, mês e ano", () => {
    expect(dataEmPalavras(new Date(2026, 9, 30, 9, 10).toISOString(), agora)).toBe(
      "30/10/2026 09:10",
    );
  });
  it("relógio adiantado não quebra; data torta = sem resposta", () => {
    expect(dataEmPalavras(em(2, 10, 0), agora)).toBe("02/11/2026 10:00");
    expect(dataEmPalavras("ontem", agora)).toBeUndefined();
  });
});
