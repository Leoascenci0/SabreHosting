import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { type Banco, MIGRACOES, abrirBanco, criarConvite } from "./banco.js";
import { criarCartorio } from "./servidor.js";
import { pegar, renovar } from "./trava.js";
import { informarCopia, maisNova, quemTem, registrarVersao } from "./versoes.js";

const PRAZO = 60_000;
const SHA = "a".repeat(64);
const DADOS = { manifestoSha256: SHA, arquivos: 12, bytes: 3_456 };
const pastas: string[] = [];
const fechar: Array<() => unknown> = [];

afterEach(async () => {
  for (const f of fechar.splice(0)) await f();
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true });
});

function caminhoNovo() {
  const p = mkdtempSync(join(tmpdir(), "sabre-versoes-"));
  pastas.push(p);
  return join(p, "cartorio.db");
}

/** Banco novo com `n` PCs (ids 1..n), cada um com um token ativo. */
function montarBanco(n = 3): Banco {
  const banco = abrirBanco(caminhoNovo());
  fechar.push(() => banco.close());
  const inserir = banco.prepare("INSERT INTO pcs (nome, criado_em) VALUES (?, 0)");
  const token = banco.prepare("INSERT INTO tokens (hash, pc_id, criado_em) VALUES (?, ?, 0)");
  for (let i = 1; i <= n; i++) {
    inserir.run(`PC ${i}`);
    token.run(`hash-${i}`, i);
  }
  return banco;
}

function contar(banco: Banco, tabela: "versoes" | "copias") {
  return (banco.prepare(`SELECT count(*) AS n FROM ${tabela}`).get() as { n: number }).n;
}

describe("versões: só o dono da trava registra", () => {
  it("sem trava, outro dono, época velha ou trava vencida → recusa com motivo e nada gravado", () => {
    const banco = montarBanco();
    expect(registrarVersao(banco, 1, 0, 0, DADOS)).toMatchObject({
      ok: false,
      motivo: "nao_e_dono",
    });
    pegar(banco, 1, 0, PRAZO);
    expect(registrarVersao(banco, 1, 0, 1, DADOS)).toMatchObject({
      ok: false,
      motivo: "epoca_velha",
    });
    expect(registrarVersao(banco, 2, 1, 1, DADOS)).toMatchObject({
      ok: false,
      motivo: "nao_e_dono",
      donoPcId: 1,
    });
    expect(registrarVersao(banco, 1, 1, PRAZO, DADOS)).toMatchObject({
      ok: false,
      motivo: "vencida",
    });
    // Zumbi: o PC 2 pegou depois de vencer; o PC 1 volta com a época 1.
    expect(pegar(banco, 2, PRAZO, PRAZO)).toMatchObject({ ok: true, epoca: 2 });
    expect(registrarVersao(banco, 1, 1, PRAZO + 1, DADOS)).toMatchObject({
      ok: false,
      motivo: "epoca_velha",
    });
    expect(contar(banco, "versoes")).toBe(0);
    expect(contar(banco, "copias")).toBe(0);
  });

  it("mesmo PC pegou de novo (app reiniciou, época 1 → 2): envio com a época 1 com a trava valendo → recusa", () => {
    const banco = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    expect(pegar(banco, 1, 10, PRAZO)).toMatchObject({ ok: true, epoca: 2 });
    expect(registrarVersao(banco, 1, 1, 20, DADOS)).toMatchObject({
      ok: false,
      motivo: "epoca_velha",
      donoPcId: 1,
      epoca: 2,
    });
    expect(contar(banco, "versoes")).toBe(0);
    expect(contar(banco, "copias")).toBe(0);
    expect(registrarVersao(banco, 1, 2, 30, DADOS)).toEqual({ ok: true, numero: 1 });
  });

  it("vale até 1 ms antes de vencer; renovada, continua valendo", () => {
    const banco = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    expect(registrarVersao(banco, 1, 1, PRAZO - 1, DADOS)).toEqual({ ok: true, numero: 1 });
    renovar(banco, 1, 1, PRAZO - 1, PRAZO);
    expect(registrarVersao(banco, 1, 1, PRAZO + 10, DADOS)).toEqual({ ok: true, numero: 2 });
  });

  it("dois envios seguidos do dono → N e N+1; guarda época, PC e totais; o PC passa a ter a cópia", () => {
    const banco = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    expect(registrarVersao(banco, 1, 1, 10, DADOS)).toEqual({ ok: true, numero: 1 });
    expect(quemTem(banco, 1)).toEqual([{ id: 1, nome: "PC 1", ip: null }]);
    const outro = { manifestoSha256: "0123456789abcdef".repeat(4), arquivos: 0, bytes: 0 };
    expect(registrarVersao(banco, 1, 1, 20, outro)).toEqual({ ok: true, numero: 2 });
    expect(maisNova(banco)).toEqual({
      numero: 2,
      epoca: 1,
      pcId: 1,
      manifestoSha256: outro.manifestoSha256,
      arquivos: 0,
      bytes: 0,
      criadaEm: 20,
    });
    expect(quemTem(banco, 1)).toEqual([]);
    expect(quemTem(banco, 2)).toEqual([{ id: 1, nome: "PC 1", ip: null }]);
  });

  it("troca de host: a numeração continua no novo dono, sem buraco nem repetição", () => {
    const banco = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    registrarVersao(banco, 1, 1, 1, DADOS);
    pegar(banco, 2, PRAZO, PRAZO);
    expect(registrarVersao(banco, 2, 2, PRAZO + 1, DADOS)).toEqual({ ok: true, numero: 2 });
    expect(banco.prepare("SELECT numero, epoca, pc_id FROM versoes ORDER BY numero").all()).toEqual(
      [
        { numero: 1, epoca: 1, pc_id: 1 },
        { numero: 2, epoca: 2, pc_id: 2 },
      ],
    );
  });
});

