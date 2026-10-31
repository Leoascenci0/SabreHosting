import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
  quantosGuardar: 5,
  historicoLongoLigado: false,
  historicoLongoPasta: "",
};
const padrao = {
  abrirComWindows: false,
  distanciaVisao: 10,
  distanciaSimulacao: 8,
  intervaloBackupMin: 10,
  quantosGuardar: 10,
  historicoLongoLigado: false,
  historicoLongoPasta: "",
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
      quantosGuardar: 10,
      historicoLongoLigado: false,
      historicoLongoPasta: "",
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
    expect(r.ok === false && r.campo).toBe("intervalo");
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
    { ...valido, quantosGuardar: "5" },
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

describe("histórico longo numa pasta (drive-1.1a)", () => {
  it("liga com pasta completa e grava", () => {
    const pastaDrive = join(tmpdir(), "drive");
    const r = criar().salvar({
      ...valido,
      historicoLongoLigado: true,
      historicoLongoPasta: pastaDrive,
    });
    expect(r).toEqual({ ok: true });
    expect(criar().ler()).toMatchObject({
      historicoLongoLigado: true,
      historicoLongoPasta: pastaDrive,
    });
  });

  it.each(["", "   ", "relativa/pasta"])(
    "ligar com pasta inválida (%j) é recusado sem gravar",
    (p) => {
      const r = criar().salvar({ ...valido, historicoLongoLigado: true, historicoLongoPasta: p });
      expect(r).toMatchObject({ ok: false, mensagem: expect.stringMatching(/histórico longo/i) });
      expect(existsSync(arquivo())).toBe(false);
    },
  );

  it.each([0, -1, 1.5, 1001, Number.NaN])("quantosGuardar %j é recusado e nada é gravado", (v) => {
    const c = criar();
    expect(c.salvar(valido).ok).toBe(true);
    const antes = readFileSync(arquivo(), "utf8");
    const r = c.salvar({ ...valido, quantosGuardar: v });
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.campo).toBe("quantos");
    expect(r.ok === false && r.mensagem).toContain("Quantos guardar");
    expect(readFileSync(arquivo(), "utf8")).toBe(antes);
  });

  it("salvar quantosGuardar grava o valor", () => {
    const c = criar();
    expect(c.salvar({ ...valido, quantosGuardar: 3 }).ok).toBe(true);
    expect(c.ler().quantosGuardar).toBe(3);
  });

  it("o erro de cada campo traz o código do campo, não depende do texto (ajuste 3)", () => {
    const campo = (extra: object) => {
      const r = criar().salvar({ ...valido, ...extra });
      return r.ok ? undefined : r.campo;
    };
    expect(campo({ distanciaVisao: 99 })).toBe("distancias");
    expect(campo({ intervaloBackupMin: 0 })).toBe("intervalo");
    expect(campo({ historicoLongoLigado: true, historicoLongoPasta: "" })).toBe("historico");
  });

  it("escolherPasta só devolve caminho absoluto; cancelar ou erro viram undefined (ajuste 1)", async () => {
    const com = (r: () => Promise<string | undefined>) =>
      criarConfiguracoes({ pasta, aplicarAbrirComWindows: () => undefined, escolherPasta: r });
    const abs = join(tmpdir(), "drive");
    expect(await com(async () => abs).escolherPasta()).toBe(abs);
    expect(await com(async () => undefined).escolherPasta()).toBeUndefined();
    expect(await com(async () => "relativa").escolherPasta()).toBeUndefined();
    expect(await com(() => Promise.reject(new Error("x"))).escolherPasta()).toBeUndefined();
    expect(await criar().escolherPasta()).toBeUndefined();
  });

  it("pasta torta escrita à mão no arquivo desliga o histórico (S-07), sem perder o resto", () => {
    writeFileSync(
      arquivo(),
      JSON.stringify({ ...valido, historicoLongoLigado: true, historicoLongoPasta: "../../x" }),
    );
    expect(criar().ler()).toMatchObject({ historicoLongoLigado: false, intervaloBackupMin: 30 });
  });
});
