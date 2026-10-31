import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { DatabaseSync } from "node:sqlite";
import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import {
  MIGRACOES,
  abrirBanco,
  apagarConvitesVencidos,
  criarConvite,
  usarConvite,
} from "./banco.js";
import { gerarSegredo } from "./segredo.js";
import { conferirEndereco, criarCartorio, criarLimitador } from "./servidor.js";

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
  const banco = abrirBanco(join(pasta, "cartorio.db"));
  const app = criarCartorio({
    banco,
    logger: { level: "trace", stream: log },
    agora: () => relogio.agora,
  });
  fechar.push(() => app.close());
  /** Convite sem sala de entrada (o caminho com ajudante e dono está em convite.test.ts). */
  function convidar(nomePc = "PC de teste", validadeMinutos = 30) {
    return Promise.resolve(criarConvite(banco, nomePc, relogio.agora, validadeMinutos * 60_000));
  }
  function usar(convite: string) {
    return app.inject({ method: "POST", url: "/convites/usar", payload: { convite } });
  }
  return { app, pasta, linhasDoLog, convidar, usar, relogio };
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

  // Quebra declarada (cart-1.5): o segredo de administrador saiu da rota; só o token de um PC dono cria convite.
  it("POST /convites: sem token → 401; token de PC que não é dono → 403", async () => {
    const { app, convidar, usar } = montar();
    const semToken = await app.inject({
      method: "POST",
      url: "/convites",
      payload: { nomePc: "x" },
    });
    expect(semToken.statusCode).toBe(401);
    const corpoInvalido = await app.inject({ method: "POST", url: "/convites", payload: {} });
    expect(corpoInvalido.statusCode).toBe(401);
    const { token } = (await usar(await convidar())).json<{ token: string }>();
    const comTokenDePc = await app.inject({
      method: "POST",
      url: "/convites",
      headers: { authorization: `Bearer ${token}` },
      payload: { nomePc: "x" },
    });
    expect(comTokenDePc.statusCode).toBe(403);
  });

  it("token e convite em claro não aparecem no arquivo do banco nem no log", async () => {
    const { app, pasta, linhasDoLog, convidar, usar } = montar();
    const convite = await convidar();
    const { token } = (await usar(convite)).json<{ token: string }>();
    await app.inject({ url: "/eu", headers: { authorization: `Bearer ${token}` } });
    await app.close();

    const segredos = [token, convite];
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

  it("limpeza apaga só convite não usado vencido há mais de N dias; usado e vigente ficam", () => {
    const pasta = mkdtempSync(join(tmpdir(), "sabre-cartorio-"));
    pastas.push(pasta);
    const banco = abrirBanco(join(pasta, "cartorio.db"));
    const DIA = 86_400_000;
    const hoje = 100 * DIA;
    criarConvite(banco, "vencido há 8 dias", hoje - 9 * DIA, DIA);
    criarConvite(banco, "vencido há 6 dias", hoje - 7 * DIA, DIA);
    criarConvite(banco, "vigente", hoje, DIA);
    const usado = criarConvite(banco, "usado e vencido há muito", hoje - 50 * DIA, DIA);
    expect(usarConvite(banco, usado, hoje - 50 * DIA)).toBeDefined();

    expect(apagarConvitesVencidos(banco, hoje, 7)).toBe(1);
    const nomes = (
      banco.prepare("SELECT nome_pc FROM convites ORDER BY nome_pc").all() as Array<{
        nome_pc: string;
      }>
    ).map((l) => l.nome_pc);
    expect(nomes).toEqual(["usado e vencido há muito", "vencido há 6 dias", "vigente"]);
    expect(
      banco.prepare("SELECT count(*) AS n FROM convites WHERE pc_id IS NOT NULL").get(),
    ).toEqual({
      n: 1,
    });
    banco.close();
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
    expect(b.prepare("SELECT versao FROM esquema").all()).toEqual([{ versao: 7 }]);
    a.close();
    b.close();
    abrirBanco(caminho).close();
    expect(tabelas(caminho)).toEqual([
      "convites",
      "copias",
      "copias_nuvem",
      "esquema",
      "pcs",
      "tokens",
      "trava",
      "versoes",
    ]);
  });

  it("v1 → atual com PCs, tokens e convites já cadastrados preserva tudo e protege a trava", () => {
    const { pasta } = montar();
    const caminho = join(pasta, "m.db");
    const v1 = abrirBanco(caminho, MIGRACOES.slice(0, 1));
    v1.exec(`INSERT INTO pcs (id, nome, criado_em) VALUES (1, 'Ana', 10), (2, 'Bia', 20);
      INSERT INTO tokens (hash, pc_id, criado_em) VALUES ('h1', 1, 10), ('h2', 2, 20);
      INSERT INTO convites (hash, nome_pc, criado_em, expira_em) VALUES ('c1', 'Caio', 30, 40)`);
    v1.close();
    const banco = abrirBanco(caminho);
    expect(banco.prepare("SELECT versao FROM esquema").all()).toEqual([{ versao: 7 }]);
    expect(banco.prepare("SELECT id, nome, criado_em FROM pcs ORDER BY id").all()).toEqual([
      { id: 1, nome: "Ana", criado_em: 10 },
      { id: 2, nome: "Bia", criado_em: 20 },
    ]);
    expect(banco.prepare("SELECT hash, pc_id FROM tokens ORDER BY hash").all()).toEqual([
      { hash: "h1", pc_id: 1 },
      { hash: "h2", pc_id: 2 },
    ]);
    expect(banco.prepare("SELECT hash, nome_pc FROM convites").all()).toEqual([
      { hash: "c1", nome_pc: "Caio" },
    ]);
    expect(banco.prepare("SELECT id, dono_pc_id, epoca FROM trava").all()).toEqual([
      { id: 1, dono_pc_id: null, epoca: 0 },
    ]);
    expect(() => banco.exec("INSERT OR REPLACE INTO trava (id) VALUES (1)")).toThrow();
    banco.close();
  });

  it("v6 → v7 com a trava em uso preserva dono e época e passa a barrar época que não é inteira", () => {
    const { pasta } = montar();
    const caminho = join(pasta, "m.db");
    const v6 = abrirBanco(caminho, MIGRACOES.slice(0, 6));
    v6.exec(`INSERT INTO pcs (id, nome, criado_em) VALUES (1, 'Ana', 10);
      UPDATE trava SET dono_pc_id = 1, expira_em = 500, epoca = 3`);
    v6.close();
    const banco = abrirBanco(caminho);
    expect(banco.prepare("SELECT versao FROM esquema").all()).toEqual([{ versao: 7 }]);
    expect(banco.prepare("SELECT dono_pc_id, expira_em, epoca FROM trava").all()).toEqual([
      { dono_pc_id: 1, expira_em: 500, epoca: 3 },
    ]);
    expect(() => banco.exec("UPDATE trava SET epoca = 'abc'")).toThrow(/inteiro/);
    banco.exec("UPDATE trava SET epoca = 4");
    expect(banco.prepare("SELECT epoca FROM trava").get()).toEqual({ epoca: 4 });
    banco.close();
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

  it("recusa IP público, IPv4 mapeado em IPv6, CGNAT e link-local; aceita só loopback e faixas privadas", () => {
    for (const e of [
      "8.8.8.8",
      "200.160.2.3",
      "2001:4860:4860::8888",
      "::ffff:10.66.0.1",
      "::ffff:127.0.0.1",
      "100.64.0.1",
      "169.254.1.1",
      "fe80::1",
      "172.32.0.1",
    ]) {
      expect(() => conferirEndereco(e), e).toThrow(/recusado/);
    }
    for (const e of ["127.0.0.1", "127.1.2.3", "::1", "10.66.0.1", "172.16.0.1", "172.31.255.1"]) {
      expect(conferirEndereco(e)).toBe(e);
    }
    for (const e of ["192.168.1.1", "fd00::1", "fc00::1"]) expect(conferirEndereco(e)).toBe(e);
  });
});

describe("cartório: entrada endurecida", () => {
  it("corpo JSON de 10 KB → 413, antes de chegar à rota", async () => {
    const { app } = montar();
    const r = await app.inject({
      method: "POST",
      url: "/convites/usar",
      payload: { convite: "x", lixo: "a".repeat(10 * 1024) },
    });
    expect(r.statusCode).toBe(413);
  });

  it("20 convites errados do mesmo IP → a 21ª tentativa é 429, mesmo com o convite certo", async () => {
    const { app, convidar, usar } = montar();
    const bom = await convidar();
    for (let i = 0; i < 20; i++) expect((await usar(gerarSegredo())).statusCode).toBe(401);
    const barrado = await usar(bom);
    expect(barrado.statusCode).toBe(429);
    expect(barrado.json<{ erro: string }>().erro).toMatch(/tentativas/);
    // Outro IP não paga pelo primeiro.
    const outro = await app.inject({
      method: "POST",
      url: "/convites/usar",
      payload: { convite: bom },
      remoteAddress: "10.66.0.9",
    });
    expect(outro.statusCode).toBe(200);
  });

  it("token errado conta junto com convite errado; barrado antes de olhar o token", async () => {
    const { app, convidar, usar } = montar();
    const { token } = (await usar(await convidar())).json<{ token: string }>();
    const auth = (t: string) => ({ authorization: `Bearer ${t}` });
    for (let i = 0; i < 10; i++) expect((await usar(gerarSegredo())).statusCode).toBe(401);
    for (let i = 0; i < 5; i++)
      expect((await app.inject({ url: "/eu", headers: auth(gerarSegredo()) })).statusCode).toBe(
        401,
      );
    for (let i = 0; i < 5; i++)
      expect((await app.inject({ url: "/trava", headers: auth(gerarSegredo()) })).statusCode).toBe(
        401,
      );
    expect((await app.inject({ url: "/trava", headers: auth(token) })).statusCode).toBe(429);
    expect((await app.inject({ url: "/eu", headers: auth(token) })).statusCode).toBe(429);
  });

  it("token errado no POST /convites conta no mesmo limite e é barrado antes de conferir", async () => {
    const { app, convidar, usar } = montar();
    const { token } = (await usar(await convidar())).json<{ token: string }>();
    const criar = (t: string) =>
      app.inject({
        method: "POST",
        url: "/convites",
        headers: { authorization: `Bearer ${t}` },
        payload: { nomePc: "pc" },
      });
    for (let i = 0; i < 20; i++) expect((await criar(gerarSegredo())).statusCode).toBe(401);
    expect((await criar(token)).statusCode).toBe(429);
  });

  it("limitador tira do mapa as entradas vencidas de qualquer IP", () => {
    const relogio = { agora: 0 };
    const limite = criarLimitador(() => relogio.agora);
    for (let i = 0; i < 100; i++) limite.contarFalha(`10.66.0.${i}`);
    expect(limite.tamanho()).toBe(100);
    relogio.agora = 15 * 60_000 - 1;
    limite.contarFalha("10.66.1.1");
    expect(limite.tamanho()).toBe(101);
    relogio.agora = 15 * 60_000;
    limite.contarFalha("10.66.1.2");
    expect(limite.tamanho()).toBe(2);
  });

  it("acerto não conta nem zera; passada a janela de 15 min, o IP volta a entrar", async () => {
    const { app, convidar, usar, relogio } = montar();
    const { token } = (await usar(await convidar())).json<{ token: string }>();
    const eu = (t: string) => app.inject({ url: "/eu", headers: { authorization: `Bearer ${t}` } });
    for (let i = 0; i < 19; i++) expect((await eu(gerarSegredo())).statusCode).toBe(401);
    for (let i = 0; i < 30; i++) expect((await eu(token)).statusCode).toBe(200);
    expect((await eu(gerarSegredo())).statusCode).toBe(401); // a 20ª falha
    expect((await eu(token)).statusCode).toBe(429);
    relogio.agora += 15 * 60_000 - 1;
    expect((await eu(token)).statusCode).toBe(429);
    relogio.agora += 1;
    expect((await eu(token)).statusCode).toBe(200);
  });
});
