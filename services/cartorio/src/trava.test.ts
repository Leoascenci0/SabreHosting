import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { afterEach, describe, expect, it } from "vitest";
import { type Banco, abrirBanco, criarConvite } from "./banco.js";
import { gerarSegredo } from "./segredo.js";
import { criarCartorio } from "./servidor.js";
import { conferirTempos, estadoTrava, passar, pegar, renovar, soltar } from "./trava.js";

const PRAZO = 60_000;
const pastas: string[] = [];
const fechar: Array<() => unknown> = [];

afterEach(async () => {
  for (const f of fechar.splice(0)) await f();
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true });
});

function pasta() {
  const p = mkdtempSync(join(tmpdir(), "sabre-trava-"));
  pastas.push(p);
  return p;
}

/** Banco novo com `n` PCs (ids 1..n), cada um com um token ativo. */
function montarBanco(n = 3): { banco: Banco; caminho: string } {
  const caminho = join(pasta(), "cartorio.db");
  const banco = abrirBanco(caminho);
  fechar.push(() => banco.close());
  const inserir = banco.prepare("INSERT INTO pcs (nome, criado_em) VALUES (?, 0)");
  const token = banco.prepare("INSERT INTO tokens (hash, pc_id, criado_em) VALUES (?, ?, 0)");
  for (let i = 1; i <= n; i++) {
    inserir.run(`PC ${i}`);
    token.run(`hash-${i}`, i);
  }
  return { banco, caminho };
}

describe("trava: corrida entre PCs", () => {
  it("10 workers, cada um com a sua conexão ao mesmo arquivo, disputam juntos → exatamente 1 ganha, 20 rodadas", async () => {
    const PCS = 10;
    const RODADAS = 20;
    const { caminho } = montarBanco(PCS);
    const sinal = new SharedArrayBuffer(4);
    const barreira = new Int32Array(sinal);
    const recebidos: Array<{ rodada: number; pc: number; ok: boolean; epoca: number }> = [];
    let prontos = 0;
    let avisar = () => {};
    const workers = Array.from({ length: PCS }, (_, i) => {
      const w = new Worker(new URL("./trava-corrida.worker.mjs", import.meta.url), {
        workerData: { caminho, pc: i + 1, sinal, rodadas: RODADAS, prazoMs: PRAZO },
      });
      w.on("message", (m: { pronto?: boolean } & (typeof recebidos)[number]) => {
        if (m.pronto) prontos++;
        else recebidos.push(m);
        avisar();
      });
      w.on("error", (erro) => {
        throw erro;
      });
      return w;
    });
    fechar.push(() => Promise.all(workers.map((w) => w.terminate())));
    const ate = (condicao: () => boolean) =>
      new Promise<void>((resolver) => {
        avisar = () => condicao() && resolver();
        avisar();
      });

    await ate(() => prontos === PCS);
    for (let rodada = 1; rodada <= RODADAS; rodada++) {
      Atomics.store(barreira, 0, rodada);
      Atomics.notify(barreira, 0);
      await ate(() => recebidos.length === rodada * PCS);
      const daRodada = recebidos.filter((r) => r.rodada === rodada);
      const ganhou = daRodada.filter((r) => r.ok);
      expect(ganhou).toHaveLength(1);
      expect(ganhou[0]?.epoca).toBe(rodada);
      // Quem perdeu vê a época de quem ganhou ou uma mais nova (nunca uma mais velha). "Igual" seria frágil: sob
      // carga o perdedor atrasado só lê o banco depois de a rodada seguinte já ter começado.
      for (const r of daRodada) expect(r.epoca).toBeGreaterThanOrEqual(rodada);
    }
  }, 20_000);

  it("duas conexões ao mesmo arquivo, uma após a outra: a segunda não pega a trava viva", () => {
    const { banco, caminho } = montarBanco(2);
    const outra = abrirBanco(caminho);
    fechar.push(() => outra.close());
    expect(pegar(banco, 1, 0, PRAZO)).toEqual({ ok: true, epoca: 1, expiraEm: PRAZO });
    expect(pegar(outra, 2, 1, PRAZO)).toMatchObject({ ok: false, motivo: "ocupada", donoPcId: 1 });
  });
});

