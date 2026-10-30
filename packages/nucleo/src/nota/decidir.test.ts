import { describe, expect, it } from "vitest";
import { deveMedir, SETE_DIAS_MS } from "./decidir.js";

const agora = new Date("2026-10-30T12:00:00Z");
const base = { ultimaMedicaoEm: null, agora, jogoAberto: false, permitirHospedar: true };

describe("deveMedir", () => {
  it("mede no primeiro uso", () => {
    expect(deveMedir(base)).toBe(true);
  });

  it("não mede com menos de 7 dias", () => {
    const seisDias = new Date(agora.getTime() - SETE_DIAS_MS + 1000);
    expect(deveMedir({ ...base, ultimaMedicaoEm: seisDias })).toBe(false);
  });

  it("mede com 7 dias ou mais", () => {
    const seteDias = new Date(agora.getTime() - SETE_DIAS_MS);
    expect(deveMedir({ ...base, ultimaMedicaoEm: seteDias })).toBe(true);
  });

  it("nunca mede com o jogo aberto", () => {
    expect(deveMedir({ ...base, jogoAberto: true })).toBe(false);
  });

  it("nunca mede se o PC não pode hospedar", () => {
    expect(deveMedir({ ...base, permitirHospedar: false })).toBe(false);
  });
});
