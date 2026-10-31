import { spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { createHash } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const RAIZ = resolve(import.meta.dirname, "../..");
const lerTexto = (rel: string) => readFileSync(join(RAIZ, rel), "utf8");
const SCRIPT = join(RAIZ, "apps/desktop/scripts/checksums.mjs");

describe("electron-builder.json", () => {
  const cfg = JSON.parse(lerTexto("apps/desktop/electron-builder.json"));
  it("gera só o instalador NSIS de Windows x64, sem assinatura e sem publicar", () => {
    expect(cfg.win.target).toEqual([{ target: "nsis", arch: ["x64"] }]);
    expect(cfg.publish).toBeNull();
    expect(JSON.stringify(cfg)).not.toMatch(/certificate|signingHash|CSC_|password/i);
  });
  it("instala por usuário, sem pedir administrador", () => {
    expect(cfg.nsis.perMachine).toBe(false);
    expect(cfg.nsis.oneClick).toBe(false);
  });
  it("tem nome de arquivo previsível e usa o ícone do projeto", () => {
    expect(cfg.nsis.artifactName).toBe("SabreHosting-Setup-${version}.${ext}");
    expect(cfg.win.icon).toBe("recursos/icone/icone.ico");
  });
});

describe("versao.yml", () => {
  const yml = lerTexto(".github/workflows/versao.yml");
  it("dispara só em tag de versão", () => {
    expect(yml).toMatch(/tags:\s*\n\s*- "v\*\.\*\.\*"/);
    expect(yml).not.toMatch(/pull_request/);
    expect(yml).not.toMatch(/branches:/);
  });
  it("roda em runner Windows e escreve só no job de versão", () => {
    expect(yml).toMatch(/runs-on: windows-latest/);
    expect(yml).toMatch(/^permissions:\s*\n\s+contents: read/m);
    expect(yml).toMatch(/jobs:[\s\S]*permissions:\s*\n\s+contents: write/);
  });
  it("fixa toda action por hash e não usa segredo próprio", () => {
    const usos = [...yml.matchAll(/uses:\s*(\S+)/g)].map((m) => m[1]);
    expect(usos.length).toBeGreaterThan(0);
    for (const u of usos) expect(u).toMatch(/@[0-9a-f]{40}$/);
    expect(yml.match(/secrets\.[A-Za-z_]+/g) ?? []).toEqual(["secrets.GITHUB_TOKEN"]);
  });
  it("confere tag x versão, gera checksums e publica a release", () => {
    expect(yml).toMatch(/package\.json/);
    expect(yml).toMatch(/electron-builder/);
    expect(yml).toMatch(/checksums\.mjs/);
    expect(yml).toMatch(/gh release create/);
    expect(yml).toMatch(/SHA256SUMS\.txt/);
  });
});

describe("checksums.mjs", () => {
  let pasta: string;
  beforeEach(() => {
    pasta = mkdtempSync(join(tmpdir(), "sabre-versao-"));
  });
  afterEach(() => rmSync(pasta, { recursive: true, force: true }));
  const rodar = (...args: string[]) => spawnSync("node", [SCRIPT, ...args], { encoding: "utf8" });

  it("escreve SHA256SUMS.txt com o hash real de cada instalador", () => {
    const dist = join(pasta, "release");
    mkdirSync(dist);
    const conteudo = Buffer.from("instalador de teste");
    writeFileSync(join(dist, "SabreHosting-Setup-1.0.0.exe"), conteudo);
    const r = rodar(dist);
    expect(r.status).toBe(0);
    const esperado = createHash("sha256").update(conteudo).digest("hex");
    expect(readFileSync(join(dist, "SHA256SUMS.txt"), "utf8")).toBe(
      `${esperado}  SabreHosting-Setup-1.0.0.exe\n`,
    );
  });
  it("reprova quando não há instalador", () => {
    const r = rodar(pasta);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/instalador/i);
  });
  it("reprova instalador acima do teto de tamanho", () => {
    writeFileSync(join(pasta, "SabreHosting-Setup-1.0.0.exe"), Buffer.alloc(2 * 1024 * 1024));
    const r = rodar(pasta, "--teto-mb", "1");
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/teto/i);
  });
});
