import { readdirSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const raiz = new URL("../../", import.meta.url);
const construtor = JSON.parse(readFileSync(new URL("electron-builder.json", raiz), "utf8")) as {
  files: string[];
};
const principal = readFileSync(new URL("src/main/principal.ts", raiz), "utf8");

// Regressão appmel-1.30: o app.asar só tinha dist/ e package.json, e o main lê os ícones de recursos/ em runtime.
describe("empacotamento: arquivos lidos em runtime fora de dist/", () => {
  const pastas = [...principal.matchAll(/aqui\("\.\.\/\.\.\/(recursos\/[^"]+)"\)/g)].map((m) => m[1]!);

  it("o main referencia ao menos o ícone da janela e a pasta da bandeja", () => {
    expect(pastas.length).toBeGreaterThanOrEqual(2);
  });

  it.each(pastas)("%s está coberto por `files` do electron-builder", (caminho) => {
    const arquivos = caminho.endsWith("/")
      ? readdirSync(new URL(caminho, raiz)).map((f) => caminho + f)
      : [caminho];
    expect(arquivos.length).toBeGreaterThan(0);
    for (const arquivo of arquivos.filter((a) => a.endsWith(".png"))) {
      const coberto = construtor.files.some((padrao) => {
        const re = new RegExp("^" + padrao.replace(/[.+]/g, "\\$&").replace(/\*\*\/\*/g, ".*").replace(/\*/g, "[^/]*") + "$");
        return re.test(arquivo);
      });
      expect(coberto, `${arquivo} fora de files`).toBe(true);
    }
  });
});