describe("versões: o banco protege o histórico", () => {
  function comUmaVersao() {
    const banco = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    registrarVersao(banco, 1, 1, 1, DADOS);
    return banco;
  }

  it("UPDATE e DELETE em versoes falham e nada muda", () => {
    const banco = comUmaVersao();
    expect(() => banco.exec("UPDATE versoes SET numero = 9")).toThrow(/não muda/);
    expect(() => banco.exec("UPDATE versoes SET bytes = 0")).toThrow(/não muda/);
    expect(() => banco.exec("DELETE FROM versoes")).toThrow(/não se apaga/);
    expect(() => banco.exec("INSERT OR REPLACE INTO versoes SELECT * FROM versoes")).toThrow();
    expect(banco.prepare("SELECT numero, bytes FROM versoes").all()).toEqual([
      { numero: 1, bytes: 3_456 },
    ]);
  });

  it("INSERT direto com número repetido, com buraco ou sem número → recusado", () => {
    const banco = comUmaVersao();
    const inserir = (numero: number | null) =>
      banco
        .prepare(
          `INSERT INTO versoes (numero, epoca, pc_id, manifesto_sha256, arquivos, bytes, criada_em)
           VALUES (?, 1, 1, ?, 0, 0, 0)`,
        )
        .run(numero, SHA);
    expect(() => inserir(1)).toThrow();
    expect(() => inserir(3)).toThrow(/sem buraco/);
    expect(() => inserir(null)).toThrow(/sem buraco/);
    expect(contar(banco, "versoes")).toBe(1);
  });

  it("hash do manifesto fora do formato (tamanho, maiúscula, não hex) → recusado pelo banco", () => {
    const banco = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    for (const ruim of ["a".repeat(63), "A".repeat(64), "g".repeat(64), "a".repeat(65)]) {
      expect(() => registrarVersao(banco, 1, 1, 1, { ...DADOS, manifestoSha256: ruim })).toThrow();
    }
    expect(() => registrarVersao(banco, 1, 1, 1, { ...DADOS, bytes: -1 })).toThrow();
    // Decimal (1e30 não cabe em inteiro de 64 bits; 1,5 não é inteiro) seria gravado para sempre.
    for (const ruim of [1e30, 1.5]) {
      expect(() => registrarVersao(banco, 1, 1, 1, { ...DADOS, arquivos: ruim })).toThrow();
      expect(() => registrarVersao(banco, 1, 1, 1, { ...DADOS, bytes: ruim })).toThrow();
    }
    expect(() => registrarVersao(banco, 1, 1, 1.5, DADOS)).toThrow();
    expect(contar(banco, "versoes")).toBe(0);
    expect(contar(banco, "copias")).toBe(0);
  });
});

