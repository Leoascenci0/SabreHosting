import { describe, expect, it } from "vitest";
import { rotuloConfirmarVersao } from "./rotulo-versao.js";

describe("botão de confirmar a troca de versão", () => {
  it("mostra que o backup está sendo feito enquanto ocupado", () => {
    expect(rotuloConfirmarVersao(true)).toBe("Fazendo backup antes…");
    expect(rotuloConfirmarVersao(false)).toBe("Trocar");
  });
});
