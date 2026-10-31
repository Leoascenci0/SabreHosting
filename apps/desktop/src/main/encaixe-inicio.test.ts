import { describe, expect, it, vi } from "vitest";
import { criarEncaixeInicio, REINICIANDO } from "./encaixe-inicio.js";

function montar(trocada: boolean) {
  const jogar = vi.fn(() => "jogou");
  const hospedar = vi.fn(() => ({ ok: true }));
  return {
    jogar,
    hospedar,
    encaixe: criarEncaixeInicio({ trocada: () => trocada, jogar, hospedar }),
  };
}

describe("encaixe de Jogar/Hospedar", () => {
  it("depois de trocar a pasta, Jogar lança e não chama o início", () => {
    const m = montar(true);
    expect(() => m.encaixe.jogar()).toThrow(REINICIANDO);
    expect(m.jogar).not.toHaveBeenCalled();
  });

  it("depois de trocar a pasta, Hospedar recusa e não chama o início (a trava nem é pedida)", () => {
    const m = montar(true);
    expect(m.encaixe.hospedar()).toEqual({ ok: false, mensagem: REINICIANDO });
    expect(m.hospedar).not.toHaveBeenCalled();
  });

  it("sem troca, repassa para o início", () => {
    const m = montar(false);
    expect(m.encaixe.jogar()).toBe("jogou");
    expect(m.encaixe.hospedar()).toEqual({ ok: true });
  });
});
