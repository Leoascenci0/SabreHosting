import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type Banco, MIGRACOES, abrirBanco } from "./banco.js";
import { type ModGrupo, gravarMods, lerMods } from "./mods.js";
import { hashSegredo } from "./segredo.js";
import { criarCartorio } from "./servidor.js";

const SHA512 = "b".repeat(128);
const pastas: string[] = [];
const fechar: Array<() => unknown> = [];

afterEach(async () => {
  for (const f of fechar.splice(0).reverse()) await Promise.resolve(f()).catch(() => undefined);
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

const mod = (extra: Partial<ModGrupo> = {}): ModGrupo => ({
  nome: "Sodium",
  versao: "0.6.0",
  arquivo: "sodium-0.6.0.jar",
  url: "https://cdn.modrinth.com/data/AANobbMI/versions/x/sodium-0.6.0.jar",
  sha512: SHA512,
  lado: "cliente",
  ...extra,
});

/** Banco novo com 3 PCs (1 = dono) e token ativo (`tok-N`). */
function montarBanco(): Banco {
  const pasta = mkdtempSync(join(tmpdir(), "sabre-mods-"));
  pastas.push(pasta);
  const banco = abrirBanco(join(pasta, "c.db"));
  fechar.push(() => {
    if (banco.isOpen) banco.close();
  });
  for (let i = 1; i <= 3; i++) {
    banco
      .prepare("INSERT INTO pcs (nome, criado_em, dono) VALUES (?, 0, ?)")
      .run(`PC ${i}`, i === 1 ? 1 : 0);
    banco
      .prepare("INSERT INTO tokens (hash, pc_id, criado_em) VALUES (?, ?, 0)")
      .run(hashSegredo(`tok-${i}`), i);
  }
  return banco;
}

describe("mods do grupo: banco", () => {
  it("migração 9 → 10 mantém os dados e a lista começa vazia", () => {
    const pasta = mkdtempSync(join(tmpdir(), "sabre-mods-m-"));
    pastas.push(pasta);
    const caminho = join(pasta, "m.db");
    const v9 = abrirBanco(caminho, MIGRACOES.slice(0, 9));
    v9.exec("INSERT INTO pcs (id, nome, criado_em) VALUES (1, 'Ana', 10)");
    v9.close();
    const banco = abrirBanco(caminho);
    fechar.push(() => banco.close());
    expect(banco.prepare("SELECT versao FROM esquema").get()).toEqual({ versao: 10 });
    expect(banco.prepare("SELECT nome FROM pcs").get()).toEqual({ nome: "Ana" });
    expect(lerMods(banco)).toEqual([]);
  });

  it("o dono grava e a lista volta igual; gravar de novo troca a lista inteira", () => {
    const banco = montarBanco();
    expect(
      gravarMods(
        banco,
        1,
        [mod(), mod({ nome: "Lithium", arquivo: "lithium.jar", lado: "ambos" })],
        5,
      ),
    ).toEqual({ ok: true });
    expect(lerMods(banco).map((m) => m.nome)).toEqual(["Lithium", "Sodium"]);
    expect(gravarMods(banco, 1, [mod({ nome: "Iris", arquivo: "iris.jar" })], 6)).toEqual({
      ok: true,
    });
    expect(lerMods(banco).map((m) => m.nome)).toEqual(["Iris"]);
    expect(gravarMods(banco, 1, [], 7)).toEqual({ ok: true });
    expect(lerMods(banco)).toEqual([]);
  });

  it("quem não é dono não grava e a lista fica como estava", () => {
    const banco = montarBanco();
    gravarMods(banco, 1, [mod()], 5);
    expect(gravarMods(banco, 2, [], 6)).toEqual({ ok: false, motivo: "nao_e_dono" });
    expect(lerMods(banco)).toHaveLength(1);
  });

  it.each([
    ["host fora da lista", { url: "https://exemplo.com/a.jar" }],
    ["http puro", { url: "http://cdn.modrinth.com/a.jar" }],
    ["host disfarçado", { url: "https://cdn.modrinth.com.exemplo.com/a.jar" }],
    ["credencial na url", { url: "https://cdn.modrinth.com@exemplo.com/a.jar" }],
    ["hash curto", { sha512: "abc" }],
    ["arquivo com barra", { arquivo: "../x.jar" }],
    ["arquivo com barra invertida", { arquivo: "a\\b.jar" }],
    ["arquivo que não é jar", { arquivo: "x.exe" }],
    ["lado desconhecido", { lado: "nuvem" as never }],
  ])("recusa %s e não grava nada", (_t, extra) => {
    const banco = montarBanco();
    gravarMods(banco, 1, [mod({ nome: "Antigo", arquivo: "antigo.jar" })], 5);
    expect(gravarMods(banco, 1, [mod(extra)], 6)).toEqual({ ok: false, motivo: "invalida" });
    expect(lerMods(banco).map((m) => m.nome)).toEqual(["Antigo"]);
  });

  it("recusa arquivo repetido (mesmo arquivo, nomes diferentes) e lista grande demais", () => {
    const banco = montarBanco();
    expect(gravarMods(banco, 1, [mod(), mod({ nome: "Outro" })], 5)).toEqual({
      ok: false,
      motivo: "invalida",
    });
    const muitos = Array.from({ length: 201 }, (_, i) =>
      mod({ nome: `m${i}`, arquivo: `m${i}.jar` }),
    );
    expect(gravarMods(banco, 1, muitos, 5)).toEqual({ ok: false, motivo: "invalida" });
  });
});

describe("mods do grupo: HTTP", () => {
  function montarApp() {
    const banco = montarBanco();
    const app = criarCartorio({ banco, logger: { level: "silent" }, agora: () => 1_000_000 });
    fechar.push(() => app.close());
    const h = (n: number) => ({ authorization: `Bearer tok-${n}` });
    return { app, h };
  }

  it("sem token → 401", async () => {
    const { app } = montarApp();
    expect((await app.inject({ url: "/grupo/mods" })).statusCode).toBe(401);
    const put = await app.inject({ method: "PUT", url: "/grupo/mods", payload: { mods: [] } });
    expect(put.statusCode).toBe(401);
  });

  it("só o dono grava (403 para os outros); qualquer PC com token lê", async () => {
    const { app, h } = montarApp();
    const outro = await app.inject({
      method: "PUT",
      url: "/grupo/mods",
      headers: h(2),
      payload: { mods: [mod()] },
    });
    expect(outro.statusCode).toBe(403);
    expect(outro.json().erro).toMatch(/dono/);
    const dono = await app.inject({
      method: "PUT",
      url: "/grupo/mods",
      headers: h(1),
      payload: { mods: [mod()] },
    });
    expect(dono.statusCode).toBe(200);
    const lido = await app.inject({ url: "/grupo/mods", headers: h(3) });
    expect(lido.json()).toEqual({ mods: [mod()] });
  });

  it("lista inválida → 400 com mensagem em pt-BR", async () => {
    const { app, h } = montarApp();
    const r = await app.inject({
      method: "PUT",
      url: "/grupo/mods",
      headers: h(1),
      payload: { mods: [mod({ url: "https://exemplo.com/a.jar" })] },
    });
    expect(r.statusCode).toBe(400);
    expect(r.json().erro).toMatch(/Modrinth/);
  });
});
