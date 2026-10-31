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
  quantosGuardar: 10,
  quantosGuardarHistorico: 10,
  limiteBandaMBs: 10,
  historicoLongoLigado: false,
  historicoLongoPasta: "",
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
        quantosGuardar: 10,
        quantosGuardarHistorico: 10,
        limiteBandaMBs: 10,
        historicoLongoLigado: false,
        historicoLongoPasta: "",
      });
    },
  );

  it("intervalo válido é lido como está", () => {
    salvarPreferencias(pasta, { ...PADRAO, intervaloBackupMin: 30 });
    expect(lerPreferencias(pasta).intervaloBackupMin).toBe(30);
  });

  it.each([0, -3, 2.5, 1001, "dez", "5", true, [3], null, Number.NaN])(
    "quantosGuardar torto (%j) volta ao padrão e não perde o resto",
    (v) => {
      writeFileSync(
        join(pasta, "preferencias.json"),
        JSON.stringify({ ...PADRAO, abrirComWindows: true, quantosGuardar: v }),
      );
      expect(lerPreferencias(pasta)).toEqual({ ...PADRAO, abrirComWindows: true });
    },
  );

  it("quantosGuardar válido é lido como está; arquivo antigo sem o campo usa o padrão", () => {
    salvarPreferencias(pasta, { ...PADRAO, quantosGuardar: 3 });
    expect(lerPreferencias(pasta).quantosGuardar).toBe(3);
    const velho: Record<string, unknown> = { ...PADRAO };
    delete velho["quantosGuardar"];
    writeFileSync(join(pasta, "preferencias.json"), JSON.stringify(velho));
    expect(lerPreferencias(pasta).quantosGuardar).toBe(10);
  });

  it.each([0, -3, 2.5, 1001, "5", true, [3], null])(
    "quantosGuardarHistorico torto (%j) volta ao padrão sem perder o resto",
    (v) => {
      writeFileSync(
        join(pasta, "preferencias.json"),
        JSON.stringify({ ...PADRAO, abrirComWindows: true, quantosGuardarHistorico: v }),
      );
      expect(lerPreferencias(pasta)).toEqual({ ...PADRAO, abrirComWindows: true });
    },
  );

  it.each([0, -3, 1.5, 5000, "10", null, true, [3]])(
    "limiteBandaMBs torto (%j) volta ao padrão 10 sem perder o resto",
    (v) => {
      writeFileSync(
        join(pasta, "preferencias.json"),
        JSON.stringify({ ...PADRAO, abrirComWindows: true, limiteBandaMBs: v }),
      );
      expect(lerPreferencias(pasta)).toEqual({ ...PADRAO, abrirComWindows: true });
    },
  );

  it("limiteBandaMBs válido é lido; arquivo antigo sem o campo usa 10", () => {
    salvarPreferencias(pasta, { ...PADRAO, limiteBandaMBs: 3 });
    expect(lerPreferencias(pasta).limiteBandaMBs).toBe(3);
    const velho: Record<string, unknown> = { ...PADRAO };
    delete velho["limiteBandaMBs"];
    writeFileSync(join(pasta, "preferencias.json"), JSON.stringify(velho));
    expect(lerPreferencias(pasta).limiteBandaMBs).toBe(10);
  });

  it("quantosGuardarHistorico válido é lido; arquivo antigo sem o campo usa 10", () => {
    salvarPreferencias(pasta, { ...PADRAO, quantosGuardarHistorico: 4 });
    expect(lerPreferencias(pasta).quantosGuardarHistorico).toBe(4);
    const velho: Record<string, unknown> = { ...PADRAO };
    delete velho["quantosGuardarHistorico"];
    writeFileSync(join(pasta, "preferencias.json"), JSON.stringify(velho));
    expect(lerPreferencias(pasta).quantosGuardarHistorico).toBe(10);
  });

  it("regravar troca o arquivo inteiro", () => {
    salvarPreferencias(pasta, { ...PADRAO, abrirComWindows: true });
    salvarPreferencias(pasta, PADRAO);
    expect(JSON.parse(readFileSync(join(pasta, "preferencias.json"), "utf8"))).toEqual({
      ...PADRAO,
    });
  });
});
