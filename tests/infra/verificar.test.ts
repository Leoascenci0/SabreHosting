import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = resolve(import.meta.dirname, "../../scripts/verificar.py");

let repo: string;
beforeEach(() => {
  repo = mkdtempSync(join(tmpdir(), "sabre-ver-"));
  git(["init", "-q", "-b", "teste"]);
  git(["config", "user.email", "asc.eliel@gmail.com"]);
  git(["config", "user.name", "Teste"]);
});
afterEach(() => {
  rmSync(repo, { recursive: true, force: true });
});

function git(args: string[]) {
  return spawnSync("git", args, { cwd: repo, encoding: "utf8" });
}

function verificarStaged(nome: string, texto: string) {
  writeFileSync(join(repo, nome), texto);
  git(["add", nome]);
  return spawnSync("python3", [SCRIPT, "--staged"], { cwd: repo, encoding: "utf8" });
}

const ini = "<".repeat(7);
const meio = "=".repeat(7);
const fim = ">".repeat(7);

describe("verificar.py: marcador de conflito de merge", () => {
  it("reprova o trio completo e diz arquivo e linha", () => {
    const r = verificarStaged(
      "DECISOES.md",
      `linha 1\n${ini} HEAD\nminha\n${meio}\ndeles\n${fim} outro-ramo\n`,
    );
    expect(r.status).toBe(1);
    expect(r.stdout).toContain("DECISOES.md:2");
    expect(r.stdout).toContain("REPROVADO");
  });

  it("aprova título Markdown sublinhado com =======", () => {
    const r = verificarStaged("t.md", `Título\n${meio}\n\ntexto\n`);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain("APROVADO");
  });

  it("aprova abertura sem o trio completo", () => {
    const r = verificarStaged("a.md", `${ini} só abre\ntexto\n`);
    expect(r.status).toBe(0);
  });
});
