import { describe, expect, it } from "vitest";
import { executarOcupado } from "./executar-ocupado.js";

describe("executarOcupado", () => {
  it("marca e desmarca ocupado quando dá certo", async () => {
    const marcas: boolean[] = [];
    await executarOcupado(
      (s) => marcas.push(s),
      async () => {},
      () => marcas.push(true),
    );
    expect(marcas).toEqual([true, false]);
  });

  it("exceção na ação: mostra o erro e destrava os botões", async () => {
    const marcas: boolean[] = [];
    let falhou = 0;
    await executarOcupado(
      (s) => marcas.push(s),
      async () => {
        throw new Error("ponte caiu");
      },
      () => falhou++,
    );
    expect(falhou).toBe(1);
    expect(marcas).toEqual([true, false]);
  });
});
