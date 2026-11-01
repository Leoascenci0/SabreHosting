import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { IP_DO_HUB } from "@sabrehosting/nucleo/rede/wireguard";
import { ambienteLegado, falhaSemPastaDoServidor, lerConfigPc } from "./config-pc.js";

let dados: string;
beforeEach(() => void (dados = mkdtempSync(join(tmpdir(), "sabre-cfg-"))));
afterEach(() => rmSync(dados, { recursive: true, force: true }));

const gravar = (o: unknown): void =>
  writeFileSync(join(dados, "boas-vindas.json"), JSON.stringify(o));
const cofreCom = (t: string | undefined) => ({ ler: async () => t });
const BASE = join(tmpdir(), "SabreBase");

describe("lerConfigPc: tudo vem da config gravada e do cofre, nunca do ambiente", () => {
  it("assistente concluído: endereço do cartório, token e pastas derivados", async () => {
    gravar({
      grupo: { nome: "Amigos", endereco: "jogar.exemplo.org:25565" },
      portaCartorio: 7710,
      concluido: true,
      pastaBase: BASE,
    });
    const c = await lerConfigPc(dados, cofreCom("tk-cofre"), {});
    expect(c).toMatchObject({
      urlCartorio: `http://${IP_DO_HUB}:7710`,
      token: "tk-cofre",
      grupo: "Amigos",
      enderecoGravado: "jogar.exemplo.org:25565",
      pastaBase: BASE,
      pastaServidor: join(BASE, "servidor"),
      pastaMundo: join(BASE, "servidor", "world"),
      pastaBackups: join(BASE, "mundos"),
    });
  });

  it("variáveis SABRE_* do ambiente não mudam nada (só Java/NeoForge, sem instalador ainda)", async () => {
    const c = await lerConfigPc(dados, cofreCom(undefined), {
      SABRE_CARTORIO_URL: "https://fora.exemplo.net",
      SABRE_CARTORIO_TOKEN: "do-ambiente",
      SABRE_ENDERECO: "x:1",
      SABRE_PASTA_SERVIDOR: "/fora",
      SABRE_JAVA: "java",
      SABRE_NEOFORGE: "21.1.1",
    });
    expect(c.urlCartorio).toBeUndefined();
    expect(c.token).toBeUndefined();
    expect(c.enderecoGravado).toBeUndefined();
    expect(c.pastaServidor).toBeUndefined();
    expect(c.java).toBeUndefined();
    expect(c.neoforge).toBeUndefined();
  });

  it("modo teste: Java/NeoForge do ambiente valem; fora dele (app empacotado) são ignorados", async () => {
    const env = { SABRE_JAVA: "java", SABRE_NEOFORGE: "21.1.1" };
    expect(await lerConfigPc(dados, cofreCom(undefined), env, true)).toMatchObject({
      java: "java",
      neoforge: "21.1.1",
    });
    const c = await lerConfigPc(dados, cofreCom(undefined), env, false);
    expect(c.java).toBeUndefined();
    expect(c.neoforge).toBeUndefined();
  });

  describe("level-name do server.properties", () => {
    const concluido = (): void =>
      gravar({ grupo: { nome: "A" }, portaCartorio: 7710, concluido: true, pastaBase: BASE });
    const props = (conteudo: string): void => {
      // A pasta do app não é a do servidor: o servidor fica em BASE/servidor, então o teste usa a base dentro de `dados`.
      mkdirSync(join(dados, "base", "servidor"), { recursive: true });
      writeFileSync(join(dados, "base", "servidor", "server.properties"), conteudo);
    };
    const comBase = (): void =>
      gravar({
        grupo: { nome: "A" },
        portaCartorio: 7710,
        concluido: true,
        pastaBase: join(dados, "base"),
      });

    it("level-name diferente aponta o mundo certo", async () => {
      props("motd=oi\nlevel-name=Mundo dos Amigos\n");
      comBase();
      const c = await lerConfigPc(dados, cofreCom("t"), {});
      expect(c.pastaMundo).toBe(join(dados, "base", "servidor", "Mundo dos Amigos"));
    });

    it("sem server.properties ou sem level-name: world", async () => {
      concluido();
      expect((await lerConfigPc(dados, cofreCom("t"), {})).pastaMundo).toBe(
        join(BASE, "servidor", "world"),
      );
      props("motd=oi\n");
      comBase();
      expect((await lerConfigPc(dados, cofreCom("t"), {})).pastaMundo).toBe(
        join(dados, "base", "servidor", "world"),
      );
    });

    it.each(["../fora", "a/b", "a\\b", "/abs", "..", ".", "C:\\x", ""])(
      "nome torto %j vira world (S-07)",
      async (nome) => {
        props(`level-name=${nome}\n`);
        comBase();
        const c = await lerConfigPc(dados, cofreCom("t"), {});
        expect(c.pastaMundo).toBe(join(dados, "base", "servidor", "world"));
      },
    );
  });

  it("entrou no grupo mas não concluiu a pasta: tem cartório, não tem pastas", async () => {
    gravar({ grupo: { nome: "Amigos" }, portaCartorio: 7710 });
    const c = await lerConfigPc(dados, cofreCom("t"), {});
    expect(c.urlCartorio).toBe(`http://${IP_DO_HUB}:7710`);
    expect(c.pastaBase).toBeUndefined();
    expect(c.pastaServidor).toBeUndefined();
  });

  it("sem cofre (ou cofre que falha): sem token, e o app diz 'sem grupo' como antes", async () => {
    gravar({ grupo: { nome: "A" }, portaCartorio: 7710, concluido: true, pastaBase: BASE });
    const falha = { ler: async () => Promise.reject(new Error("cofre quebrado: segredo")) };
    expect((await lerConfigPc(dados, falha, {})).token).toBeUndefined();
    expect((await lerConfigPc(dados, cofreCom(undefined), {})).token).toBeUndefined();
  });

  it.each([0, 70000, 7710.5, "7710", null])(
    "porta torta %j é ignorada (sem cartório)",
    async (p) => {
      gravar({ grupo: { nome: "A" }, portaCartorio: p });
      expect((await lerConfigPc(dados, cofreCom("t"), {})).urlCartorio).toBeUndefined();
    },
  );

  it("PC sem arquivo nenhum: tudo ausente", async () => {
    const c = await lerConfigPc(dados, cofreCom("t"), {});
    expect(c.urlCartorio).toBeUndefined();
    expect(c.token).toBeUndefined();
  });
});

