import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { ARGS_VIGIA_TESTE } from "../../test/ajuda/vigia.js";

const AQUI = dirname(fileURLToPath(import.meta.url));
const FALSO = join(AQUI, "../../test/ajuda/servidor-falso.mjs");

let vivos: ChildProcessWithoutNullStreams[] = [];
let pidsJava: number[] = [];

function vivo(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/** Sobe o vigia com o servidor falso no lugar do Java e junta tudo o que ele repassa. */
/** `prazos`: salvar, parar (app morto) e parar quando o app já tinha mandado `stop`. */
function subir(
  modo: string,
  prazos: [number, number, number?] = [10_000, 10_000],
  java = process.execPath,
  argsJava = [FALSO, modo],
) {
  const [salvar, parar, pararPedido = parar] = prazos;
  const filho = spawn(
    process.execPath,
    [...ARGS_VIGIA_TESTE, String(salvar), String(parar), String(pararPedido), java, ...argsJava],
    { stdio: "pipe", env: { ...process.env, ELECTRON_RUN_AS_NODE: "1" } },
  );
  vivos.push(filho);
  let saida = "";
  const linha = (re: RegExp) =>
    new Promise<string>((ok) => {
      const olhar = () => {
        const achou = saida.split("\n").find((l) => re.test(l));
        if (achou === undefined) return false;
        filho.stdout.off("data", olhar);
        ok(achou);
        return true;
      };
      if (!olhar()) filho.stdout.on("data", olhar);
    });
  filho.stdout.setEncoding("utf8");
  filho.stdout.on("data", (d: string) => (saida += d));
  const fim = new Promise<{ codigo: number | null; sinal: NodeJS.Signals | null }>((ok) =>
    filho.once("close", (codigo, sinal) => ok({ codigo, sinal })),
  );
  const pronto = async () => {
    const pid = Number(/^\[sabre-vigia\] pid (\d+)$/.exec(await linha(/^\[sabre-vigia\]/))?.[1]);
    pidsJava.push(pid);
    await linha(/Done \(/);
    return pid;
  };
  return { filho, linha, fim, pronto, saida: () => saida };
}

afterEach(async () => {
  for (const f of vivos) if (f.exitCode === null && f.signalCode === null) f.kill("SIGKILL");
  for (const pid of pidsJava) if (pid && vivo(pid)) process.kill(pid, "SIGKILL");
  vivos = [];
  pidsJava = [];
});

describe("vigia do servidor", () => {
  it("a 1ª linha é o PID do Java e os comandos do app chegam ao servidor", async () => {
    const v = subir("normal");
    const pid = await v.pronto();
    expect(v.saida().startsWith(`[sabre-vigia] pid ${pid}\n`)).toBe(true);
    expect(vivo(pid)).toBe(true);
    v.filho.stdin.write("list\n");
    await v.linha(/RECEBIDO list/);
    v.filho.stdin.write("stop\n");
    expect(await v.fim).toEqual({ codigo: 0, sinal: null });
  });

  it("app morto (stdin fechado): salva, para e sai antes de 20 s, mesmo sem ninguém lendo a saída", async () => {
    const v = subir("normal");
    const pid = await v.pronto();
    const inicio = Date.now();
    v.filho.stdout.destroy(); // o app morreu: escrever para ele dá EPIPE
    v.filho.stdin.end();
    expect(await v.fim).toEqual({ codigo: 0, sinal: null }); // o falso só sai com 0 pelo `stop`
    expect(Date.now() - inicio).toBeLessThan(20_000);
    expect(vivo(pid)).toBe(false);
  });

  it("app morto: `save-all flush` chega e é confirmado antes do `stop`", async () => {
    const v = subir("travado", [10_000, 300]);
    await v.pronto();
    v.filho.stdin.end();
    await v.fim;
    const s = v.saida();
    expect(s.indexOf("RECEBIDO save-all flush")).toBeGreaterThan(-1);
    expect(s.indexOf("RECEBIDO stop")).toBeGreaterThan(s.indexOf("]: Saved the game"));
  });

  it("servidor que ignora `stop`: só é morto depois do save, e nenhum Java sobra", async () => {
    const v = subir("travado", [10_000, 300]);
    const pid = await v.pronto();
    v.filho.stdin.end();
    const fim = await v.fim;
    expect(v.saida()).toContain("]: Saved the game");
    expect(fim.codigo === 0).toBe(false);
    expect(vivo(pid)).toBe(false);
  });

  it("servidor que nunca confirma o save: para mesmo assim depois do prazo", async () => {
    const v = subir("mudo", [300, 10_000]);
    const pid = await v.pronto();
    v.filho.stdin.end();
    expect(await v.fim).toEqual({ codigo: 0, sinal: null });
    expect(vivo(pid)).toBe(false);
  });

  it("parada normal do app (`stop` e depois o app sai) não repete save nem stop", async () => {
    const v = subir("travado", [10_000, 300]);
    await v.pronto();
    v.filho.stdin.end("stop\n");
    await v.fim;
    const s = v.saida();
    expect(s).not.toContain("save-all");
    expect(s.match(/RECEBIDO stop/g)).toHaveLength(1);
  });

  it("app que já mandou `stop` e morre: espera o prazo da parada normal, não o curto", async () => {
    const v = subir("travado", [10_000, 100, 800]);
    const pid = await v.pronto();
    const inicio = Date.now();
    v.filho.stdin.end("stop\n");
    await v.fim;
    expect(Date.now() - inicio).toBeGreaterThanOrEqual(700); // mundo grande: o save do `stop` não é cortado
    expect(vivo(pid)).toBe(false);
  });

  it("o Java não herda o ELECTRON_RUN_AS_NODE do vigia", async () => {
    const v = subir("", undefined, process.execPath, [
      "-e",
      'console.log("ENV=" + (process.env.ELECTRON_RUN_AS_NODE ?? "nada"))',
    ]);
    await v.fim;
    expect(v.saida()).toContain("ENV=nada\n");
  });

  it("Java que não existe: a 1ª linha diz a falha e o vigia sai com erro", async () => {
    const v = subir("normal", undefined, join(AQUI, "nao-existe"));
    expect(await v.linha(/^\[sabre-vigia\]/)).toMatch(/^\[sabre-vigia\] falhou /);
    expect((await v.fim).codigo).toBe(1);
  });
});
