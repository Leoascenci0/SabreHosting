import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gerarPropriedades } from "@sabrehosting/nucleo/servidor/configurar";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { criarConfiguracoes } from "./configuracoes.js";
import { lerPreferencias, opcoesDoServidor } from "./preferencias.js";

let pasta: string;
let aplicados: boolean[];
const criar = () =>
  criarConfiguracoes({ pasta, aplicarAbrirComWindows: (l) => void aplicados.push(l) });
const valido = {
  abrirComWindows: true,
  distanciaVisao: 12,
  distanciaSimulacao: 6,
  intervaloBackupMin: 30,
};
const padrao = {
  abrirComWindows: false,
  distanciaVisao: 10,
  distanciaSimulacao: 8,
  intervaloBackupMin: 10,
};
const arquivo = () => join(pasta, "preferencias.json");

beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), "sabre-conf-"));
  aplicados = [];
});
afterEach(() => rmSync(pasta, { recursive: true, force: true }));

describe("configurações", () => {
  it("sem arquivo, mostra os valores padrão", () => {
    expect(criar().ler()).toEqual({
      abrirComWindows: false,
      distanciaVisao: 10,
      distanciaSimulacao: 8,
      intervaloBackupMin: 10,
    });
  });

  it("salvar o intervalo grava e avisa o agendador (só depois de gravar)", () => {
    const novos: number[] = [];
    const c = criarConfiguracoes({
      pasta,
      aplicarAbrirComWindows: () => undefined,
      aplicarIntervaloBackup: (m) => void novos.push(m),
    });
    expect(c.salvar(valido)).toEqual({ ok: true });
    expect(novos).toEqual([30]);
    expect(c.ler().intervaloBackupMin).toBe(30);
  });

  it.each([0, -1, 1.5, 1441, Number.NaN])("intervalo %j é recusado e nada é gravado", (v) => {
    const novos: number[] = [];
    const c = criarConfiguracoes({
      pasta,
      aplicarAbrirComWindows: () => undefined,
      aplicarIntervaloBackup: (m) => void novos.push(m),
    });
    const r = c.salvar({ ...valido, intervaloBackupMin: v });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.mensagem).toContain("intervalo do backup");
    expect(novos).toEqual([]);
    expect(() => readFileSync(arquivo())).toThrow();
  });

  it("valor válido grava, liga o Windows e chega ao núcleo", () => {
    expect(criar().salvar(valido)).toEqual({ ok: true });
    expect(aplicados).toEqual([true]);
    const texto = gerarPropriedades({
      ipRedePrivada: "10.66.0.5",
      ...opcoesDoServidor(lerPreferencias(pasta)),
    });
    expect(texto).toContain("view-distance=12\n");
    expect(texto).toContain("simulation-distance=6\n");
  });

  it.each([
    [{ ...valido, distanciaVisao: 2 }, "distância de visão"],
    [{ ...valido, distanciaVisao: 40 }, "distância de visão"],
    [{ ...valido, distanciaSimulacao: 4 }, "distância de simulação"],
    [{ ...valido, distanciaVisao: 8, distanciaSimulacao: 8 }, "menor que"],
    [{ ...valido, distanciaVisao: 10.5 }, "inteiro"],
    [{ ...valido, distanciaVisao: Number.NaN }, "inteiro"],
  ])("valor inválido não salva nada (%j)", (entrada, trecho) => {
    criar().salvar(padrao);
    aplicados.length = 0;
    const antes = readFileSync(arquivo(), "utf8");
    const r = criar().salvar(entrada);
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.mensagem).toContain(trecho);
    expect(readFileSync(arquivo(), "utf8")).toBe(antes);
    expect(aplicados).toEqual([]);
  });

  it.each([
    null,
    "x",
    3,
    {},
    { ...valido, distanciaVisao: "12" },
    { ...valido, abrirComWindows: "sim" },
    { ...valido, intervaloBackupMin: "30" },
    { abrirComWindows: true, distanciaVisao: 12, distanciaSimulacao: 6 },
  ])("formato errado vindo da tela é recusado (%j)", (entrada) => {
    expect(criar().salvar(entrada)).toEqual({
      ok: false,
      mensagem: "Valor inválido. Nada foi alterado.",
    });
  });

  it("falha ao gravar devolve mensagem clara, sem lançar", () => {
    const c = criarConfiguracoes({
      pasta: join(pasta, "preferencias.json", "x"),
      aplicarAbrirComWindows: () => undefined,
    });
    writeFileSync(arquivo(), "{}");
    expect(c.salvar(valido)).toEqual({
      ok: false,
      mensagem: "Não consegui salvar agora. Nada foi alterado.",
    });
  });
});
