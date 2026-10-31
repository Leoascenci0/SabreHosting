import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ehBooleano, navegacaoPermitida, veioDaPagina } from "./seguranca.js";

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

describe("remetente da ponte", () => {
  const de = (url: string | undefined) => ({
    senderFrame: url === undefined ? undefined : { url },
  });

  it("aceita chamada vinda da página do app", () => {
    expect(veioDaPagina(de(pagina), pagina)).toBe(true);
  });

  it("recusa remetente ausente ou de outra origem", () => {
    expect(veioDaPagina(de(undefined), pagina)).toBe(false);
    expect(veioDaPagina({ senderFrame: null }, pagina)).toBe(false);
    expect(veioDaPagina(de("file:///etc/passwd"), pagina)).toBe(false);
    expect(veioDaPagina(de("file:///app/dist/ui/outra.html"), pagina)).toBe(false);
    expect(veioDaPagina(de("https://exemplo.com/app/dist/ui/index.html"), pagina)).toBe(false);
    expect(veioDaPagina(de("http://exemplo.com"), pagina)).toBe(false);
    expect(veioDaPagina(de(pagina + ".evil"), pagina)).toBe(false);
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
