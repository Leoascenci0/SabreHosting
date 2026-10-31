import { describe, expect, it } from "vitest";
import { nomeNaRede } from "./nome-na-rede.js";

describe("nomeNaRede (único normalizador do nome do PC convidado)", () => {
  it("tira acento, põe minúsculas e troca espaço por hífen", () => {
    expect(nomeNaRede("PC do João")).toBe("pc-do-joao");
  });
  it("símbolos viram um hífen só e as pontas ficam limpas", () => {
    expect(nomeNaRede("  --Sala #1 !!  ")).toBe("sala-1");
  });
  it("corta em 32 caracteres sem deixar hífen no fim", () => {
    const n = nomeNaRede("a".repeat(31) + " b");
    expect(n.length).toBeLessThanOrEqual(32);
    expect(n.endsWith("-")).toBe(false);
    expect(nomeNaRede("x".repeat(40))).toHaveLength(32);
  });
  it("vazio ou só símbolos dá vazio", () => {
    expect(nomeNaRede("")).toBe("");
    expect(nomeNaRede("!!! ???")).toBe("");
  });
  it("sempre cabe no formato do cartório", () => {
    for (const t of ["Ção", "ÁÉÍ 9", "a--b", "Zé_da_Silva"])
      expect(nomeNaRede(t)).toMatch(/^[a-z0-9][a-z0-9-]{0,31}$/);
  });
});
