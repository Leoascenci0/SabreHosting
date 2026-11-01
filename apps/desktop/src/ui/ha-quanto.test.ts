import { describe, expect, it } from "vitest";
import { haQuanto } from "./ha-quanto.js";

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
