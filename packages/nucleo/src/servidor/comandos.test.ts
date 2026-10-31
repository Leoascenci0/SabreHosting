import { spawn } from "node:child_process";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { MAX_FILA, list, salvarSeguro, say } from "./comandos.js";
import { iniciarServidor, type ServidorMinecraft } from "./processo.js";
import { ARGS_VIGIA_TESTE } from "../../test/ajuda/vigia.js";

const FALSO = join(dirname(fileURLToPath(import.meta.url)), "../../test/ajuda/servidor-falso.mjs");
const NEO = "21.1.172";

let pasta: string;
let criados: ChildProcess[];
let servidores: ServidorMinecraft[];
let logs: string[];

function espiao(cmd: string, args: readonly string[], opcoes: SpawnOptions): ChildProcess {
  const filho = spawn(cmd, args, opcoes);
  criados.push(filho);
  return filho;
}

async function subir(modo = "normal", jogadores = ""): Promise<ServidorMinecraft> {
  const s = await iniciarServidor({
    pasta,
    javaPath: process.execPath,
    versaoNeoForge: NEO,
    temTrava: async () => true,
    prefixoArgs: [FALSO, modo, jogadores],
    vigiaArgs: ARGS_VIGIA_TESTE,
    spawnFn: espiao,
    memoriaTotalBytes: 16 * 1024 ** 3,
    plataforma: "linux",
    prazoParadaMs: 5000,
  });
  servidores.push(s);
  s.on("log", (e: { texto: string }) => logs.push(e.texto));
  return s;
}

async function pronto(modo = "normal", jogadores = ""): Promise<ServidorMinecraft> {
  const s = await subir(modo, jogadores);
  if (s.estado !== "pronto") {
    await new Promise<void>((resolve) =>
      s.on("estado", (e: { estado: string }) => e.estado === "pronto" && resolve()),
    );
  }
  return s;
}

/** Espera uma linha do log aparecer (o falso devolve cada linha recebida como "RECEBIDO ..."). */
async function esperarLog(trecho: string): Promise<void> {
  for (let i = 0; i < 200; i++) {
    if (logs.some((l) => l.includes(trecho))) return;
    await new Promise((r) => setTimeout(r, 25));
  }
  throw new Error(`log não trouxe "${trecho}": ${logs.join(" | ")}`);
}

const recebidos = () =>
  logs.filter((l) => l.includes("RECEBIDO ")).map((l) => l.split("RECEBIDO ")[1]);

beforeEach(async () => {
  pasta = await mkdtemp(join(tmpdir(), "sabre-cmd-"));
  await writeFile(join(pasta, "eula.txt"), "eula=true\n");
  const dir = join(pasta, "libraries/net/neoforged/neoforge", NEO);
  await mkdir(dir, { recursive: true });
  for (const arq of ["unix_args.txt", "win_args.txt"]) await writeFile(join(dir, arq), "# args\n");
  criados = [];
  servidores = [];
  logs = [];
});

afterEach(async () => {
  for (const s of servidores) await s.pararServidor().catch(() => {});
  for (const filho of criados) {
    if (filho.exitCode === null && filho.signalCode === null) filho.kill("SIGKILL");
  }
  for (const filho of criados) {
    if (filho.pid === undefined) continue;
    await new Promise((r) =>
      filho.exitCode !== null || filho.signalCode ? r(0) : filho.once("exit", r),
    );
    expect(() => process.kill(filho.pid as number, 0)).toThrow();
  }
  await rm(pasta, { recursive: true, force: true });
});

describe("enviar", () => {
  it("recusa quebra de linha e caractere de controle, sem mandar nada ao servidor", async () => {
    const s = await pronto();
    for (const ruim of ["say a\nstop", "say a\rstop", "say a\u0000b", "say a\u001bb", "x y"]) {
      expect(() => s.enviar(ruim)).toThrow(/controle|quebra/);
    }
    s.enviar("list");
    await esperarLog("RECEBIDO list");
    expect(recebidos()).toEqual(["list"]);
    expect(s.estado).toBe("pronto");
  });

  it("recusa linha acima do teto de tamanho, sem mandar nada", async () => {
    const s = await pronto();
    expect(() => s.enviar(`say ${"a".repeat(1100)}`)).toThrow(/passa de 1024/);
    expect(recebidos()).toEqual([]);
    expect(s.estado).toBe("pronto");
  });

  it("recusa quando o servidor não está pronto", async () => {
    const s = await subir("semdone");
    expect(s.estado).toBe("subindo");
    expect(() => s.enviar("list")).toThrow(/pronto/);
    expect(recebidos()).toEqual([]);
  });
});

