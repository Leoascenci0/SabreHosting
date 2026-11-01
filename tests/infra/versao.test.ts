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

/** Texto de um job de `versao.yml` (do nome até o próximo job ou o fim). */
const trabalho = (nome: string): string => {
  const yml = lerTexto(".github/workflows/versao.yml");
  const m = yml.match(new RegExp(`^  ${nome}:\\n([\\s\\S]*?)(?=^  [a-z-]+:\\n|(?![\\s\\S]))`, "m"));
  return m?.[1] ?? "";
};

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

describe("versao.yml — escrita só na release (appmel-1.25)", () => {
  const instalador = trabalho("instalador");
  const release = trabalho("release");
  it("o job do ensaio (instalador) só lê: sem contents: write", () => {
    expect(instalador).toMatch(/permissions:\s*\n\s+contents: read/);
    expect(instalador).not.toMatch(/contents: write/);
    expect(instalador).not.toMatch(/GITHUB_TOKEN|gh release/);
  });
  it("o checkout não deixa o token gravado no .git", () => {
    const bloco = instalador.split(/\n      - /).find((b) => b.includes("actions/checkout")) ?? "";
    expect(bloco).toMatch(/persist-credentials: false/);
  });
  it("só o job release escreve, depende do instalador e roda só em tag", () => {
    expect(release).toMatch(/needs: instalador/);
    expect(release).toMatch(/permissions:\s*\n\s+contents: write/);
    expect(release).toMatch(/gh release create/);
    expect([...(lerTexto(".github/workflows/versao.yml").replace(/^#.*$/gm, "").match(/contents: write/g) ?? [])]).toHaveLength(1);
  });
  it("o instalador e os checksums viajam como artefato entre os jobs", () => {
    expect(instalador).toMatch(/name: instalador-release/);
    expect(release).toMatch(/download-artifact@[0-9a-f]{40}/);
    expect(release).toMatch(/name: instalador-release/);
  });
});

describe("versao.yml — ensaio sem release (appmel-1.23)", () => {
  const yml = lerTexto(".github/workflows/versao.yml");
  it("pode ser disparado à mão, só para ensaio", () => {
    expect(yml).toMatch(/^\s+workflow_dispatch:/m);
  });
  it("nunca publica pelo electron-builder", () => {
    expect(yml).toMatch(/electron-builder[^\n]*--publish never/);
  });
  it("tag, checksums e release só valem em push de tag", () => {
    for (const nome of ["Conferir que a tag bate", "Checksums e teto", "Subir o instalador e os checksums"]) {
      const bloco = yml.split(/\n      - /).find((b) => b.includes(nome)) ?? "";
      expect(bloco, nome).toMatch(/if: github\.event_name == 'push'/);
    }
    expect(trabalho("release")).toMatch(/^    if: github\.event_name == 'push'/m);
  });
  it("no ensaio sobe o .exe como artefato, com a action fixada por hash", () => {
    const bloco = yml.split(/\n      - /).find((b) => b.includes("actions/upload-artifact")) ?? "";
    expect(bloco).toMatch(/upload-artifact@[0-9a-f]{40}/);
    expect(bloco).toMatch(/if: github\.event_name == 'workflow_dispatch'/);
    expect(bloco).toMatch(/path: apps\/desktop\/release\/SabreHosting-Setup-\*\.exe/);
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