describe("arquivo adulterado não vira pasta nem endereço (S-07)", () => {
  it.each([
    "../fora",
    "relativa/pasta",
    "/",
    "C:\\Windows\\System32",
    "C:\\",
    `${BASE}/../outra`,
    42,
  ])("pastaBase %j é tratada como ausente (nada para apagar ou trocar)", async (pastaBase) => {
    gravar({ grupo: { nome: "A" }, portaCartorio: 7710, concluido: true, pastaBase });
    const c = await lerConfigPc(dados, cofreCom("t"), {});
    expect(c.pastaBase).toBeUndefined();
    expect(c.pastaServidor).toBeUndefined();
    expect(c.pastaMundo).toBeUndefined();
    expect(c.pastaBackups).toBeUndefined();
  });

  it.each(["host", "a b:1", "-x:1", "h:99999x", "x:1 --demo", ""])(
    "endereço gravado %j é ignorado",
    async (endereco) => {
      gravar({ grupo: { nome: "A", endereco }, portaCartorio: 7710 });
      expect((await lerConfigPc(dados, cofreCom("t"), {})).enderecoGravado).toBeUndefined();
    },
  );
});

describe("ambienteLegado (para quem ainda lê no formato SABRE_*)", () => {
  it("monta as variáveis da config, sem nada do process.env", async () => {
    gravar({ grupo: { nome: "A" }, portaCartorio: 7710, concluido: true, pastaBase: BASE });
    const c = await lerConfigPc(dados, cofreCom("tk"), {});
    expect(ambienteLegado(c)).toEqual({
      SABRE_CARTORIO_URL: `http://${IP_DO_HUB}:7710`,
      SABRE_CARTORIO_TOKEN: "tk",
      SABRE_PASTA_SERVIDOR: join(BASE, "servidor"),
      SABRE_PASTA_MUNDO: join(BASE, "servidor", "world"),
      SABRE_PASTA_BACKUPS: join(BASE, "mundos"),
    });
  });

  it("cofre corrompido: sem token, mas a config avisa (assistente pede convite novo)", async () => {
    gravar({ grupo: { nome: "G" }, portaCartorio: 7710 });
    const leitor = {
      ler: async () => undefined,
      estado: async () => ({ tipo: "corrompido" as const }),
    };
    const c = await lerConfigPc(dados, leitor, {});
    expect(c.token).toBeUndefined();
    expect(c.cofreCorrompido).toBe(true);
    const ausente = {
      ler: async () => undefined,
      estado: async () => ({ tipo: "ausente" as const }),
    };
    expect((await lerConfigPc(dados, ausente, {})).cofreCorrompido).toBeUndefined();
  });
});

describe("falhaSemPastaDoServidor: instalação nova não assusta o amigo", () => {
  it("assistente ainda não concluído (primeira vez): sem aviso", () => {
    expect(falhaSemPastaDoServidor(dados)).toBeUndefined();
  });
  it("assistente concluído mas sem pasta utilizável: avisa", () => {
    gravar({ concluido: true, pastaBase: "..", grupo: { nome: "A", endereco: "a:1" } });
    expect(falhaSemPastaDoServidor(dados)).toMatch(/pasta do servidor não está configurada/);
  });
});