describe("cópias: quem tem qual versão", () => {
  it("informar versão inexistente → recusa e nada gravado", () => {
    const banco = montarBanco();
    expect(informarCopia(banco, 2, 1, 5)).toBe(false);
    pegar(banco, 1, 0, PRAZO);
    registrarVersao(banco, 1, 1, 1, DADOS);
    expect(informarCopia(banco, 2, 2, 5)).toBe(false);
    expect(quemTem(banco, 1)).toEqual([{ id: 1, nome: "PC 1", ip: null }]);
  });

  it("cada PC tem uma linha (a versão de agora); quemTem devolve só quem tem exatamente N", () => {
    const banco = montarBanco();
    expect(maisNova(banco)).toBeNull();
    pegar(banco, 1, 0, PRAZO);
    registrarVersao(banco, 1, 1, 1, DADOS);
    registrarVersao(banco, 1, 1, 2, DADOS);
    expect(informarCopia(banco, 3, 1, 10)).toBe(true);
    expect(informarCopia(banco, 2, 1, 11)).toBe(true);
    expect(quemTem(banco, 1)).toEqual([
      { id: 2, nome: "PC 2", ip: null },
      { id: 3, nome: "PC 3", ip: null },
    ]);
    expect(informarCopia(banco, 2, 2, 12)).toBe(true);
    expect(quemTem(banco, 1)).toEqual([{ id: 3, nome: "PC 3", ip: null }]);
    expect(quemTem(banco, 2)).toEqual([
      { id: 1, nome: "PC 1", ip: null },
      { id: 2, nome: "PC 2", ip: null },
    ]);
    expect(quemTem(banco, 99)).toEqual([]);
    expect(contar(banco, "copias")).toBe(3);
    expect(maisNova(banco)?.numero).toBe(2);
  });
});

describe("cópias: PC revogado não é fonte", () => {
  it("quemTem não lista PC com token revogado (nem o IP dele)", () => {
    const banco = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    registrarVersao(banco, 1, 1, 1, DADOS);
    informarCopia(banco, 2, 1, 10);
    banco.prepare("UPDATE tokens SET revogado_em = 20 WHERE pc_id = 2").run();
    expect(quemTem(banco, 1)).toEqual([{ id: 1, nome: "PC 1", ip: null }]);
  });
});

describe("versões: migração v3 → v4", () => {
  it("preserva PCs, tokens e trava (dono e época) e cria as tabelas vazias", () => {
    const caminho = caminhoNovo();
    const v3 = abrirBanco(caminho, MIGRACOES.slice(0, 3));
    v3.exec(`INSERT INTO pcs (id, nome, criado_em) VALUES (1, 'Ana', 10), (2, 'Bia', 20);
      INSERT INTO tokens (hash, pc_id, criado_em) VALUES ('h1', 1, 10), ('h2', 2, 20);
      UPDATE trava SET dono_pc_id = 2, expira_em = 999, epoca = 7`);
    v3.close();
    const banco = abrirBanco(caminho);
    fechar.push(() => banco.close());
    expect(banco.prepare("SELECT versao FROM esquema").all()).toEqual([{ versao: 9 }]);
    expect(banco.prepare("SELECT id, nome FROM pcs ORDER BY id").all()).toEqual([
      { id: 1, nome: "Ana" },
      { id: 2, nome: "Bia" },
    ]);
    expect(banco.prepare("SELECT hash, pc_id FROM tokens ORDER BY hash").all()).toEqual([
      { hash: "h1", pc_id: 1 },
      { hash: "h2", pc_id: 2 },
    ]);
    expect(banco.prepare("SELECT dono_pc_id, expira_em, epoca FROM trava").all()).toEqual([
      { dono_pc_id: 2, expira_em: 999, epoca: 7 },
    ]);
    expect(contar(banco, "versoes")).toBe(0);
    expect(contar(banco, "copias")).toBe(0);
    expect(registrarVersao(banco, 2, 7, 998, DADOS)).toEqual({ ok: true, numero: 1 });
  });
});

