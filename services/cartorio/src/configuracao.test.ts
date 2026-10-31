import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { pegarAtualizacao, soltarAtualizacao } from "./atualizacao.js";
import { type Banco, MIGRACOES, abrirBanco } from "./banco.js";
import { hashSegredo } from "./segredo.js";
import { gravarConfig, lerConfig } from "./configuracao.js";
import { criarCartorio } from "./servidor.js";
import { pegar, soltar } from "./trava.js";

const SHA1 = "a".repeat(40);
const PRAZO = 60_000;
const pastas: string[] = [];
const fechar: Array<() => unknown> = [];

afterEach(async () => {
  for (const f of fechar.splice(0).reverse()) await Promise.resolve(f()).catch(() => undefined);
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

/** Banco novo com 3 PCs (1 = dono) e token ativo (`hash-N`). */
function montarBanco(): Banco {
  const pasta = mkdtempSync(join(tmpdir(), "sabre-config-"));
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

describe("config do grupo: migração 8 → 9", () => {
  it("banco com dados na v8 sobe para v9 sem perder nada e já tem o padrão 1.21.1", () => {
    const pasta = mkdtempSync(join(tmpdir(), "sabre-config-m-"));
    pastas.push(pasta);
    const caminho = join(pasta, "m.db");
    const v8 = abrirBanco(caminho, MIGRACOES.slice(0, 8));
    v8.exec(`INSERT INTO pcs (id, nome, criado_em) VALUES (1, 'Ana', 10);
      UPDATE trava SET dono_pc_id = 1, expira_em = 500, epoca = 3`);
    v8.close();
    const banco = abrirBanco(caminho);
    fechar.push(() => {
      if (banco.isOpen) banco.close();
    });
    expect(banco.prepare("SELECT versao FROM esquema").get()).toEqual({ versao: 9 });
    expect(banco.prepare("SELECT dono_pc_id, epoca FROM trava").get()).toEqual({
      dono_pc_id: 1,
      epoca: 3,
    });
    expect(lerConfig(banco)).toEqual({
      versaoMinecraft: "1.21.1",
      sha1Manifesto: null,
      atualizadoEm: 0,
    });
  });

  it("a linha única não se apaga nem se recria", () => {
    const banco = montarBanco();
    expect(() => banco.exec("DELETE FROM config_grupo")).toThrow(/não se apaga/);
    expect(() => banco.exec("INSERT OR REPLACE INTO config_grupo (id) VALUES (1)")).toThrow();
    expect(lerConfig(banco).versaoMinecraft).toBe("1.21.1");
  });
});

describe("config do grupo: gravar", () => {
  it("o dono grava versão e sha1; ler devolve o que foi gravado", () => {
    const banco = montarBanco();
    const r = gravarConfig(banco, 1, { versaoMinecraft: "1.20.1", sha1Manifesto: SHA1 }, 1000);
    expect(r).toEqual({ ok: true });
    expect(lerConfig(banco)).toEqual({
      versaoMinecraft: "1.20.1",
      sha1Manifesto: SHA1,
      atualizadoEm: 1000,
    });
  });

  it("quem não é dono é recusado e nada muda", () => {
    const banco = montarBanco();
    expect(
      gravarConfig(banco, 2, { versaoMinecraft: "1.20.1", sha1Manifesto: SHA1 }, 1000),
    ).toEqual({
      ok: false,
      motivo: "nao_e_dono",
    });
    expect(lerConfig(banco).versaoMinecraft).toBe("1.21.1");
  });

  it("entrada torta é recusada (versão fora do padrão, sha1 que não é 40 hex minúsculo)", () => {
    const banco = montarBanco();
    for (const dados of [
      { versaoMinecraft: "24w10a", sha1Manifesto: SHA1 },
      { versaoMinecraft: "1.21.1; DROP", sha1Manifesto: SHA1 },
      { versaoMinecraft: "1.21.1", sha1Manifesto: "A".repeat(40) },
      { versaoMinecraft: "1.21.1", sha1Manifesto: "a".repeat(39) },
    ])
      expect(gravarConfig(banco, 1, dados, 1000)).toEqual({ ok: false, motivo: "invalida" });
    expect(lerConfig(banco).atualizadoEm).toBe(0);
  });

  it("409: trava de host ativa (até do próprio dono); vencida ou solta libera", () => {
    const banco = montarBanco();
    const dados = { versaoMinecraft: "1.20.1", sha1Manifesto: SHA1 };
    const t = pegar(banco, 2, 1000, PRAZO);
    expect(t.ok).toBe(true);
    expect(gravarConfig(banco, 1, dados, 1000 + PRAZO - 1)).toEqual({
      ok: false,
      motivo: "servidor_no_ar",
    });
    expect(lerConfig(banco).versaoMinecraft).toBe("1.21.1");
    // borda: expira_em == agora já é vencida (mesma regra do estadoTrava)
    expect(gravarConfig(banco, 1, dados, 1000 + PRAZO)).toEqual({ ok: true });
    const t2 = pegar(banco, 1, 5000 + PRAZO, PRAZO);
    expect(gravarConfig(banco, 1, dados, 5000 + PRAZO + 1)).toEqual({
      ok: false,
      motivo: "servidor_no_ar",
    });
    if (t2.ok) soltar(banco, 1, t2.epoca);
    expect(gravarConfig(banco, 1, dados, 5000 + PRAZO + 2)).toEqual({ ok: true });
  });

  it("409: atualização de algum PC com prazo valendo; prazo zerado ou vencido não conta", () => {
    const banco = montarBanco();
    const dados = { versaoMinecraft: "1.20.1", sha1Manifesto: SHA1 };
    const a = pegarAtualizacao(banco, 3, 1000, PRAZO);
    expect(a.ok).toBe(true);
    expect(gravarConfig(banco, 1, dados, 1000 + PRAZO - 1)).toEqual({
      ok: false,
      motivo: "atualizando",
    });
    expect(gravarConfig(banco, 1, dados, 1000 + PRAZO)).toEqual({ ok: true }); // vencida
    const b = pegarAtualizacao(banco, 3, 9000, PRAZO);
    expect(b.ok).toBe(true);
    expect(gravarConfig(banco, 1, dados, 9001)).toEqual({ ok: false, motivo: "atualizando" });
    if (b.ok) soltarAtualizacao(banco, 3, b.epoca);
    expect(gravarConfig(banco, 1, dados, 9002)).toEqual({ ok: true });
  });
});

describe("config do grupo: rotas", () => {
  function montarApp() {
    const banco = montarBanco();
    const relogio = { agora: 1_000_000 };
    const app = criarCartorio({ banco, logger: { level: "silent" }, agora: () => relogio.agora });
    fechar.push(() => app.close());
    const h = (n: number) => ({ authorization: `Bearer tok-${n}` });
    return { app, banco, relogio, h };
  }

  const dados = { versaoMinecraft: "1.20.1", sha1Manifesto: SHA1 };

  it("sem token → 401 (GET e PUT)", async () => {
    const { app } = montarApp();
    expect((await app.inject({ url: "/grupo/config" })).statusCode).toBe(401);
    const put = await app.inject({ method: "PUT", url: "/grupo/config", payload: dados });
    expect(put.statusCode).toBe(401);
  });

  it("qualquer PC lê; só o dono grava (403 para os outros)", async () => {
    const { app, h } = montarApp();
    const lido = await app.inject({ url: "/grupo/config", headers: h(2) });
    expect(lido.json()).toEqual({
      versaoMinecraft: "1.21.1",
      sha1Manifesto: null,
      atualizadoEm: 0,
    });
    const negado = await app.inject({
      method: "PUT",
      url: "/grupo/config",
      headers: h(2),
      payload: dados,
    });
    expect(negado.statusCode).toBe(403);
    const ok = await app.inject({
      method: "PUT",
      url: "/grupo/config",
      headers: h(1),
      payload: dados,
    });
    expect(ok.statusCode).toBe(200);
    expect(ok.json()).toEqual({
      versaoMinecraft: "1.20.1",
      sha1Manifesto: SHA1,
      atualizadoEm: 1_000_000,
    });
    expect((await app.inject({ url: "/grupo/config", headers: h(3) })).json()).toEqual(ok.json());
  });

  it("corpo torto → 400; com servidor no ar ou atualização → 409 com mensagem em pt-BR", async () => {
    const { app, banco, relogio, h } = montarApp();
    const torto = await app.inject({
      method: "PUT",
      url: "/grupo/config",
      headers: h(1),
      payload: { versaoMinecraft: "x", sha1Manifesto: SHA1 },
    });
    expect(torto.statusCode).toBe(400);
    pegar(banco, 2, relogio.agora, PRAZO);
    const no_ar = await app.inject({
      method: "PUT",
      url: "/grupo/config",
      headers: h(1),
      payload: dados,
    });
    expect(no_ar.statusCode).toBe(409);
    expect(no_ar.json().erro).toMatch(/servidor/i);
    relogio.agora += PRAZO; // trava venceu
    pegarAtualizacao(banco, 3, relogio.agora, PRAZO);
    const atualizando = await app.inject({
      method: "PUT",
      url: "/grupo/config",
      headers: h(1),
      payload: dados,
    });
    expect(atualizando.statusCode).toBe(409);
    expect(atualizando.json().erro).toMatch(/atualiz/i);
    expect((await app.inject({ url: "/grupo/config", headers: h(1) })).json().versaoMinecraft).toBe(
      "1.21.1",
    );
  });
});
