// Servidor de Minecraft de mentira, para os testes do processo.ts (roda com `node` no lugar do java).
// Modo (1º argumento): "normal" sai com "stop"; "travado" ignora o stop; "cai" sai sozinho com código 1.
import { createInterface } from "node:readline";

const modo = process.argv[2] ?? "normal";
console.log('[12:00:00] [Server thread/INFO]: Done (1.2s)! For help, type "help"');

// Rede de segurança: nunca deixa processo órfão se o teste falhar ou o pai morrer.
setTimeout(() => process.exit(2), 30_000);
const entrada = createInterface({ input: process.stdin });
entrada.on("close", () => process.exit(3));
entrada.on("line", (linha) => {
  if (linha.trim() === "stop" && modo !== "travado") {
    console.log("[12:00:05] [Server thread/INFO]: Stopping server");
    process.exit(0);
  }
});
if (modo === "cai") setTimeout(() => process.exit(1), 100);
