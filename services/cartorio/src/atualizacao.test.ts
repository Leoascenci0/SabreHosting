import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { afterEach, describe, expect, it } from "vitest";
import { pegarAtualizacao, renovarAtualizacao, soltarAtualizacao } from "./atualizacao.js";
import { type Banco, MIGRACOES, abrirBanco, criarConvite } from "./banco.js";
import { gerarSegredo } from "./segredo.js";
import { criarCartorio } from "./servidor.js";
import { passar, pegar, renovar, soltar } from "./trava.js";

const PRAZO = 60_000;
const pastas: string[] = [];
const fechar: Array<() => unknown> = [];

afterEach(async () => {
  for (const f of fechar.splice(0)) await f();
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true });
});

function pasta() {
  const p = mkdtempSync(join(tmpdir(), "sabre-atualizacao-"));
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

describe("atualização: migração v7 → v8", () => {
  it("com host em uso preserva a trava e cria a tabela vazia; o host continua renovando", () => {
    const caminho = join(pasta(), "m.db");
    const v7 = abrirBanco(caminho, MIGRACOES.slice(0, 7));
    v7.exec(`INSERT INTO pcs (id, nome, criado_em) VALUES (1, 'Ana', 10);
      UPDATE trava SET dono_pc_id = 1, expira_em = 500, epoca = 3`);
    v7.close();
    const banco = abrirBanco(caminho);
    fechar.push(() => banco.close());
    expect(banco.prepare("SELECT versao FROM esquema").get()).toEqual({ versao: 9 });
    expect(banco.prepare("SELECT count(*) AS n FROM atualizacao").get()).toEqual({ n: 0 });
    expect(renovar(banco, 1, 3, 100, PRAZO)).toEqual({ ok: true, epoca: 3, expiraEm: 100 + PRAZO });
  });
});

describe("atualização: prazo e época", () => {
  it("pegar, renovar e soltar a própria; a época sobe a cada pegar e nunca desce", () => {
    const { banco } = montarBanco();
    expect(pegarAtualizacao(banco, 1, 0, PRAZO)).toEqual({ ok: true, epoca: 1, expiraEm: PRAZO });
    expect(renovarAtualizacao(banco, 1, 1, 20_000, PRAZO)).toEqual({
      ok: true,
      epoca: 1,
      expiraEm: 20_000 + PRAZO,
    });
    expect(soltarAtualizacao(banco, 1, 1)).toEqual({ ok: true, epoca: 1, expiraEm: 0 });
    // Resposta do soltar perdida na rede: repetir dá certo de novo.
    expect(soltarAtualizacao(banco, 1, 1)).toEqual({ ok: true, epoca: 1, expiraEm: 0 });
    expect(renovarAtualizacao(banco, 1, 1, 30_000, PRAZO)).toMatchObject({
      ok: false,
      motivo: "vencida",
    });
    expect(pegarAtualizacao(banco, 1, 40_000, PRAZO)).toEqual({
      ok: true,
      epoca: 2,
      expiraEm: 40_000 + PRAZO,
    });
    expect(() => banco.prepare("UPDATE atualizacao SET epoca = 1 WHERE pc_id = 1").run()).toThrow(
      /nunca desce/,
    );
    expect(() => banco.prepare("UPDATE atualizacao SET epoca = 'x' WHERE pc_id = 1").run()).toThrow(
      /CHECK/,
    );
    expect(() => banco.prepare("DELETE FROM atualizacao").run()).toThrow(/não se apaga/);
  });

  it("prazo vencido sem soltar (crash): vale até 1 ms antes; depois renovar recusa e o PC pega o host", () => {
    const { banco } = montarBanco();
    pegarAtualizacao(banco, 2, 0, PRAZO);
    expect(pegar(banco, 2, PRAZO - 1, PRAZO)).toMatchObject({ ok: false, motivo: "atualizando" });
    expect(renovarAtualizacao(banco, 2, 1, PRAZO, PRAZO)).toMatchObject({
      ok: false,
      motivo: "vencida",
    });
    expect(pegar(banco, 2, PRAZO, PRAZO)).toEqual({ ok: true, epoca: 1, expiraEm: 2 * PRAZO });
  });

  it("app reiniciado pega de novo: época sobe e o processo velho não renova nem solta", () => {
    const { banco } = montarBanco();
    pegarAtualizacao(banco, 1, 0, PRAZO);
    expect(pegarAtualizacao(banco, 1, 1_000, PRAZO)).toMatchObject({ ok: true, epoca: 2 });
    expect(renovarAtualizacao(banco, 1, 1, 2_000, PRAZO)).toMatchObject({
      ok: false,
      motivo: "epoca_velha",
      epoca: 2,
    });
    expect(soltarAtualizacao(banco, 1, 1)).toMatchObject({ ok: false, motivo: "epoca_velha" });
    expect(renovarAtualizacao(banco, 1, 2, 2_000, PRAZO)).toMatchObject({ ok: true, epoca: 2 });
  });

  it("PC que nunca pegou não renova nem solta (nao_e_dono); um PC não mexe na atualização do outro", () => {
    const { banco } = montarBanco();
    pegarAtualizacao(banco, 1, 0, PRAZO);
    expect(renovarAtualizacao(banco, 2, 1, 1, PRAZO)).toMatchObject({
      ok: false,
      motivo: "nao_e_dono",
    });
    expect(soltarAtualizacao(banco, 2, 1)).toMatchObject({ ok: false, motivo: "nao_e_dono" });
    // B pegar a própria não mexe na de A.
    expect(pegarAtualizacao(banco, 2, 1, PRAZO)).toMatchObject({ ok: true, epoca: 1 });
    expect(renovarAtualizacao(banco, 1, 1, 2, PRAZO)).toMatchObject({ ok: true, epoca: 1 });
  });
});

describe("atualização × trava de host", () => {
  it("(c) PC atualizando não pega o host nem recebe por passar; nada muda na trava", () => {
    const { banco } = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    pegarAtualizacao(banco, 2, 0, PRAZO);
    expect(passar(banco, 1, 2, 1, 1_000, PRAZO)).toMatchObject({
      ok: false,
      motivo: "atualizando",
      donoPcId: 1,
      epoca: 1,
    });
    soltar(banco, 1, 1);
    expect(pegar(banco, 2, 2_000, PRAZO)).toMatchObject({
      ok: false,
      motivo: "atualizando",
      donoPcId: null,
      epoca: 1,
    });
    // Soltou a atualização: pega na hora.
    soltarAtualizacao(banco, 2, 1);
    expect(pegar(banco, 2, 3_000, PRAZO)).toMatchObject({ ok: true, epoca: 2 });
  });

  it("a atualização de outro PC nunca atrapalha o host atual: renova, passa para um terceiro e solta", () => {
    const { banco } = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    expect(pegarAtualizacao(banco, 2, 0, PRAZO).ok).toBe(true);
    expect(pegarAtualizacao(banco, 3, 0, PRAZO).ok).toBe(true);
    expect(renovar(banco, 1, 1, 20_000, PRAZO)).toMatchObject({ ok: true, epoca: 1 });
    soltarAtualizacao(banco, 3, 1);
    expect(passar(banco, 1, 3, 1, 21_000, PRAZO)).toMatchObject({ ok: true, epoca: 2 });
    expect(soltar(banco, 3, 2)).toMatchObject({ ok: true });
  });

  it("o host não pega atualização (mexeria no mundo vivo); sem a trava, pega", () => {
    const { banco } = montarBanco();
    pegar(banco, 1, 0, PRAZO);
    expect(pegarAtualizacao(banco, 1, 1_000, PRAZO)).toMatchObject({
      ok: false,
      motivo: "hospedando",
      epoca: 0,
    });
    // Host vencido (caiu): já não hospeda, pode atualizar.
    expect(pegarAtualizacao(banco, 1, PRAZO, PRAZO)).toMatchObject({ ok: true, epoca: 1 });
  });

  it("corrida: o mesmo PC pede host e atualização juntos, em conexões próprias → nunca os dois, 20 rodadas", async () => {
    const PCS = 4;
    const RODADAS = 20;
    const { caminho } = montarBanco(PCS);
    const sinal = new SharedArrayBuffer(4);
    const barreira = new Int32Array(sinal);
    type Resposta = { rodada: number; pc: number; operacao: string; ok: boolean };
    const recebidos: Resposta[] = [];
    let prontos = 0;
    let avisar = () => {};
    const workers = ["host", "atualizacao"].flatMap((operacao) =>
      Array.from({ length: PCS }, (_, i) => {
        const w = new Worker(new URL("./trava-corrida.worker.mjs", import.meta.url), {
          workerData: { caminho, pc: i + 1, sinal, rodadas: RODADAS, prazoMs: PRAZO, operacao },
        });
        w.on("message", (m: { pronto?: boolean } & Resposta) => {
          if (m.pronto) prontos++;
          else recebidos.push(m);
          avisar();
        });
        w.on("error", (erro) => {
          throw erro;
        });
        return w;
      }),
    );
    fechar.push(() => Promise.all(workers.map((w) => w.terminate())));
    const ate = (condicao: () => boolean) =>
      new Promise<void>((resolver) => {
        avisar = () => condicao() && resolver();
        avisar();
      });

    await ate(() => prontos === 2 * PCS);
    for (let rodada = 1; rodada <= RODADAS; rodada++) {
      Atomics.store(barreira, 0, rodada);
      Atomics.notify(barreira, 0);
      await ate(() => recebidos.length === rodada * 2 * PCS);
      const daRodada = recebidos.filter((r) => r.rodada === rodada);
      expect(daRodada.filter((r) => r.operacao === "host" && r.ok).length).toBeLessThanOrEqual(1);
      for (let pc = 1; pc <= PCS; pc++) {
        // Cada PC sai com exatamente uma das duas: a outra foi recusada pela primeira.
        expect(daRodada.filter((r) => r.pc === pc && r.ok)).toHaveLength(1);
      }
    }
  }, 20_000);
});

describe("atualização: rotas", () => {
  async function montarRotas() {
    const relogio = { agora: 1_000 };
    const banco = abrirBanco(join(pasta(), "c.db")); // o app fecha o banco ao fechar
    const app = criarCartorio({ banco, logger: { level: "silent" }, agora: () => relogio.agora });
    fechar.push(() => app.close());
    async function novoPc(nome: string) {
      const convite = criarConvite(banco, nome, relogio.agora, 60_000);
      const r = await app.inject({ method: "POST", url: "/convites/usar", payload: { convite } });
      return r.json<{ token: string }>().token;
    }
    function chamar(token: string | undefined, url: string, payload: object = {}) {
      return app.inject({
        method: "POST",
        url,
        headers: token ? { authorization: `Bearer ${token}` } : {},
        payload,
      });
    }
    return { relogio, novoPc, chamar };
  }

  it("sem token ou com token inventado → 401 em todas", async () => {
    const { chamar } = await montarRotas();
    for (const acao of ["pegar", "renovar", "soltar"]) {
      const url = `/atualizacao/${acao}`;
      expect((await chamar(undefined, url, { epoca: 1 })).statusCode).toBe(401);
      expect((await chamar(gerarSegredo(), url, { epoca: 1 })).statusCode).toBe(401);
    }
  });

  it("pegar, renovar, soltar; corpo fora do esquema → 400; host atualizando → 409 com motivo", async () => {
    const { relogio, novoPc, chamar } = await montarRotas();
    const ana = await novoPc("PC da Ana");
    const bia = await novoPc("PC da Bia");

    expect((await chamar(ana, "/trava/pegar")).statusCode).toBe(200);
    const pegou = await chamar(bia, "/atualizacao/pegar");
    expect(pegou.statusCode).toBe(200);
    expect(pegou.json()).toEqual({ ok: true, epoca: 1, expiraEm: 61_000, renovarMs: 20_000 });

    const hospedando = await chamar(ana, "/atualizacao/pegar");
    expect(hospedando.statusCode).toBe(409);
    expect(hospedando.json()).toMatchObject({ ok: false, motivo: "hospedando" });
    expect(hospedando.json<{ erro: string }>().erro).toMatch(/hospedando/);

    expect((await chamar(ana, "/trava/soltar", { epoca: 1 })).statusCode).toBe(200);
    const atualizando = await chamar(bia, "/trava/pegar");
    expect(atualizando.statusCode).toBe(409);
    expect(atualizando.json()).toMatchObject({ ok: false, motivo: "atualizando" });
    expect(atualizando.json<{ erro: string }>().erro).toMatch(/atualiz/i);

    relogio.agora += 20_000;
    expect((await chamar(bia, "/atualizacao/renovar", { epoca: 1 })).json()).toMatchObject({
      ok: true,
      expiraEm: 81_000,
    });
    for (const payload of [{}, { epoca: 0 }, { epoca: 1.5 }, { epoca: 2 ** 53 }]) {
      expect((await chamar(bia, "/atualizacao/renovar", payload)).statusCode).toBe(400);
    }
    // A Ana não mexe na atualização da Bia: o PC é sempre o do token.
    const alheia = await chamar(ana, "/atualizacao/soltar", { epoca: 1 });
    expect(alheia.statusCode).toBe(409);
    expect(alheia.json()).toMatchObject({ motivo: "nao_e_dono" });
    expect((await chamar(bia, "/atualizacao/soltar", { epoca: 1 })).statusCode).toBe(200);
    expect((await chamar(bia, "/trava/pegar")).json()).toMatchObject({ ok: true, epoca: 2 });
  });
});
