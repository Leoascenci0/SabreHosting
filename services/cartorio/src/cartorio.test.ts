import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { abrirBanco, criarConvite, usarConvite } from "./banco.js";
import { gerarSegredo } from "./segredo.js";
import { conferirEndereco, criarCartorio } from "./servidor.js";

const pastas: string[] = [];
const fechar: Array<() => Promise<unknown>> = [];

afterEach(async () => {
  for (const f of fechar.splice(0)) await f();
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true });
});

function montar(relogio = { agora: 1_000_000 }) {
  const pasta = mkdtempSync(join(tmpdir(), "sabre-cartorio-"));
  pastas.push(pasta);
  const linhasDoLog: string[] = [];
  const log = new Writable({
    write(pedaco, _cod, pronto) {
      linhasDoLog.push(String(pedaco));
      pronto();
    },
  });
  const segredoAdmin = gerarSegredo();
  const app = criarCartorio({
    banco: abrirBanco(join(pasta, "cartorio.db")),
    segredoAdmin,
    logger: { level: "trace", stream: log },
    agora: () => relogio.agora,
  });
  fechar.push(() => app.close());
  const admin = { authorization: `Bearer ${segredoAdmin}` };
  async function convidar(nomePc = "PC de teste", validadeMinutos?: number) {
    const r = await app.inject({
      method: "POST",
      url: "/convites",
      headers: admin,
      payload: { nomePc, validadeMinutos },
    });
    expect(r.statusCode).toBe(201);
    return r.json<{ convite: string }>().convite;
  }
  function usar(convite: string) {
    return app.inject({ method: "POST", url: "/convites/usar", payload: { convite } });
  }
  return { app, pasta, linhasDoLog, segredoAdmin, convidar, usar, relogio };
}

describe("cartório: saúde e token", () => {
  it("GET /saude responde sem token", async () => {
    const { app } = montar();
    expect((await app.inject({ url: "/saude" })).statusCode).toBe(200);
  });

  it("sem token ou com token inválido → 401; token válido → 200 com o PC", async () => {
    const { app, convidar, usar } = montar();
    expect((await app.inject({ url: "/eu" })).statusCode).toBe(401);
    const invalido = { authorization: `Bearer ${gerarSegredo()}` };
    expect((await app.inject({ url: "/eu", headers: invalido })).statusCode).toBe(401);
    const basic = { authorization: "Basic x" };
    expect((await app.inject({ url: "/eu", headers: basic })).statusCode).toBe(401);

    const r = await usar(await convidar("PC da Ana"));
    expect(r.statusCode).toBe(200);
    const { token } = r.json<{ token: string }>();
    const eu = await app.inject({ url: "/eu", headers: { authorization: `Bearer ${token}` } });
    expect(eu.statusCode).toBe(200);
    expect(eu.json()).toMatchObject({ nome: "PC da Ana" });
  });

  it("POST /convites exige o segredo de administrador", async () => {
    const { app, convidar, usar } = montar();
    const semAdmin = await app.inject({
      method: "POST",
      url: "/convites",
      payload: { nomePc: "x" },
    });
    expect(semAdmin.statusCode).toBe(401);
    const corpoInvalido = await app.inject({ method: "POST", url: "/convites", payload: {} });
    expect(corpoInvalido.statusCode).toBe(401);
    const { token } = (await usar(await convidar())).json<{ token: string }>();
    const comTokenDePc = await app.inject({
      method: "POST",
      url: "/convites",
      headers: { authorization: `Bearer ${token}` },
      payload: { nomePc: "x" },
    });
    expect(comTokenDePc.statusCode).toBe(401);
  });

  it("token e convite em claro não aparecem no arquivo do banco nem no log", async () => {
    const { app, pasta, linhasDoLog, segredoAdmin, convidar, usar } = montar();
    const convite = await convidar();
    const { token } = (await usar(convite)).json<{ token: string }>();
    await app.inject({ url: "/eu", headers: { authorization: `Bearer ${token}` } });
    await app.close();

    const segredos = [token, convite, segredoAdmin];
    for (const arquivo of readdirSync(pasta)) {
      const bytes = readFileSync(join(pasta, arquivo)).toString("latin1");
      for (const s of segredos) expect(bytes).not.toContain(s);
    }
    const log = linhasDoLog.join("");
    expect(log.length).toBeGreaterThan(0);
    for (const s of segredos) expect(log).not.toContain(s);
  });
});

