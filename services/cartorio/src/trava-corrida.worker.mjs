// Worker do teste de corrida da trava (trava.test.ts, atualizacao.test.ts): cada um abre a PRÓPRIA conexão ao mesmo
// arquivo de banco e chama `pegar` (ou `pegarAtualizacao`, com `operacao: "atualizacao"`) quando a barreira da rodada
// abre. Roda o código-fonte .ts direto (o Node tira os tipos sozinho).
import { registerHooks } from "node:module";
import { parentPort, workerData } from "node:worker_threads";

// O código importa "./banco.js" (saída do tsc); aqui só existe o .ts.
registerHooks({
  resolve(especificador, contexto, proximo) {
    try {
      return proximo(especificador, contexto);
    } catch (erro) {
      if (!especificador.startsWith(".") || !especificador.endsWith(".js")) throw erro;
      return proximo(`${especificador.slice(0, -3)}.ts`, contexto);
    }
  },
});

const { abrirBanco } = await import("./banco.ts");
const { pegar } = await import("./trava.ts");
const { pegarAtualizacao } = await import("./atualizacao.ts");
const { caminho, pc, sinal, rodadas, prazoMs, operacao = "host" } = workerData;
const pegarAgora = operacao === "host" ? pegar : pegarAtualizacao;
const banco = abrirBanco(caminho);
const barreira = new Int32Array(sinal);
parentPort.postMessage({ pronto: true });
for (let rodada = 1; rodada <= rodadas; rodada++) {
  Atomics.wait(barreira, 0, rodada - 1);
  const r = pegarAgora(banco, pc, rodada * 1_000_000, prazoMs);
  parentPort.postMessage({ rodada, pc, operacao, ok: r.ok, epoca: r.epoca });
}
banco.close();