describe("versões: rotas do cartório", () => {
  async function montarApp() {
    const relogio = { agora: 1_000_000 };
    const banco = abrirBanco(caminhoNovo());
    const app = criarCartorio({
      banco,
      logger: { level: "silent" },
      agora: () => relogio.agora,
    });
    fechar.push(() => app.close());
    async function novoPc(nome: string) {
      const convite = criarConvite(banco, nome, relogio.agora, 60_000);
      const r = await app.inject({ method: "POST", url: "/convites/usar", payload: { convite } });
      return { authorization: `Bearer ${r.json<{ token: string }>().token}` };
    }
    return { app, banco, relogio, ana: await novoPc("Ana"), bia: await novoPc("Bia") };
  }

  it("sem token → 401 em todas as rotas de versão", async () => {
    const { app } = await montarApp();
    for (const [method, url] of [
      ["POST", "/versoes"],
      ["GET", "/versoes/mais-nova"],
      ["POST", "/copias"],
      ["GET", "/versoes/1/copias"],
    ] as const) {
      expect((await app.inject({ method, url, payload: {} })).statusCode).toBe(401);
    }
  });

  it("corpo fora do esquema → 400 e nada gravado", async () => {
    const { app, ana } = await montarApp();
    await app.inject({ method: "POST", url: "/trava/pegar", headers: ana });
    for (const payload of [
      { epoca: 1, manifestoSha256: "xyz", arquivos: 1, bytes: 1 },
      { epoca: 1, manifestoSha256: SHA, arquivos: -1, bytes: 1 },
      { epoca: 0, manifestoSha256: SHA, arquivos: 1, bytes: 1 },
      { epoca: 1, manifestoSha256: SHA, arquivos: 1 },
    ]) {
      const r = await app.inject({ method: "POST", url: "/versoes", headers: ana, payload });
      expect(r.statusCode).toBe(400);
    }
    const r = await app.inject({
      method: "POST",
      url: "/copias",
      headers: ana,
      payload: { versao: 0 },
    });
    expect(r.statusCode).toBe(400);
    const v = await app.inject({ url: "/versoes/mais-nova", headers: ana });
    expect(v.json()).toEqual({ versao: null });
  });

  it("número fora de inteiro exato (1e30, 2^53, -1, 1,5) em qualquer campo → 400 e nada gravado", async () => {
    const { app, ana } = await montarApp();
    const { epoca } = (
      await app.inject({ method: "POST", url: "/trava/pegar", headers: ana })
    ).json<{ epoca: number }>();
    const certo = { epoca, ...DADOS };
    for (const ruim of [1e30, 2 ** 53, -1, 1.5]) {
      for (const campo of ["epoca", "arquivos", "bytes"] as const) {
        const payload = { ...certo, [campo]: ruim };
        const r = await app.inject({ method: "POST", url: "/versoes", headers: ana, payload });
        expect(r.statusCode, `${campo} = ${ruim}`).toBe(400);
      }
      const c = await app.inject({
        method: "POST",
        url: "/copias",
        headers: ana,
        payload: { versao: ruim },
      });
      expect(c.statusCode, `versao = ${ruim}`).toBe(400);
      const q = await app.inject({ url: `/versoes/${ruim}/copias`, headers: ana });
      expect(q.statusCode, `:n = ${ruim}`).toBe(400);
    }
    expect((await app.inject({ url: "/versoes/mais-nova", headers: ana })).json()).toEqual({
      versao: null,
    });
    const r = await app.inject({ method: "POST", url: "/versoes", headers: ana, payload: certo });
    expect(r.json()).toEqual({ numero: 1 });
  });

  it("POST /versoes com a época anterior do mesmo PC (pegou a trava de novo) → 409 e nada gravado", async () => {
    const { app, ana } = await montarApp();
    const pegarTrava = async () =>
      (await app.inject({ method: "POST", url: "/trava/pegar", headers: ana })).json<{
        epoca: number;
      }>().epoca;
    const velha = await pegarTrava();
    expect(await pegarTrava()).toBe(velha + 1);
    const r = await app.inject({
      method: "POST",
      url: "/versoes",
      headers: ana,
      payload: { epoca: velha, ...DADOS },
    });
    expect(r.statusCode).toBe(409);
    expect(r.json()).toMatchObject({ motivo: "epoca_velha", epoca: velha + 1 });
    expect((await app.inject({ url: "/versoes/mais-nova", headers: ana })).json()).toEqual({
      versao: null,
    });
  });

  it("fluxo: pega a trava, envia, outro PC informa a cópia, consultas; envio sem trava → 409", async () => {
    const { app, banco, ana, bia } = await montarApp();
    const enviar = (headers: Record<string, string>, epoca: number) =>
      app.inject({
        method: "POST",
        url: "/versoes",
        headers,
        payload: { epoca, ...DADOS },
      });
    const semTrava = await enviar(ana, 1);
    expect(semTrava.statusCode).toBe(409);
    expect(semTrava.json()).toMatchObject({ motivo: "epoca_velha", erro: expect.any(String) });

    const { epoca } = (
      await app.inject({ method: "POST", url: "/trava/pegar", headers: ana })
    ).json<{ epoca: number }>();
    const r1 = await enviar(ana, epoca);
    expect(r1.statusCode).toBe(201);
    expect(r1.json()).toEqual({ numero: 1 });
    expect((await enviar(ana, epoca)).json()).toEqual({ numero: 2 });

    const daBia = await enviar(bia, epoca);
    expect(daBia.statusCode).toBe(409);
    expect(daBia.json()).toMatchObject({ motivo: "nao_e_dono" });

    const informar = (versao: number) =>
      app.inject({ method: "POST", url: "/copias", headers: bia, payload: { versao } });
    expect((await informar(3)).statusCode).toBe(404);
    expect((await informar(2)).statusCode).toBe(204);

    const nova = await app.inject({ url: "/versoes/mais-nova", headers: bia });
    expect(nova.json()).toMatchObject({ versao: { numero: 2, epoca, manifestoSha256: SHA } });
    // Só convite confirmado (rede privada pronta) mostra o IP; a Bia ainda não confirmou → ip null.
    banco
      .prepare("UPDATE convites SET ip_def = '10.66.0.5', confirmado_em = 1 WHERE pc_id = 1")
      .run();
    banco.prepare("UPDATE convites SET ip_def = '10.66.0.6' WHERE pc_id = 2").run();
    const comIp = await app.inject({ url: "/versoes/2/copias", headers: bia });
    expect(comIp.json()).toEqual({
      numero: 2,
      nuvem: false,
      pcs: [
        { id: 1, nome: "Ana", ip: "10.66.0.5" },
        { id: 2, nome: "Bia", ip: null },
      ],
    });
    banco
      .prepare("INSERT INTO copias_nuvem (versao, sha256, bytes, guardada_em) VALUES (2, ?, 1, 0)")
      .run(SHA);
    expect((await app.inject({ url: "/versoes/2/copias", headers: bia })).json()).toMatchObject({
      nuvem: true,
    });
    expect((await app.inject({ url: "/versoes/1/copias", headers: bia })).json()).toMatchObject({
      nuvem: false,
    });
    expect((await app.inject({ url: "/versoes/abc/copias", headers: bia })).statusCode).toBe(400);
  });
});