describe("trava: prazo", () => {
  it("vale até 1 ms antes de vencer; vencida, outro PC pega e a época sobe", () => {
    const { banco } = montarBanco();
    expect(pegar(banco, 1, 0, PRAZO).ok).toBe(true);
    expect(pegar(banco, 2, PRAZO - 1, PRAZO).ok).toBe(false);
    expect(pegar(banco, 2, PRAZO, PRAZO)).toEqual({ ok: true, epoca: 2, expiraEm: 2 * PRAZO });
  });

  it("renovar empurra o prazo; renovar depois de vencida → recusa", () => {
    const { banco } = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    expect(renovar(banco, 1, 1, 20_000, PRAZO)).toEqual({
      ok: true,
      epoca: 1,
      expiraEm: 20_000 + PRAZO,
    });
    expect(pegar(banco, 2, PRAZO, PRAZO).ok).toBe(false);
    expect(renovar(banco, 1, 1, 20_000 + PRAZO, PRAZO)).toMatchObject({
      ok: false,
      motivo: "vencida",
    });
  });

  it("o próprio dono pegar de novo (app reiniciou) → época sobe e a época antiga deixa de valer", () => {
    const { banco } = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    expect(pegar(banco, 1, 10, PRAZO)).toMatchObject({ ok: true, epoca: 2 });
    expect(renovar(banco, 1, 1, 20, PRAZO)).toMatchObject({ ok: false, motivo: "epoca_velha" });
  });

  it("estado mostra o dono só enquanto a trava vale", () => {
    const { banco } = montarBanco();
    expect(estadoTrava(banco, 0)).toEqual({ donoPcId: null, epoca: 0, expiraEm: 0 });
    pegar(banco, 1, 0, PRAZO);
    expect(estadoTrava(banco, PRAZO - 1)).toEqual({ donoPcId: 1, epoca: 1, expiraEm: PRAZO });
    expect(estadoTrava(banco, PRAZO)).toEqual({ donoPcId: null, epoca: 1, expiraEm: PRAZO });
  });
});

