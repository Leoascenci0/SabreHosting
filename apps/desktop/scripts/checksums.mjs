// Gera SHA256SUMS.txt dos instaladores da pasta e reprova instalador acima do teto de limites.json.
// Uso: node checksums.mjs <pasta> [--teto-mb N]
import { createHash } from "node:crypto";
import { readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const [pasta, ...resto] = process.argv.slice(2);
const i = resto.indexOf("--teto-mb");
const teto =
  i >= 0
    ? Number(resto[i + 1])
    : JSON.parse(readFileSync(new URL("../../../scripts/limites.json", import.meta.url), "utf8"))
        .instalador_mb;

const falhar = (msg) => {
  console.error(msg);
  process.exit(1);
};
if (!pasta) falhar("Uso: checksums.mjs <pasta> [--teto-mb N]");

const instaladores = readdirSync(pasta).filter((f) => /^SabreHosting-Setup-.+\.exe$/.test(f));
if (instaladores.length === 0) falhar(`Nenhum instalador encontrado em ${pasta}.`);

const linhas = instaladores.sort().map((f) => {
  const caminho = join(pasta, f);
  const mb = statSync(caminho).size / (1024 * 1024);
  if (mb > teto) falhar(`${f} tem ${mb.toFixed(1)} MB, acima do teto de ${teto} MB.`);
  return `${createHash("sha256").update(readFileSync(caminho)).digest("hex")}  ${f}\n`;
});
writeFileSync(join(pasta, "SHA256SUMS.txt"), linhas.join(""));
console.log(linhas.join(""));
