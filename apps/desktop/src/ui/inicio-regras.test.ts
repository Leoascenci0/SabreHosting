import { describe, expect, it } from "vitest";
import { gradeDeNumeros, pecasDeEstado, tempoLigado, tamanhoEmPalavras } from "./inicio-regras.js";
import type { EstadoInicio } from "./ponte.js";

const AGORA = Date.parse("2026-11-02T15:00:00");
const eu: EstadoInicio = {
  tipo: "eu",
  endereco: "10.0.0.5:25565",
  jogadores: ["Ana", "Lucas"],
  ligadoSegundos: 7500,
  ramReservadaMb: 4096,
  totalMemMb: 16384,
  tamanhoMundoBytes: 1_288_490_189,
  quantidadeBackups: 7,
  ultimoBackup: new Date(AGORA - 2 * 3_600_000).toISOString(),
};
const valores = (e: EstadoInicio) =>
  Object.fromEntries(gradeDeNumeros(e, AGORA).map((n) => [n.id, n]));

describe("formatos", () => {
  it("tempo ligado em palavras", () => {
    expect(tempoLigado(30)).toBe("menos de 1 min");
    expect(tempoLigado(240)).toBe("4 min");
    expect(tempoLigado(7500)).toBe("2 h 05 min");
  });
  it("tamanho em GB ou MB com vírgula", () => {
    expect(tamanhoEmPalavras(1_288_490_189)).toBe("1,2 GB");
    expect(tamanhoEmPalavras(52_428_800)).toBe("50 MB");
  });
});

describe("grade de números", () => {
  it("eu hospedo: tudo com comparação real", () => {
    const g = valores(eu);
    expect(g["jogadores"]).toMatchObject({ valor: "2", comparacao: "online agora" });
    expect(g["tempo"]).toMatchObject({ valor: "2 h 05 min" });
    expect(g["ram"]).toMatchObject({ valor: "4 GB", comparacao: "reservada, de 16 GB do PC" });
    expect(g["mundo"]).toMatchObject({ valor: "1,2 GB" });
    expect(g["backups"]).toMatchObject({ valor: "7", comparacao: "backups guardados" });
    expect(g["ultimo"]).toMatchObject({ valor: "há 2 horas" });
  });
  it("outro PC hospeda: o que só o host sabe vira '—' com dica; nada inventado", () => {
    const g = valores({ tipo: "outro", nomePc: "Ana", endereco: "x:1", quantidadeBackups: 1 });
    for (const id of ["jogadores", "tempo", "ram"]) {
      expect(g[id]).toMatchObject({ valor: "—" });
      expect(g[id]?.dica).toBeTruthy();
    }
    expect(g["backups"]).toMatchObject({ valor: "1", comparacao: "backup guardado" });
    expect(g["mundo"]).toMatchObject({ valor: "—" });
  });
  it("sem cartório e ninguém: sem dado vira '—'", () => {
    expect(valores({ tipo: "sem-cartorio", motivo: "rede" })["ultimo"]?.valor).toBe("—");
    expect(valores({ tipo: "ninguem" })["backups"]?.valor).toBe("—");
  });
  it("zero backups é dado (0), ausência é '—'", () => {
    expect(valores({ tipo: "ninguem", quantidadeBackups: 0 })["backups"]?.valor).toBe("0");
  });
});

describe("peças de estado", () => {
  const por = (e: EstadoInicio) => Object.fromEntries(pecasDeEstado(e).map((p) => [p.id, p]));
  it("eu hospedo", () => {
    expect(por(eu)).toMatchObject({
      pc: { tom: "ligado" },
      servidor: { tom: "ligado", palavra: "Ligado" },
      grupo: { tom: "ligado", palavra: "Conectado" },
    });
  });
  it("outro hospeda: servidor ligado no PC dele; este PC só joga", () => {
    const p = por({ tipo: "outro", nomePc: "Ana", endereco: "x:1" });
    expect(p["servidor"]).toMatchObject({ tom: "ligado", detalhe: "no PC do Ana" });
    expect(p["pc"]).toMatchObject({ tom: "desligado" });
  });
  it("ninguém: servidor desligado, este PC pode hospedar", () => {
    const p = por({ tipo: "ninguem" });
    expect(p["servidor"]).toMatchObject({ tom: "desligado", palavra: "Desligado" });
    expect(p["pc"]).toMatchObject({ palavra: "Pode hospedar" });
  });
  it("sem cartório: grupo e PC em atenção", () => {
    const p = por({ tipo: "sem-cartorio", motivo: "rede" });
    expect(p["grupo"]).toMatchObject({ tom: "atencao", palavra: "Sem resposta" });
    expect(p["pc"]?.tom).toBe("atencao");
  });
  it("sempre cor + palavra (nunca só cor)", () => {
    for (const e of [eu, { tipo: "carregando" }, { tipo: "orfao" }] as EstadoInicio[])
      for (const p of pecasDeEstado(e)) expect(p.palavra).not.toBe("");
  });
});