describe("trava: época (host zumbi)", () => {
  it("zumbi com época velha não renova, não passa e não solta", () => {
    const { banco } = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    pegar(banco, 2, PRAZO, PRAZO); // o PC 1 "hibernou"; o 2 pegou com época 2
    expect(renovar(banco, 1, 1, PRAZO + 1, PRAZO)).toMatchObject({
      ok: false,
      motivo: "epoca_velha",
    });
    expect(passar(banco, 1, 3, 1, PRAZO + 1, PRAZO)).toMatchObject({
      ok: false,
      motivo: "epoca_velha",
    });
    expect(soltar(banco, 1, 1)).toMatchObject({ ok: false, motivo: "epoca_velha" });
    expect(estadoTrava(banco, PRAZO + 1)).toMatchObject({ donoPcId: 2, epoca: 2 });
  });

  it("passar sobe a época; o novo dono renova, o antigo não", () => {
    const { banco } = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    expect(passar(banco, 1, 2, 1, 100, PRAZO)).toEqual({
      ok: true,
      epoca: 2,
      expiraEm: 100 + PRAZO,
    });
    expect(renovar(banco, 2, 2, 200, PRAZO).ok).toBe(true);
    expect(renovar(banco, 1, 2, 200, PRAZO)).toMatchObject({ ok: false, motivo: "nao_e_dono" });
  });

  it("passar: quem não é dono, trava vencida ou destino inexistente → recusa, nada muda", () => {
    const { banco } = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    expect(passar(banco, 2, 3, 1, 1, PRAZO)).toMatchObject({ ok: false, motivo: "nao_e_dono" });
    expect(passar(banco, 1, 99, 1, 1, PRAZO)).toMatchObject({
      ok: false,
      motivo: "destino_desconhecido",
    });
    expect(passar(banco, 1, 2, 1, PRAZO, PRAZO)).toMatchObject({ ok: false, motivo: "vencida" });
    expect(estadoTrava(banco, 1)).toEqual({ donoPcId: 1, epoca: 1, expiraEm: PRAZO });
  });

  it("passar para si mesmo ou para PC sem token ativo (sem token, revogado) → recusa, nada muda", () => {
    const { banco } = montarBanco();
    banco.prepare("INSERT INTO pcs (nome, criado_em) VALUES ('Sem token', 0)").run(); // id 4
    banco.prepare("UPDATE tokens SET revogado_em = 1 WHERE pc_id = 3").run();
    pegar(banco, 1, 0, PRAZO);
    expect(passar(banco, 1, 1, 1, 1, PRAZO)).toMatchObject({
      ok: false,
      motivo: "destino_invalido",
    });
    for (const destino of [4, 3]) {
      expect(passar(banco, 1, destino, 1, 1, PRAZO)).toMatchObject({
        ok: false,
        motivo: "destino_desconhecido",
      });
    }
    expect(estadoTrava(banco, 1)).toEqual({ donoPcId: 1, epoca: 1, expiraEm: PRAZO });
  });

  it("INSERT OR REPLACE, REPLACE e DELETE na trava falham e a época não muda", () => {
    const { banco } = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    pegar(banco, 2, PRAZO, PRAZO); // época 2
    for (const sql of [
      "INSERT OR REPLACE INTO trava (id) VALUES (1)",
      "REPLACE INTO trava (id, epoca) VALUES (1, 0)",
      "DELETE FROM trava",
    ]) {
      expect(() => banco.exec(sql), sql).toThrow();
    }
    expect(estadoTrava(banco, PRAZO + 1)).toEqual({ donoPcId: 2, epoca: 2, expiraEm: 2 * PRAZO });
  });

  it("soltar por quem não é dono → recusa; soltar pelo dono libera e a época não desce", () => {
    const { banco } = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    expect(soltar(banco, 2, 1)).toMatchObject({ ok: false, motivo: "nao_e_dono" });
    expect(soltar(banco, 1, 1)).toEqual({ ok: true, epoca: 1, expiraEm: 0 });
    expect(estadoTrava(banco, 1)).toEqual({ donoPcId: null, epoca: 1, expiraEm: 0 });
    expect(soltar(banco, 1, 1)).toMatchObject({ ok: false, motivo: "nao_e_dono" });
    expect(pegar(banco, 2, 2, PRAZO)).toMatchObject({ ok: true, epoca: 2 });
  });

  it("o banco barra época que desce, mesmo por UPDATE direto", () => {
    const { banco } = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    expect(() => banco.exec("UPDATE trava SET epoca = 0")).toThrow(/época/);
    expect(() => banco.exec("INSERT INTO trava (id) VALUES (2)")).toThrow();
  });
});

describe("trava: tempos", () => {
  it("padrão 60 s / 20 s; recusa prazo menor que 3 × renovação e valores não positivos", () => {
    expect(conferirTempos()).toEqual({ prazoMs: 60_000, renovarMs: 20_000 });
    expect(conferirTempos({ prazoMs: 30_000, renovarMs: 10_000 })).toEqual({
      prazoMs: 30_000,
      renovarMs: 10_000,
    });
    expect(() => conferirTempos({ prazoMs: 59_999, renovarMs: 20_000 })).toThrow(/3 ×/);
    expect(() => conferirTempos({ prazoMs: 0, renovarMs: 0 })).toThrow();
    expect(() =>
      criarCartorio({ ...opcoesMinimas(), trava: { prazoMs: 10, renovarMs: 10 } }),
    ).toThrow();
  });
});

