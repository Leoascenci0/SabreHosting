import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ehBooleano, navegacaoPermitida } from "./seguranca.js";

const pagina = "file:///app/dist/ui/index.html";

describe("navegação", () => {
  it("só a própria página do app é permitida", () => {
    expect(navegacaoPermitida(pagina, pagina)).toBe(true);
    expect(navegacaoPermitida(pagina + "#topo", pagina)).toBe(true);
  });

  it("bloqueia site externo, outro arquivo local e lixo", () => {
    expect(navegacaoPermitida("https://exemplo.com", pagina)).toBe(false);
    expect(navegacaoPermitida("file:///etc/passwd", pagina)).toBe(false);
    expect(navegacaoPermitida("não é url", pagina)).toBe(false);
  });
});

describe("argumentos da ponte", () => {
  it("aceita só booleano de verdade", () => {
    expect(ehBooleano(true)).toBe(true);
    expect(ehBooleano(false)).toBe(true);
    for (const ruim of ["true", 1, null, undefined, {}]) expect(ehBooleano(ruim)).toBe(false);
  });
});

describe("página", () => {
  const html = readFileSync(new URL("../ui/index.html", import.meta.url), "utf8");

  it("traz CSP restrita à própria origem", () => {
    expect(html).toContain("default-src 'self'");
    expect(html).not.toMatch(/unsafe-(inline|eval)/);
  });

  it("não tem script nem estilo embutido", () => {
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)/);
    expect(html).not.toContain("<style");
  });
});