describe("salvarSeguro", () => {
  it("só chama `copiar` depois do `Saved the game`; save-on vem depois da cópia", async () => {
    const s = await pronto();
    let vistoNaCopia: string[] = [];
    await salvarSeguro(s, async () => {
      vistoNaCopia = [...logs];
    });
    expect(vistoNaCopia.some((l) => /\]: Saved the game$/.test(l))).toBe(true);
    await esperarLog("RECEBIDO save-on");
    expect(recebidos()).toEqual(["save-off", "save-all flush", "save-on"]);
    expect(vistoNaCopia.some((l) => l.includes("RECEBIDO save-on"))).toBe(false);
  });

  it("devolve o que `copiar` devolve", async () => {
    const s = await pronto();
    expect(await salvarSeguro(s, async () => 42)).toBe(42);
  });

  it("manda save-on mesmo quando `copiar` lança, e o erro original sobe", async () => {
    const s = await pronto();
    await expect(
      salvarSeguro(s, async () => {
        throw new Error("disco cheio");
      }),
    ).rejects.toThrow("disco cheio");
    await esperarLog("RECEBIDO save-on");
    expect(recebidos()).toEqual(["save-off", "save-all flush", "save-on"]);
  });

  it("prazo estourado: não copia, manda save-on e avisa", async () => {
    const s = await pronto("mudo");
    let copiou = false;
    await expect(
      salvarSeguro(
        s,
        async () => {
          copiou = true;
        },
        300,
      ),
    ).rejects.toThrow(/não confirmou/);
    await esperarLog("RECEBIDO save-on");
    expect(copiou).toBe(false);
  });

  it("sem a confirmação do save-off a cópia não roda, e o save-on volta", async () => {
    const s = await pronto("semoff");
    let copiou = false;
    await expect(
      salvarSeguro(
        s,
        async () => {
          copiou = true;
        },
        300,
      ),
    ).rejects.toThrow(/não confirmou/);
    await esperarLog("RECEBIDO save-on");
    expect(copiou).toBe(false);
    expect(recebidos()).toEqual(["save-off", "save-on"]);
  });

  it("cópia que passa do prazo é cancelada e termina ANTES do save-on", async () => {
    const s = await pronto();
    let cancelada = false;
    let saveOnAntesDoFim = true;
    await expect(
      salvarSeguro(
        s,
        (sinal) =>
          new Promise<void>((resolve) => {
            sinal.addEventListener("abort", () => {
              cancelada = true;
              setTimeout(() => {
                saveOnAntesDoFim = logs.some((l) => l.includes("RECEBIDO save-on"));
                resolve();
              }, 200);
            });
          }),
        5000,
        300,
      ),
    ).rejects.toThrow(/passou do prazo; nada foi guardado/);
    expect(cancelada).toBe(true);
    expect(saveOnAntesDoFim).toBe(false);
    await esperarLog("RECEBIDO save-on");
    expect(recebidos()).toEqual(["save-off", "save-all flush", "save-on"]);
  });

  it("chat de jogador imitando a confirmação NÃO libera a cópia", async () => {
    const s = await pronto("mudo");
    let copiou = false;
    const r = salvarSeguro(
      s,
      async () => {
        copiou = true;
      },
      400,
    );
    await esperarLog("<Mallory> Saved the game");
    await expect(r).rejects.toThrow();
    expect(copiou).toBe(false);
  });

  it("servidor que não está pronto: recusa sem mandar nada", async () => {
    const s = await subir("semdone");
    let copiou = false;
    await expect(
      salvarSeguro(s, async () => {
        copiou = true;
      }),
    ).rejects.toThrow(/pronto/);
    expect(copiou).toBe(false);
    expect(recebidos()).toEqual([]);
  });

  it("servidor que sai durante a espera: falha logo, sem esperar o prazo inteiro", async () => {
    const s = await pronto("mudo");
    const t0 = Date.now();
    const r = salvarSeguro(s, async () => {}, 20_000);
    await esperarLog("RECEBIDO save-all flush");
    void s.pararServidor();
    await expect(r).rejects.toThrow();
    expect(Date.now() - t0).toBeLessThan(5000);
  });
});

