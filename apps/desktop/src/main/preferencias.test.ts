import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lerPreferencias, salvarPreferencias } from "./preferencias.js";

let pasta: string;
beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), "sabre-pref-"));
});
afterEach(() => rmSync(pasta, { recursive: true, force: true }));

describe("preferências", () => {
  it("sem arquivo, 'Abrir com o Windows' começa desligado", () => {
    expect(lerPreferencias(pasta)).toEqual({ abrirComWindows: false });
  });

  it("guarda e lê de volta, sem deixar arquivo temporário", () => {
    salvarPreferencias(pasta, { abrirComWindows: true });
    expect(lerPreferencias(pasta)).toEqual({ abrirComWindows: true });
    expect(readdirSync(pasta)).toEqual(["preferencias.json"]);
  });

  it("arquivo estragado ou com tipo errado volta ao padrão", () => {
    writeFileSync(join(pasta, "preferencias.json"), "{não é json");
    expect(lerPreferencias(pasta)).toEqual({ abrirComWindows: false });
    writeFileSync(join(pasta, "preferencias.json"), '{"abrirComWindows":"sim"}');
    expect(lerPreferencias(pasta)).toEqual({ abrirComWindows: false });
  });

  it("regravar troca o arquivo inteiro", () => {
    salvarPreferencias(pasta, { abrirComWindows: true });
    salvarPreferencias(pasta, { abrirComWindows: false });
    expect(JSON.parse(readFileSync(join(pasta, "preferencias.json"), "utf8"))).toEqual({
      abrirComWindows: false,
    });
  });
});