function opcoesMinimas() {
  const banco = abrirBanco(join(pasta(), "c.db"));
  fechar.push(() => banco.close());
  return { banco, segredoAdmin: gerarSegredo(), logger: { level: "silent" } };
}

describe("trava: rotas", () => {
  async function montarRotas() {
    const relogio = { agora: 1_000 };
    const banco = abrirBanco(join(pasta(), "c.db")); // o app fecha o banco ao fechar
    const app = criarCartorio({
      banco,
      segredoAdmin: gerarSegredo(),
      logger: { level: "silent" },
      agora: () => relogio.agora,
    });
    fechar.push(() => app.close());
    async function novoPc(nome: string) {
      const convite = criarConvite(banco, nome, relogio.agora, 60_000);
      const r = await app.inject({ method: "POST", url: "/convites/usar", payload: { convite } });
      const { token } = r.json<{ token: string }>();
      const eu = await app.inject({ url: "/eu", headers: { authorization: `Bearer ${token}` } });
      return { token, id: eu.json<{ id: number }>().id };
    }
    function chamar(token: string | undefined, acao: string, payload: object = {}) {
      return app.inject({
        method: acao === "" ? "GET" : "POST",
        url: acao === "" ? "/trava" : `/trava/${acao}`,
        headers: token ? { authorization: `Bearer ${token}` } : {},
        ...(acao === "" ? {} : { payload }),
      });
    }
    return { relogio, novoPc, chamar };
  }

  it("sem token → 401 em todas", async () => {
    const { chamar } = await montarRotas();
    for (const acao of ["", "pegar", "renovar", "passar", "soltar"]) {
      expect((await chamar(undefined, acao, { epoca: 1, para: 1 })).statusCode).toBe(401);
      expect((await chamar(gerarSegredo(), acao, { epoca: 1, para: 1 })).statusCode).toBe(401);
    }
  });

  it("pegar, ver, recusar o outro (409), renovar, passar, soltar", async () => {
    const { relogio, novoPc, chamar } = await montarRotas();
    const ana = await novoPc("PC da Ana");
    const bia = await novoPc("PC da Bia");

    const pegou = await chamar(ana.token, "pegar");
    expect(pegou.statusCode).toBe(200);
    expect(pegou.json()).toEqual({ ok: true, epoca: 1, expiraEm: 61_000, renovarMs: 20_000 });

    const visto = await chamar(bia.token, "");
    expect(visto.json()).toMatchObject({
      dono: { id: ana.id, nome: "PC da Ana" },
      epoca: 1,
      expiraEm: 61_000,
      prazoMs: 60_000,
      renovarMs: 20_000,
    });

    const recusa = await chamar(bia.token, "pegar");
    expect(recusa.statusCode).toBe(409);
    expect(recusa.json()).toMatchObject({ ok: false, motivo: "ocupada", epoca: 1 });
    expect(recusa.json<{ erro: string }>().erro).toMatch(/PC da Ana|outro PC/);

    relogio.agora += 20_000;
    expect((await chamar(ana.token, "renovar", { epoca: 1 })).json()).toMatchObject({
      ok: true,
      expiraEm: 81_000,
    });
    expect((await chamar(ana.token, "renovar", {})).statusCode).toBe(400);
    expect((await chamar(ana.token, "passar", { epoca: 1, para: bia.id })).json()).toMatchObject({
      ok: true,
      epoca: 2,
    });
    const zumbi = await chamar(ana.token, "soltar", { epoca: 1 });
    expect(zumbi.statusCode).toBe(409);
    expect(zumbi.json()).toMatchObject({ motivo: "epoca_velha" });
    expect((await chamar(bia.token, "soltar", { epoca: 2 })).statusCode).toBe(200);
    expect((await chamar(ana.token, "")).json()).toMatchObject({ dono: null, epoca: 2 });
  });
});
