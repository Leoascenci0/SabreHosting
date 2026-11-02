// Roda o E2E do Electron: precisa de tela. Sem DISPLAY usa xvfb-run; sem os dois, pula com aviso.
import { spawnSync } from "node:child_process";

const pasta = new URL("..", import.meta.url).pathname;
const executa = (comando, args) =>
  spawnSync(comando, args, { cwd: pasta, stdio: "inherit" }).status ?? 1;

if (executa("npm", ["run", "build"]) !== 0) process.exit(1);

// `npm run test:e2e -w apps/desktop -- backups` roda só os arquivos que casam (o filtro vai direto ao vitest).
const filtros = process.argv.slice(2);
const vitest = ["npx", "vitest", "run", "--config", "vitest.e2e.config.ts", ...filtros];
if (process.env.DISPLAY) process.exit(executa(vitest[0], vitest.slice(1)));

if (spawnSync("which", ["xvfb-run"]).status === 0) {
  process.exit(executa("xvfb-run", ["-a", ...vitest]));
}
console.log("E2E PULADO: sem DISPLAY e sem xvfb-run (instale com: sudo apt-get install xvfb).");
