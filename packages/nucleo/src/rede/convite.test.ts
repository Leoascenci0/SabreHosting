import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { gerarChavesDoPc } from "./wireguard.js";
import { lerConvite } from "./convite.js";

const AGORA = 1_800_000_000_000;
const PRIV = gerarChavesDoPc().privada;
const HUB = gerarChavesDoPc().publica;

function dadosBons(extra: Record<string, unknown> = {}) {
  return {
    g: "Grupo de Teste",
    h: "hub.exemplo:51820",
    k: HUB,
    i: "10.66.0.200",
    p: PRIV,
    c: randomBytes(32).toString("base64url"),
    a: 7710,
    e: Math.floor(AGORA / 1000) + 3600,
    ...extra,
  };
}
const texto = (d: unknown) =>
  `sabre://convite/1.${Buffer.from(JSON.stringify(d)).toString("base64url")}`;

describe("lerConvite", () => {
  it("lê um convite bom e devolve os campos com nomes legíveis", () => {
    const d = dadosBons();
    const r = lerConvite(texto(d), AGORA);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.convite).toEqual({
      grupo: "Grupo de Teste",
      hub: "hub.exemplo:51820",
      chavePublicaHub: HUB,
      ipProvisorio: "10.66.0.200",
      chavePrivadaProvisoria: PRIV,
      codigo: d.c,
      portaCartorio: 7710,
      venceEm: d.e * 1000,
    });
  });

  it("aceita espaços e quebras de linha em volta (colar do WhatsApp)", () => {
    expect(lerConvite(`  \n${texto(dadosBons())}\n `, AGORA).ok).toBe(true);
  });

  it("recusa convite vencido com mensagem clara", () => {
    const r = lerConvite(texto(dadosBons({ e: Math.floor(AGORA / 1000) - 1 })), AGORA);
    expect(r).toMatchObject({ ok: false, motivo: "vencido" });
    if (!r.ok) expect(r.mensagem).toMatch(/venceu|vencid/i);
  });

  it.each([
    ["vazio", ""],
    ["texto qualquer", "oi, tudo bem?"],
    ["esquema errado", "http://convite/1.abc"],
    ["sem ponto", "sabre://convite/1abc"],
    ["base64 torto", "sabre://convite/1.@@@@"],
    ["json torto", `sabre://convite/1.${Buffer.from("{nao").toString("base64url")}`],
    ["json que não é objeto", texto([1, 2])],
  ])("recusa texto torto (%s) como 'torto'", (_n, t) => {
    const r = lerConvite(t, AGORA);
    expect(r).toMatchObject({ ok: false, motivo: "torto" });
  });

  it("recusa versão diferente de 1 dizendo para atualizar o app", () => {
    const r = lerConvite(texto(dadosBons()).replace("/1.", "/2."), AGORA);
    expect(r).toMatchObject({ ok: false, motivo: "versao" });
    if (!r.ok) expect(r.mensagem).toMatch(/atualiz/i);
  });

  it("recusa texto gigante antes de decodificar", () => {
    const r = lerConvite(`sabre://convite/1.${"A".repeat(5000)}`, AGORA);
    expect(r).toMatchObject({ ok: false, motivo: "torto" });
  });

  it.each([
    ["grupo vazio", { g: "" }],
    ["grupo com quebra de linha", { g: "a\nb" }],
    ["hub sem porta", { h: "hub.exemplo" }],
    ["hub com injeção", { h: "hub.exemplo:51820\nPostUp = x" }],
    ["chave do hub torta", { k: "abc" }],
    ["ip fora da sala de entrada", { i: "10.66.0.5" }],
    ["ip de outra rede", { i: "192.168.0.200" }],
    ["chave privada torta", { p: "abc" }],
    ["código vazio", { c: "" }],
    ["código com símbolo", { c: "a b/c" }],
    ["porta zero", { a: 0 }],
    ["porta grande", { a: 70000 }],
    ["porta em texto", { a: "7710" }],
    ["prazo em texto", { e: "amanhã" }],
    ["prazo não inteiro", { e: 1.5 }],
  ])("recusa campo inválido: %s", (_n, extra) => {
    const r = lerConvite(texto(dadosBons(extra)), AGORA);
    expect(r).toMatchObject({ ok: false, motivo: "torto" });
  });

  it("recusa campo que falta", () => {
    const semCodigo: Record<string, unknown> = dadosBons();
    delete semCodigo.c;
    expect(lerConvite(texto(semCodigo), AGORA)).toMatchObject({ ok: false, motivo: "torto" });
  });

  it("a mensagem de erro nunca repete o texto, o código nem as chaves", () => {
    const d = dadosBons({ i: "10.66.0.5" });
    const t = texto(d);
    for (const entrada of [t, texto(dadosBons({ e: 1 })), t.replace("/1.", "/9.")]) {
      const r = lerConvite(entrada, AGORA);
      expect(r.ok).toBe(false);
      if (r.ok) continue;
      const tudo = JSON.stringify(r);
      for (const segredo of [d.c, PRIV, HUB, entrada, entrada.split(".")[1] ?? "x"])
        expect(tudo).not.toContain(segredo);
    }
  });
});
