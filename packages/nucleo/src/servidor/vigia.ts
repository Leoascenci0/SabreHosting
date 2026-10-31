// Vigia do servidor: processo Node pequeno entre o app e o Java (no app, o próprio Electron com
// ELECTRON_RUN_AS_NODE=1). Se o app morre com o servidor no ar (fechado à força, queda), ninguém mais renova a trava
// do cartório; o vigia percebe pelo fim do stdin e salva e para o servidor bem antes de a trava vencer (regra de
// ouro 1). Nunca fala com o cartório e nunca copia o mundo (regra de ouro 2): só salva e para.
//
// Uso: vigia <prazoSalvarMs> <prazoPararMs> <prazoStopPedidoMs> <java> <args do java…>. O último é quanto esperar
// quando o app já tinha mandado `stop` antes de morrer (o prazo da parada normal: o save de mundo grande demora). A 1ª linha da saída é
// `[sabre-vigia] pid <n>` (ou `[sabre-vigia] falhou <motivo>`); depois, a saída do Java como veio. Sai com o código
// do Java.
import { spawn } from "node:child_process";
import { createInterface } from "node:readline";
import { SALVOU } from "./comandos.js";

const [prazoSalvar, prazoParar, prazoStopPedido, java, ...args] = process.argv.slice(2);
if (java === undefined) {
  console.error("Uso: vigia <prazoSalvarMs> <prazoPararMs> <prazoStopPedidoMs> <java> <args…>");
  process.exit(2);
}
const env = { ...process.env };
delete env["ELECTRON_RUN_AS_NODE"];
const servidor = spawn(java, args, { stdio: "pipe", shell: false, windowsHide: true, env });

// App morto: escrever para ele dá EPIPE; o vigia segue lendo o Java (é justamente quando ele é preciso). Sem `pipe`:
// ele pausaria a leitura do Java no primeiro erro, e o vigia não veria mais o "Saved the game".
let appSumiu = false;
process.stdout.on("error", () => (appSumiu = true));
process.stderr.on("error", () => {});
servidor.stdin.on("error", () => {});
const entrada = createInterface({ input: process.stdin, crlfDelay: Infinity });

let saiu = false;
let pediuStop = false;
const aoSair: (() => void)[] = [];
const aoLinha = new Set<(linha: string) => void>();

if (servidor.pid !== undefined) process.stdout.write(`[sabre-vigia] pid ${servidor.pid}\n`);
servidor.once("error", (erro) => {
  if (servidor.pid !== undefined) return; // erro depois de subir: o `close` cuida.
  saiu = true;
  process.stdout.write(`[sabre-vigia] falhou ${erro.message.replace(/[\r\n]+/g, " ")}\n`);
  process.exitCode = 1;
  entrada.close();
  process.stdin.destroy();
});
servidor.stdout.on("data", (d: Buffer) => appSumiu || process.stdout.write(d));
servidor.stderr.on("data", (d: Buffer) => appSumiu || process.stderr.write(d));
createInterface({ input: servidor.stdout }).on("line", (l) => aoLinha.forEach((cb) => cb(l)));

entrada.on("line", (linha) => {
  if (linha.trim() === "stop") pediuStop = true;
  servidor.stdin.write(`${linha}\n`);
});
entrada.on("close", () => void encerrarOrfao());

servidor.once("close", (codigo, sinal) => {
  saiu = true;
  aoSair.forEach((cb) => cb());
  entrada.close();
  process.stdin.destroy();
  if (sinal && process.platform !== "win32") {
    process.stdout.write("", () => process.kill(process.pid, sinal));
  } else process.exitCode ??= codigo ?? 1; // Java que nem subiu: fica o 1 da falha
});

/** Espera a linha que casa com `re` (ou o Java sair) por até `prazoMs`; `true` = chegou a linha. */
function esperarLinha(re: RegExp, prazoMs: number): Promise<boolean> {
  return new Promise((ok) => {
    const fim = (r: boolean) => {
      clearTimeout(timer);
      aoLinha.delete(olhar);
      ok(r);
    };
    const olhar = (l: string) => re.test(l) && fim(true);
    const timer = setTimeout(() => fim(false), prazoMs);
    aoLinha.add(olhar);
    aoSair.push(() => fim(false));
  });
}

function esperarSaida(prazoMs: number): Promise<void> {
  return new Promise((ok) => {
    if (saiu) return ok();
    const timer = setTimeout(ok, prazoMs);
    aoSair.push(() => {
      clearTimeout(timer);
      ok();
    });
  });
}

/** O app sumiu: salva, para e só mata o Java se ele não sair (nunca matar sem salvar se há como salvar). */
async function encerrarOrfao(): Promise<void> {
  if (saiu) return;
  // `stop` já pedido pelo app (parada normal, ou o app saiu logo depois): não repete; só espera sair, com o prazo
  // da parada normal.
  if (pediuStop) {
    await esperarSaida(Number(prazoStopPedido));
  } else {
    const salvou = esperarLinha(SALVOU, Number(prazoSalvar));
    servidor.stdin.write("save-all flush\n");
    await salvou;
    if (saiu) return;
    servidor.stdin.write("stop\n");
    await esperarSaida(Number(prazoParar));
  }
  if (!saiu) servidor.kill("SIGKILL");
}
