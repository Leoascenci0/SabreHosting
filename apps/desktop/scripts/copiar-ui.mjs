// O tsc gera os .js; aqui vão junto a página e os estilos.
import { cpSync } from "node:fs";

for (const arquivo of ["index.html", "tokens.css", "tela.css"]) {
  cpSync(
    new URL(`../src/ui/${arquivo}`, import.meta.url),
    new URL(`../dist/ui/${arquivo}`, import.meta.url),
  );
}