describe("cartório: convites", () => {
  it("convite usado duas vezes → recusado", async () => {
    const { convidar, usar } = montar();
    const convite = await convidar();
    expect((await usar(convite)).statusCode).toBe(200);
    expect((await usar(convite)).statusCode).toBe(401);
  });

  it("duas chamadas no mesmo processo (inject, em sequência pelo SQLite síncrono) → só a primeira passa", async () => {
    const { convidar, usar } = montar();
    const convite = await convidar();
    const codigos = (await Promise.all([usar(convite), usar(convite)])).map((r) => r.statusCode);
    expect(codigos.sort()).toEqual([200, 401]);
  });

  it("duas conexões ao mesmo arquivo, uma após a outra: o convite só vale numa", () => {
    const { pasta } = montar();
    const a = abrirBanco(join(pasta, "outro.db"));
    const b = abrirBanco(join(pasta, "outro.db"));
    const convite = criarConvite(a, "PC", 0, 60_000);
    expect(usarConvite(b, convite, 1)).toBeDefined();
    expect(usarConvite(a, convite, 2)).toBeUndefined();
    a.close();
    b.close();
  });

  it("convite vale até 1 ms antes de vencer", async () => {
    const { convidar, usar, relogio } = montar();
    const convite = await convidar("PC", 10);
    relogio.agora += 10 * 60_000 - 1;
    expect((await usar(convite)).statusCode).toBe(200);
  });

  it("convite vencido → recusado", async () => {
    const { convidar, usar, relogio } = montar();
    const convite = await convidar("PC", 10);
    relogio.agora += 10 * 60_000;
    expect((await usar(convite)).statusCode).toBe(401);
  });

  it("falha ao criar o token: convite continua sem uso e nenhum PC é criado", () => {
    const { pasta } = montar();
    const banco = abrirBanco(join(pasta, "falha.db"));
    const convite = criarConvite(banco, "PC", 0, 60_000);
    banco.exec(
      "CREATE TRIGGER falha BEFORE INSERT ON tokens BEGIN SELECT RAISE(ABORT, 'teste'); END",
    );
    expect(() => usarConvite(banco, convite, 1)).toThrow(/teste/);
    expect(banco.prepare("SELECT usado_em, pc_id FROM convites").get()).toEqual({
      usado_em: null,
      pc_id: null,
    });
    expect(banco.prepare("SELECT count(*) AS n FROM pcs").get()).toEqual({ n: 0 });
    banco.exec("DROP TRIGGER falha");
    expect(usarConvite(banco, convite, 2)).toBeDefined();
    banco.close();
  });

  it("convite inventado → recusado", async () => {
    const { usar } = montar();
    expect((await usar(gerarSegredo())).statusCode).toBe(401);
  });
});

describe("cartório: migrações", () => {
  function tabelas(caminho: string): string[] {
    const banco = new DatabaseSync(caminho);
    const nomes = banco
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name")
      .all()
      .map((l) => String(l["name"]));
    banco.close();
    return nomes;
  }

  it("abrir o mesmo banco de novo não repete a migração; duas conexões abertas juntas", () => {
    const { pasta } = montar();
    const caminho = join(pasta, "m.db");
    const a = abrirBanco(caminho);
    const b = abrirBanco(caminho);
    expect(b.prepare("SELECT versao FROM esquema").all()).toEqual([{ versao: 1 }]);
    a.close();
    b.close();
    abrirBanco(caminho).close();
    expect(tabelas(caminho)).toEqual(["convites", "esquema", "pcs", "tokens"]);
  });

  it("migração que falha no meio é desfeita inteira: versão não sobe, nenhuma tabela pela metade", () => {
    const { pasta } = montar();
    const caminho = join(pasta, "m.db");
    abrirBanco(caminho, ["CREATE TABLE a (x)"]).close();
    const quebrada = [
      "CREATE TABLE a (x)",
      "CREATE TABLE b (x); CREATE TABLE c (x); ISTO NAO E SQL",
    ];
    expect(() => abrirBanco(caminho, quebrada)).toThrow();
    expect(tabelas(caminho)).toEqual(["a", "esquema"]);
    const banco = new DatabaseSync(caminho);
    expect(banco.prepare("SELECT versao FROM esquema").all()).toEqual([{ versao: 1 }]);
    banco.close();
  });
});

describe("cartório: endereço de escuta", () => {
  it("recusa 0.0.0.0, :: (em qualquer grafia) e nome que não é IP; aceita IP privado", () => {
    for (const e of [
      "0.0.0.0",
      "::",
      "::0",
      "0:0:0:0:0:0:0:0",
      "::ffff:0.0.0.0",
      "::ffff:0:0",
      "localhost",
      "",
    ]) {
      expect(() => conferirEndereco(e)).toThrow();
    }
    expect(conferirEndereco("127.0.0.1")).toBe("127.0.0.1");
    expect(conferirEndereco("10.8.0.1")).toBe("10.8.0.1");
  });
});
