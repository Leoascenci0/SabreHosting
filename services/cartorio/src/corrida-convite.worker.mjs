// Worker do teste de corrida do convite (corrida-convite.test.ts): cada um abre a PRÓPRIA conexão ao mesmo arquivo
// de banco e usa o convite da rodada quando a barreira abre (chaves definitivas diferentes: a mesma chave é repetição legítima). Roda o código-fonte .ts direto.
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

const { abrirBanco, usarConvite, entrarPeloConvite } = await import("./banco.ts");
const { caminho, sinal, convites, caminhoNovo, indice } = workerData;
const banco = abrirBanco(caminho);
const barreira = new Int32Array(sinal);
parentPort.postMessage({ pronto: true });
for (let rodada = 1; rodada <= convites.length; rodada++) {
  Atomics.wait(barreira, 0, rodada - 1);
  const convite = convites[rodada - 1];
  try {
    const r = caminhoNovo
      ? entrarPeloConvite(banco, convite, `chave-definitiva-${indice}`, rodada)
      : usarConvite(banco, convite, rodada);
    parentPort.postMessage({ rodada, venceu: r !== undefined });
  } catch (erro) {
    parentPort.postMessage({ rodada, erro: String(erro) });
  }
}
banco.close();
