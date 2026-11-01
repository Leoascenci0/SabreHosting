import { describe, expect, it } from "vitest";
import { AREAS, areaDeTela, proximoIndice } from "./navegacao-regras.js";

describe("barra lateral: regras", () => {
  it("tem as quatro áreas na ordem do roadmap", () => {
    expect([...AREAS]).toEqual(["inicio", "backups", "grupo", "configuracoes"]);
  });

  it("cada tela vira a sua área; Boas-vindas fica sem barra", () => {
    expect(areaDeTela("cartao", undefined)).toBe("inicio");
    expect(areaDeTela("tela-backups", "inicio")).toBe("backups");
    expect(areaDeTela("tela-config", undefined)).toBe("configuracoes");
    expect(areaDeTela("tela-boas-vindas", "inicio")).toBeUndefined();
  });

  it("Grupo e Configurações dividem a tela: vale por onde o amigo entrou", () => {
    expect(areaDeTela("tela-config", "grupo")).toBe("grupo");
    expect(areaDeTela("tela-config", "backups")).toBe("configuracoes");
  });

  it("setas dão a volta; Home e End vão às pontas; outra tecla é ignorada", () => {
    expect(proximoIndice(3, 4, "ArrowDown")).toBe(0);
    expect(proximoIndice(0, 4, "ArrowUp")).toBe(3);
    expect(proximoIndice(1, 4, "ArrowRight")).toBe(2);
    expect(proximoIndice(2, 4, "Home")).toBe(0);
    expect(proximoIndice(0, 4, "End")).toBe(3);
    expect(proximoIndice(0, 4, "a")).toBeUndefined();
  });
});
