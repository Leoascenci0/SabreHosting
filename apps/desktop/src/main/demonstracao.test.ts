import { describe, expect, it, vi } from "vitest";
import {
  criarDemonstracao,
  protegerEscrita,
  RECUSA_DEMONSTRACAO,
  TEXTO_DEMONSTRACAO,
} from "./demonstracao.js";

describe("demonstração (modo em memória)", () => {
  it("nasce desligada e sem peças", () => {
    const d = criarDemonstracao(async () => ({ a: 1 }));
    expect(d.ativa()).toBe(false);
    expect(d.pecas()).toBeUndefined();
  });

  it("entrar liga e monta as peças; sair desliga e esconde as peças", async () => {
    const d = criarDemonstracao(async () => ({ a: 1 }));
    await d.entrar();
    expect(d.ativa()).toBe(true);
    expect(d.pecas()).toEqual({ a: 1 });
    d.sair();
    expect(d.ativa()).toBe(false);
    expect(d.pecas()).toBeUndefined();
  });

  it("monta uma vez só, mesmo entrando de novo ou entrando junto", async () => {
    const montar = vi.fn(async () => ({}));
    const d = criarDemonstracao(montar);
    await Promise.all([d.entrar(), d.entrar()]);
    d.sair();
    await d.entrar();
    expect(montar).toHaveBeenCalledTimes(1);
  });

  it("se montar falhar, não liga o modo e dá para tentar de novo", async () => {
    let falhar = true;
    const d = criarDemonstracao(async () => {
      if (falhar) throw new Error("sem pasta temporária");
      return {};
    });
    await expect(d.entrar()).rejects.toThrow();
    expect(d.ativa()).toBe(false);
    falhar = false;
    await d.entrar();
    expect(d.ativa()).toBe(true);
  });
});

describe("protegerEscrita", () => {
  it("fora da demonstração, executa", () => {
    const fazer = vi.fn((x: number) => ({ ok: true as const, x }));
    expect(protegerEscrita({ ativa: () => false }, fazer)(3)).toEqual({ ok: true, x: 3 });
    expect(fazer).toHaveBeenCalledTimes(1);
  });

  it("em demonstração, recusa com o texto fixo e nunca executa", () => {
    const fazer = vi.fn(async () => ({ ok: true as const }));
    const r = protegerEscrita({ ativa: () => true }, fazer)();
    expect(r).toEqual(RECUSA_DEMONSTRACAO);
    expect(TEXTO_DEMONSTRACAO).toContain("Isso é só uma demonstração");
    expect(fazer).not.toHaveBeenCalled();
  });
});
