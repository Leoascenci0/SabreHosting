import { spawnSync } from "node:child_process";
import { resolve, join } from "node:path";
import { describe, expect, it } from "vitest";

const SCRIPT = join(resolve(import.meta.dirname, "../.."), "scripts/vistoria-comum.sh");
const ehRoot = process.getuid?.() === 0;

function rodar(env: Record<string, string>) {
  return spawnSync("bash", [SCRIPT], {
    env: { ...process.env, SABRE_COMUM_INSTALAR: "true", ...env },
    encoding: "utf8",
    timeout: 60_000,
  });
}

describe("vistoria-comum.sh", () => {
  it("sem privilégio, roda o comando direto e devolve o código de saída", () => {
    const r = rodar({ SABRE_FALSO_UID: "1000", SABRE_COMUM_COMANDO: "exit 7" });
    expect(r.status).toBe(7);
  });

  it.skipIf(!ehRoot)("como root, roda o comando como usuário comum e falha no que só passa como root", () => {
    const r = rodar({ SABRE_COMUM_COMANDO: 'test "$(id -u)" = 0' });
    expect(r.status).not.toBe(0);
  });

  it.skipIf(!ehRoot)("como root, o comando enxerga um usuário sem privilégio e a cópia limpa do repositório", () => {
    const r = rodar({ SABRE_COMUM_COMANDO: 'test "$(id -u)" != 0 && test -f package.json && test -w . && echo "cwd=$PWD"' });
    expect(r.status).toBe(0);
    const pasta = /cwd=(\S+)/.exec(r.stdout)?.[1] ?? "";
    expect(pasta).not.toBe(resolve(SCRIPT, "../.."));
    // a pasta temporária é apagada ao sair
    expect(spawnSync("test", ["-e", pasta]).status).not.toBe(0);
  });
});
