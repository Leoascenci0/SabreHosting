import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Worker } from "node:worker_threads";
import { afterEach, describe, expect, it } from "vitest";
import { abrirBanco, criarConvite } from "./banco.js";

const RODADAS = 20;
const HORA = 3_600_000;
const pastas: string[] = [];
const fechar: Array<() => unknown> = [];

afterEach(async () => {
  for (const f of fechar.splice(0)) await f();
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

type Resposta = { pronto?: boolean; rodada: number; venceu?: boolean; erro?: string };

/** Dois workers, cada um com a sua conexão ao mesmo arquivo, usam o MESMO convite ao mesmo tempo, em cada rodada. */
async function disputar(comSalaProvisoria: boolean) {
  const pasta = mkdtempSync(join(tmpdir(), "sabre-corrida-convite-"));
  pastas.push(pasta);
  const caminho = join(pasta, "cartorio.db");
  const banco = abrirBanco(caminho);
  fechar.push(() => banco.close());
  const convites = Array.from({ length: RODADAS }, () =>
    criarConvite(
      banco,
      "PC do Lucas",
      0,
      HORA,
      comSalaProvisoria ? { ipProv: "10.66.0.200", chavePubProv: "chave-provisoria" } : undefined,
    ),
  );
  const sinal = new SharedArrayBuffer(4);
  const barreira = new Int32Array(sinal);
  const recebidos: Resposta[] = [];
  let prontos = 0;
  let avisar = () => {};
  const workers = [0, 1].map((indice) => {
    const w = new Worker(new URL("./corrida-convite.worker.mjs", import.meta.url), {
      workerData: { caminho, sinal, convites, caminhoNovo: comSalaProvisoria, indice },
    });
    w.on("message", (m: Resposta) => {
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

  await ate(() => prontos === 2);
  for (let rodada = 1; rodada <= RODADAS; rodada++) {
    Atomics.store(barreira, 0, rodada);
    Atomics.notify(barreira, 0);
    await ate(() => recebidos.length === rodada * 2);
    const daRodada = recebidos.filter((r) => r.rodada === rodada);
    // Sem erro de banco travado: o `busy_timeout` faz o segundo esperar a transação do vencedor e levar a recusa.
    expect(daRodada.filter((r) => r.erro)).toEqual([]);
    expect(daRodada.filter((r) => r.venceu)).toHaveLength(1);
  }
  // Um convite, um PC, um token.
  expect(banco.prepare("SELECT COUNT(*) AS n FROM pcs").get()).toEqual({ n: RODADAS });
  expect(banco.prepare("SELECT COUNT(*) AS n FROM tokens").get()).toEqual({ n: RODADAS });
}

describe("convite: corrida entre dois processos", () => {
  it("usarConvite: exatamente 1 vence e o outro recebe recusa, 20 rodadas", async () => {
    await disputar(false);
  }, 30_000);

  it("entrarPeloConvite (sala provisória): exatamente 1 vence e o outro recebe recusa, 20 rodadas", async () => {
    await disputar(true);
  }, 30_000);
});