describe("say", () => {
  it("chega ao servidor como uma linha só", async () => {
    const s = await pronto();
    await say(s, "Troca de host em 1 minuto");
    await esperarLog("RECEBIDO say Troca de host em 1 minuto");
    expect(recebidos()).toEqual(["say Troca de host em 1 minuto"]);
  });

  it("recusa quebra de linha, controle, vazio e mais de 256 caracteres", async () => {
    const s = await pronto();
    await expect(say(s, "oi\nstop")).rejects.toThrow();
    await expect(say(s, "oi\rstop")).rejects.toThrow();
    await expect(say(s, "oi\u0007")).rejects.toThrow();
    await expect(say(s, "   ")).rejects.toThrow();
    await expect(say(s, "a".repeat(257))).rejects.toThrow(/256/);
    await expect(say(s, "cor §cvermelha")).rejects.toThrow(/§/);
    await say(s, "a".repeat(256));
    await esperarLog("RECEBIDO say aaaa");
    expect(recebidos()).toEqual([`say ${"a".repeat(256)}`]);
    expect(s.estado).toBe("pronto");
  });
});

describe("list", () => {
  it("0 jogadores", async () => {
    const s = await pronto("normal", "");
    expect(await list(s)).toEqual({ online: 0, maximo: 20, nomes: [] });
  });

  it("2 jogadores", async () => {
    const s = await pronto("normal", "Ana,Bia");
    expect(await list(s)).toEqual({ online: 2, maximo: 20, nomes: ["Ana", "Bia"] });
  });

  it("servidor não pronto: recusa sem mandar nada", async () => {
    const s = await subir("semdone");
    await expect(list(s)).rejects.toThrow(/pronto/);
    expect(recebidos()).toEqual([]);
  });
});

describe("fila", () => {
  it("comandos concorrentes saem em ordem, e salvarSeguro ocupa a fila inteira", async () => {
    const s = await pronto("normal", "Ana");
    const ordem: string[] = [];
    await Promise.all([
      say(s, "um").then(() => ordem.push("um")),
      salvarSeguro(s, async () => void ordem.push("copia")).then(() => ordem.push("salvo")),
      say(s, "dois").then(() => ordem.push("dois")),
      list(s).then(() => ordem.push("list")),
    ]);
    await esperarLog("RECEBIDO list");
    expect(recebidos()).toEqual([
      "say um",
      "save-off",
      "save-all flush",
      "save-on",
      "say dois",
      "list",
    ]);
    expect(ordem).toEqual(["um", "copia", "salvo", "dois", "list"]);
  });

  it("fila acima do limite é recusada na hora; as já aceitas seguem", async () => {
    const s = await pronto("mudo");
    const presas = [salvarSeguro(s, async () => {}, 400).catch(() => "caiu")];
    for (let i = 1; i < MAX_FILA; i++) presas.push(say(s, `n${i}`).then(() => "ok"));
    await expect(say(s, "excedente")).rejects.toThrow(/fila/);
    expect(await Promise.all(presas)).toHaveLength(MAX_FILA);
    await esperarLog(`RECEBIDO say n${MAX_FILA - 1}`);
    expect(recebidos()).not.toContain("say excedente");
    await say(s, "depois");
  });

  it("falha de um comando não trava os seguintes", async () => {
    const s = await pronto();
    const [a, b] = await Promise.allSettled([say(s, "ruim\nlinha"), say(s, "bom")]);
    expect(a.status).toBe("rejected");
    expect(b.status).toBe("fulfilled");
  });
});
