import { describe, expect, it, vi } from "vitest";
import { tentar } from "./tolerante.js";

describe("tentar", () => {
  it("devolve o resultado quando dá certo", () => {
    expect(tentar("x", () => 7)).toBe(7);
  });

  it("registra a falha e devolve undefined, sem lançar", () => {
    const registrar = vi.fn();
    const erro = new Error("ENOENT bandeja-16.png");
    expect(tentar("bandeja", () => { throw erro; }, registrar)).toBeUndefined();
    expect(registrar).toHaveBeenCalledWith(expect.stringContaining("bandeja"), erro);
  });

  it("bandeja que falha não impede a janela (sequência do arranque)", () => {
    const registrar = vi.fn();
    const criarJanela = vi.fn(() => "janela");
    const bandeja = tentar("bandeja", () => { throw new Error("sem ícone"); }, registrar);
    const janela = criarJanela();
    expect(bandeja).toBeUndefined();
    expect(janela).toBe("janela");
  });
});
