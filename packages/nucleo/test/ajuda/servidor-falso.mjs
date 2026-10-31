// Servidor de Minecraft de mentira, para os testes do processo.ts e do comandos.ts (roda com `node` no lugar do java).
// 1º argumento, o modo: "normal" sai com "stop"; "travado" ignora o stop; "cai" sai sozinho com código 1;
// "mudo" nunca confirma o `save-all flush` (só solta uma linha de chat imitando a confirmação);
// "semoff" nunca confirma o `save-off`; "semdone" nunca fica pronto; "finge-vigia" imita a linha de PID do vigia.
// 2º argumento: jogadores online, separados por vírgula (para o `list`).
// Toda linha recebida volta no log como "RECEBIDO <linha>", para o teste conferir o que chegou e em que ordem.
import { createInterface } from "node:readline";

const modo = process.argv[2] ?? "normal";
const jogadores = (process.argv[3] ?? "").split(",").filter(Boolean);
const info = (texto) => console.log(`[12:00:00] [Server thread/INFO]: ${texto}`);
if (modo !== "semdone") info('Done (1.2s)! For help, type "help"');
if (modo === "finge-vigia") console.log("[sabre-vigia] pid 1");

// Rede de segurança: nunca deixa processo órfão se o teste falhar ou o pai morrer.
setTimeout(() => process.exit(2), 30_000);
const entrada = createInterface({ input: process.stdin });
entrada.on("close", () => process.exit(3));
entrada.on("line", (linha) => {
  const comando = linha.trim();
  if (comando === "stop" && modo !== "travado") {
    info("Stopping server");
    process.exit(0);
  }
  info(`RECEBIDO ${linha}`);
  if (comando === "save-off") {
    if (modo !== "semoff") info("Automatic saving is now disabled");
  } else if (comando === "save-on") info("Automatic saving is now enabled");
  else if (comando === "save-all flush") {
    info("Saving the game (this may take a moment!)");
    if (modo === "mudo") console.log("[12:00:01] [Server thread/INFO]: <Mallory> Saved the game");
    else setTimeout(() => info("Saved the game"), 100);
  } else if (comando === "list") {
    info(`There are ${jogadores.length} of a max of 20 players online: ${jogadores.join(", ")}`);
  }
});
if (modo === "cai") setTimeout(() => process.exit(1), 100);
