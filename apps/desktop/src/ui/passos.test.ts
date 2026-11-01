import { describe, expect, it } from "vitest";
import { rotuloDoPasso } from "./passos.js";

describe("indicador de passos", () => {
  it("escreve 'Passo n de N'", () => {
    expect(rotuloDoPasso(1, 3)).toBe("Passo 1 de 3");
    expect(rotuloDoPasso(3, 3)).toBe("Passo 3 de 3");
  });

  it("nunca sai da faixa 1..N", () => {
    expect(rotuloDoPasso(0, 3)).toBe("Passo 1 de 3");
    expect(rotuloDoPasso(9, 3)).toBe("Passo 3 de 3");
  });
});
