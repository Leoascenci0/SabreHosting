import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./tokens.css", import.meta.url), "utf8");

function bloco(abertura: RegExp): Record<string, string> {
  const achado = css.match(new RegExp(abertura.source + String.raw`\s*\{([^}]*)\}`));
  expect(achado, `bloco ${abertura} não achado`).not.toBeNull();
  return Object.fromEntries(
    [...(achado?.[1] ?? "").matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map((m) => [
      m[1],
      m[2]?.trim(),
    ]),
  ) as Record<string, string>;
}

const luminancia = (hex: string): number => {
  const [r = 0, g = 0, b = 0] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const cor = (t: Record<string, string>, nome: string): string => t[nome] ?? "";
const contraste = (a: string, b: string): number => {
  const [x, y] = [luminancia(a), luminancia(b)].sort((p, q) => q - p) as [number, number];
  return (x + 0.05) / (y + 0.05);
};

describe("tokens", () => {
  const claro = bloco(/:root/);
  const escuro = bloco(/@media \(prefers-color-scheme: dark\)\s*\{\s*:root/);

  it("o tema escuro redefine exatamente as cores do claro", () => {
    const cores = (t: Record<string, string>) =>
      Object.keys(t).filter((k) => k.startsWith("--cor-"));
    expect(cores(escuro).sort()).toEqual(cores(claro).sort());
    expect(cores(claro).length).toBeGreaterThan(4);
  });

  it("espaços existem só no bloco base", () => {
    expect(
      Object.keys(claro).filter((k) => k.startsWith("--espaco-")).length,
    ).toBeGreaterThanOrEqual(5);
  });

  it.each([
    ["claro", claro],
    ["escuro", escuro],
  ])("texto tem contraste AA (4,5:1) no tema %s", (_nome, t) => {
    expect(contraste(cor(t, "--cor-texto"), cor(t, "--cor-fundo"))).toBeGreaterThanOrEqual(4.5);
    expect(contraste(cor(t, "--cor-texto-suave"), cor(t, "--cor-fundo"))).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contraste(cor(t, "--cor-texto"), cor(t, "--cor-superficie"))).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contraste(cor(t, "--cor-destaque"), cor(t, "--cor-superficie"))).toBeGreaterThanOrEqual(
      4.5,
    );
    expect(contraste(cor(t, "--cor-erro"), cor(t, "--cor-superficie"))).toBeGreaterThanOrEqual(4.5);
    expect(
      contraste(cor(t, "--cor-sobre-destaque"), cor(t, "--cor-destaque")),
    ).toBeGreaterThanOrEqual(4.5);
    expect(contraste(cor(t, "--cor-sobre-destaque"), cor(t, "--cor-erro"))).toBeGreaterThanOrEqual(
      4.5,
    );
  });
});
