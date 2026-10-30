import { availableParallelism, freemem } from "node:os";
import { Worker } from "node:worker_threads";
import type { Medicao } from "./formula.js";

export const TETO_MS = 15_000;

/** Laço de inteiros por `janelaMs`; devolve milhões de passos por segundo. Roda dentro do worker. */
const CODIGO_DO_LACO = `
const { workerData, parentPort } = require("node:worker_threads");
let x = 1, passos = 0;
const inicio = performance.now();
while (performance.now() - inicio < workerData.janelaMs) {
  for (let i = 0; i < 100000; i++) x = (Math.imul(x, 1664525) + 1013904223) | 0;
  passos += 100000;
}
parentPort.postMessage(passos / (performance.now() - inicio) / 1000);
`;

/** Um worker (fora da linha principal, para a tela do app não travar); `abort` o termina. */
function rodarLaco(janelaMs: number, sinal: AbortSignal): Promise<number> {
  return new Promise((resolver, rejeitar) => {
    const w = new Worker(CODIGO_DO_LACO, { eval: true, workerData: { janelaMs } });
    const parar = () => void w.terminate().then(() => rejeitar(sinal.reason));
    sinal.addEventListener("abort", parar, { once: true });
    w.once("message", (v: number) => resolver(v));
    w.once("error", rejeitar);
    w.once("exit", () => sinal.removeEventListener("abort", parar));
  });
}

export interface OpcoesMedicao {
  /** Velocidade de envio em Mbit/s; vem de fora até o cartório existir. */
  uploadMbps: number;
  /** Duração de cada laço (padrão 1,5 s). */
  janelaMs?: number;
  tetoMs?: number;
  /** Só para teste: troca a medição de um núcleo. */
  cpuUmNucleo?: (sinal: AbortSignal) => Promise<number>;
}

/** Mede o PC com teto de tempo; ao estourar, termina os workers e falha com mensagem para o amigo. */
export async function medirPc(op: OpcoesMedicao): Promise<Medicao> {
  const janela = op.janelaMs ?? 1500;
  const teto = op.tetoMs ?? TETO_MS;
  const controle = new AbortController();
  const timer = setTimeout(
    () =>
      controle.abort(
        new Error(`A medição do PC passou de ${Math.round(teto / 1000)} s e foi cancelada.`),
      ),
    teto,
  );
  try {
    const cpuUmNucleo = await (op.cpuUmNucleo ?? ((s) => rodarLaco(janela, s)))(controle.signal);
    const todos = await Promise.all(
      Array.from({ length: availableParallelism() }, () => rodarLaco(janela, controle.signal)),
    );
    return {
      cpuUmNucleo,
      cpuNucleos: todos.reduce((a, b) => a + b, 0),
      ramLivreMb: Math.round(freemem() / 1024 / 1024),
      uploadMbps: op.uploadMbps,
    };
  } finally {
    clearTimeout(timer);
  }
}
