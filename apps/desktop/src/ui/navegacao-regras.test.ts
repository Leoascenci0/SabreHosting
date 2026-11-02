import { describe, expect, it } from "vitest";
import { AREAS, areaDeTela, proximoIndice, rotuloChip, textoCartorio } from "./navegacao-regras.js";

describe("barra lateral: regras", () => {
  it("tem as cinco áreas na ordem da barra (Mundo entre Backups e Grupo)", () => {
    expect([...AREAS]).toEqual(["inicio", "backups", "mundo", "grupo", "configuracoes"]);
  });

  it("cada tela vira a sua área; Boas-vindas fica sem barra", () => {
    expect(areaDeTela("cartao")).toBe("inicio");
    expect(areaDeTela("tela-backups")).toBe("backups");
    expect(areaDeTela("tela-mundo")).toBe("mundo");
    expect(areaDeTela("tela-grupo")).toBe("grupo");
    expect(areaDeTela("tela-config")).toBe("configuracoes");
    expect(areaDeTela("tela-boas-vindas")).toBeUndefined();
  });

  it("Mods é subtela de Grupo: marca Grupo e não vira item da barra", () => {
    expect(areaDeTela("tela-mods")).toBe("grupo");
    expect(AREAS).not.toContain("mods");
  });

  it("Importar mundo é subtela do Início: marca Início e não vira item da barra", () => {
    expect(areaDeTela("tela-importar")).toBe("inicio");
    expect(AREAS).not.toContain("importar");
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

describe("chip de estado: rótulo", () => {
  it("diz sempre uma palavra, com o tom do estado", () => {
    expect(rotuloChip({ tipo: "carregando" })).toEqual({ tom: "troca", texto: "Verificando…" });
    expect(rotuloChip({ tipo: "ninguem" })).toEqual({ tom: "desligado", texto: "Desligado" });
    expect(rotuloChip({ tipo: "ninguem", trabalho: "restaurando" })).toEqual({
      tom: "troca",
      texto: "Ligando…",
    });
    expect(rotuloChip({ tipo: "ninguem", atualizando: 40 })).toEqual({
      tom: "troca",
      texto: "Ligando…",
    });
    expect(rotuloChip({ tipo: "eu", endereco: "x" })).toEqual({ tom: "ligado", texto: "Online" });
    expect(rotuloChip({ tipo: "eu", endereco: "x", jogadores: ["a", "b"] })).toEqual({
      tom: "ligado",
      texto: "2 online",
    });
    expect(rotuloChip({ tipo: "eu", endereco: "x", parando: true })).toEqual({
      tom: "troca",
      texto: "Desligando…",
    });
    expect(rotuloChip({ tipo: "outro", nomePc: "Lucas", endereco: "x" })).toEqual({
      tom: "ligado",
      texto: "Lucas hospeda",
    });
    expect(rotuloChip({ tipo: "sem-cartorio", motivo: "rede" })).toEqual({
      tom: "atencao",
      texto: "Sem cartório",
    });
    expect(rotuloChip({ tipo: "orfao" }).tom).toBe("atencao");
  });

  it("rodapé: estado do cartório em palavras", () => {
    expect(textoCartorio({ tipo: "carregando" })).toBe("Cartório: verificando…");
    expect(textoCartorio({ tipo: "sem-cartorio", motivo: "rede" })).toBe("Cartório: sem resposta");
    expect(textoCartorio({ tipo: "ninguem" })).toBe("Cartório: conectado");
  });
});
