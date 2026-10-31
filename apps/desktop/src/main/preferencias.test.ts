import { mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lerPreferencias, salvarPreferencias } from "./preferencias.js";

const PADRAO = {
  abrirComWindows: false,
  distanciaVisao: 10,
  distanciaSimulacao: 8,
  intervaloBackupMin: 10,
};
let pasta: string;
beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), "sabre-pref-"));
});
afterEach(() => rmSync(pasta, { recursive: true, force: true }));

describe("preferências", () => {
  it("sem arquivo, 'Abrir com o Windows' começa desligado", () => {
    expect(lerPreferencias(pasta)).toEqual(PADRAO);
  });

  it("guarda e lê de volta, sem deixar arquivo temporário", () => {
    salvarPreferencias(pasta, { ...PADRAO, abrirComWindows: true });
    expect(lerPreferencias(pasta)).toEqual({ ...PADRAO, abrirComWindows: true });
    expect(readdirSync(pasta)).toEqual(["preferencias.json"]);
  });

  it("arquivo estragado ou com tipo errado volta ao padrão", () => {
    writeFileSync(join(pasta, "preferencias.json"), "{não é json");
    expect(lerPreferencias(pasta)).toEqual(PADRAO);
    writeFileSync(join(pasta, "preferencias.json"), '{"abrirComWindows":"sim"}');
    expect(lerPreferencias(pasta)).toEqual(PADRAO);
  });

  it("arquivo antigo (só 'abrirComWindows') ganha as distâncias padrão", () => {
    writeFileSync(join(pasta, "preferencias.json"), '{"abrirComWindows":true}');
    expect(lerPreferencias(pasta)).toEqual({ ...PADRAO, abrirComWindows: true });
  });

  it("distância torta volta ao par padrão e não perde o outro campo", () => {
    writeFileSync(
      join(pasta, "preferencias.json"),
      '{"abrirComWindows":true,"distanciaVisao":6,"distanciaSimulacao":9}',
    );
    expect(lerPreferencias(pasta)).toEqual({ ...PADRAO, abrirComWindows: true });
  });

  it.each([0, -5, 1.5, 1441, "abc", null])(
    "intervalo torto (%j) volta ao padrão e não perde o resto",
    (v) => {
      writeFileSync(
        join(pasta, "preferencias.json"),
        JSON.stringify({
          abrirComWindows: true,
          distanciaVisao: 12,
          distanciaSimulacao: 6,
          intervaloBackupMin: v,
        }),
      );
      expect(lerPreferencias(pasta)).toEqual({
        abrirComWindows: true,
        distanciaVisao: 12,
        distanciaSimulacao: 6,
        intervaloBackupMin: 10,
      });
    },
  );

  it("intervalo válido é lido como está", () => {
    salvarPreferencias(pasta, { ...PADRAO, intervaloBackupMin: 30 });
    expect(lerPreferencias(pasta).intervaloBackupMin).toBe(30);
  });

  it("regravar troca o arquivo inteiro", () => {
    salvarPreferencias(pasta, { ...PADRAO, abrirComWindows: true });
    salvarPreferencias(pasta, PADRAO);
    expect(JSON.parse(readFileSync(join(pasta, "preferencias.json"), "utf8"))).toEqual({
      ...PADRAO,
    });
  });
});
