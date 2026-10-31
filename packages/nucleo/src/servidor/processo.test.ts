import { spawn } from "node:child_process";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  iniciarServidor,
  ramAutomaticaMb,
  type EstadoServidor,
  type OpcoesIniciar,
  type ServidorMinecraft,
} from "./processo.js";

const FALSO = join(dirname(fileURLToPath(import.meta.url)), "../../test/ajuda/servidor-falso.mjs");
const GB = 1024 ** 3;
const NEO = "21.1.172";

let pasta: string;
let criados: ChildProcess[];
let chamadas: { cmd: string; args: readonly string[]; opcoes: SpawnOptions }[];
let servidores: ServidorMinecraft[];

/** `spawn` de verdade, mas anotando tudo para conferir argumentos e órfãos. */
function espiao(cmd: string, args: readonly string[], opcoes: SpawnOptions): ChildProcess {
  chamadas.push({ cmd, args, opcoes });
  const filho = spawn(cmd, args, opcoes);
  criados.push(filho);
  return filho;
}

function opcoes(modo = "normal", extra: Partial<OpcoesIniciar> = {}): OpcoesIniciar {
  return {
    pasta,
    javaPath: process.execPath,
    versaoNeoForge: NEO,
    temTrava: async () => true,
    prefixoArgs: [FALSO, modo],
    spawnFn: espiao,
    memoriaTotalBytes: 16 * GB,
    plataforma: "linux",
    prazoParadaMs: 5000,
    ...extra,
  };
}

async function subir(modo = "normal", extra: Partial<OpcoesIniciar> = {}) {
  const s = await iniciarServidor(opcoes(modo, extra));
  servidores.push(s);
  return s;
}

function esperarEstado(s: ServidorMinecraft, alvo: EstadoServidor): Promise<void> {
  if (s.estado === alvo) return Promise.resolve();
  return new Promise((resolve) => {
    s.on("estado", (e: { estado: EstadoServidor }) => {
      if (e.estado === alvo) resolve();
    });
  });
}

beforeEach(async () => {
  pasta = await mkdtemp(join(tmpdir(), "sabre-proc-"));
  await writeFile(join(pasta, "eula.txt"), "eula=true\n");
  for (const arq of ["unix_args.txt", "win_args.txt"]) {
    const dir = join(pasta, "libraries/net/neoforged/neoforge", NEO);
    await mkdir(dir, { recursive: true });
    await writeFile(join(dir, arq), "# args\n");
  }
  criados = [];
  chamadas = [];
  servidores = [];
});

afterEach(async () => {
  for (const s of servidores) await s.pararServidor().catch(() => {});
  for (const filho of criados) {
    if (filho.exitCode === null && filho.signalCode === null) filho.kill("SIGKILL");
  }
  // Nenhum processo filho pode sobrar depois do teste.
  for (const filho of criados) {
    if (filho.pid === undefined) continue;
    await new Promise((r) =>
      filho.exitCode !== null || filho.signalCode ? r(0) : filho.once("exit", r),
    );
    expect(() => process.kill(filho.pid as number, 0)).toThrow();
  }
  await rm(pasta, { recursive: true, force: true });
});

describe("ramAutomaticaMb", () => {
  it("é metade da RAM total, arredondada para baixo em MB, com teto de 12 GB", () => {
    expect(ramAutomaticaMb(16 * GB)).toBe(8192);
    expect(ramAutomaticaMb(8 * GB + 1500)).toBe(4096);
    expect(ramAutomaticaMb(64 * GB)).toBe(12288);
  });
});

describe("ciclo de estados", () => {
  it("parado → subindo → pronto → parando → parado", async () => {
    const s = await subir();
    const vistos: EstadoServidor[] = [s.estado];
    s.on("estado", (e: { estado: EstadoServidor }) => vistos.push(e.estado));
    expect(s.estado).toBe("subindo");
    await esperarEstado(s, "pronto");
    await s.pararServidor();
    expect(s.estado).toBe("parado");
    expect(vistos).toEqual(["subindo", "pronto", "parando", "parado"]);
  });

  it("saída sem pedido vira `caiu` com o código de saída", async () => {
    const s = await subir("cai");
    await esperarEstado(s, "caiu");
    expect(s.codigoSaida).toBe(1);
  });

  it("Java que não existe vira `caiu` com aviso, sem derrubar o app", async () => {
    const s = await subir("normal", { javaPath: join(pasta, "nao-existe"), prefixoArgs: [] });
    const logs: string[] = [];
    s.on("log", (l: { texto: string }) => logs.push(l.texto));
    await esperarEstado(s, "caiu");
    expect(logs.some((l) => /Java/.test(l))).toBe(true);
  });

  it("Java que não existe avisa uma vez só", async () => {
    const s = await subir("normal", { javaPath: join(pasta, "nao-existe"), prefixoArgs: [] });
    const logs: string[] = [];
    s.on("log", (l: { texto: string }) => logs.push(l.texto));
    await esperarEstado(s, "caiu");
    await new Promise((r) => setTimeout(r, 200));
    expect(logs.filter((l) => /Java|encerrou/.test(l))).toHaveLength(1);
  });

  it("pararServidor em servidor que já caiu não faz nada", async () => {
    const s = await subir("cai");
    await esperarEstado(s, "caiu");
    await s.pararServidor();
    expect(s.estado).toBe("caiu");
  });
});

describe("parada", () => {
  it("prazo estourado mata o processo e avisa no log", async () => {
    const s = await subir("travado", { prazoParadaMs: 200 });
    await esperarEstado(s, "pronto");
    const logs: string[] = [];
    s.on("log", (l: { nivel: string; texto: string }) => logs.push(`${l.nivel}:${l.texto}`));
    await s.pararServidor();
    expect(s.estado).toBe("parado");
    expect(s.codigoSaida).toBeNull();
    expect(logs.some((l) => l.startsWith("aviso:") && /encerr|prazo/i.test(l))).toBe(true);
  });

  it("prazo dado na chamada vale no lugar do padrão (perda da trava)", async () => {
    const s = await subir("travado", { prazoParadaMs: 5000 });
    await esperarEstado(s, "pronto");
    const inicio = Date.now();
    await s.pararServidor(200);
    expect(s.codigoSaida).toBeNull();
    expect(Date.now() - inicio).toBeLessThan(2000);
  });

  it("parada normal sai com `stop` sem matar nem avisar", async () => {
    const s = await subir();
    await esperarEstado(s, "pronto");
    const avisos: string[] = [];
    s.on("log", (l: { nivel: string }) => l.nivel === "aviso" && avisos.push("x"));
    await s.pararServidor();
    expect(s.codigoSaida).toBe(0);
    expect(avisos).toEqual([]);
  });
});

describe("trava (regra de ouro 1)", () => {
  it("sem trava não cria processo nenhum", async () => {
    await expect(
      iniciarServidor(opcoes("normal", { temTrava: async () => false })),
    ).rejects.toThrow(/trava/i);
    expect(chamadas).toHaveLength(0);
  });

  it("falha ao consultar a trava também impede subir", async () => {
    const falha = async () => {
      throw new Error("cartório fora do ar");
    };
    await expect(iniciarServidor(opcoes("normal", { temTrava: falha }))).rejects.toThrow(/trava/i);
    expect(chamadas).toHaveLength(0);
  });

  it("temTrava que nunca responde: antes do spawn não sobe e explica", async () => {
    const nunca = () => new Promise<boolean>(() => {});
    await expect(
      iniciarServidor(opcoes("normal", { temTrava: nunca, prazoTravaMs: 50 })),
    ).rejects.toThrow(/cartório não respondeu.*sem a trava/);
    expect(chamadas).toHaveLength(0);
    await expect(readFile(join(pasta, "user_jvm_args.txt"))).rejects.toThrow();
  });

  it("sem trava ou sem EULA, nem grava o user_jvm_args.txt", async () => {
    await expect(
      iniciarServidor(opcoes("normal", { temTrava: async () => false })),
    ).rejects.toThrow();
    await writeFile(join(pasta, "eula.txt"), "eula=false\n");
    await expect(iniciarServidor(opcoes())).rejects.toThrow();
    await expect(readFile(join(pasta, "user_jvm_args.txt"))).rejects.toThrow();
  });

  it("temTrava que trava durante a execução: para o servidor e loga", async () => {
    let travar = false;
    let tique: () => void = () => {};
    const relogio = { repetir: (fn: () => void) => ((tique = fn), () => {}) };
    const temTrava = () => (travar ? new Promise<boolean>(() => {}) : Promise.resolve(true));
    const s = await subir("normal", { temTrava, relogio, prazoTravaMs: 50 });
    await esperarEstado(s, "pronto");
    const logs: string[] = [];
    s.on("log", (l: { texto: string }) => logs.push(l.texto));
    travar = true;
    tique();
    await esperarEstado(s, "parado");
    expect(logs.some((l) => /cartório não respondeu/.test(l))).toBe(true);
  });

  it("não loga perda de trava se o servidor já está parando", async () => {
    let tem = true;
    let tique: () => void = () => {};
    const relogio = { repetir: (fn: () => void) => ((tique = fn), () => {}) };
    const s = await subir("normal", { temTrava: async () => tem, relogio });
    await esperarEstado(s, "pronto");
    const logs: string[] = [];
    s.on("log", (l: { texto: string }) => logs.push(l.texto));
    tem = false;
    tique();
    const parada = s.pararServidor();
    await parada;
    await new Promise((r) => setTimeout(r, 30));
    expect(logs.some((l) => /Perdi a trava/.test(l))).toBe(false);
  });

  it("o intervalo de 20 s é cancelado ao parar e ao cair", async () => {
    const cancelamentos: string[] = [];
    const relogio = (nome: string) => ({
      repetir: () => () => void cancelamentos.push(nome),
    });
    const a = await subir("normal", { relogio: relogio("parou") });
    await esperarEstado(a, "pronto");
    await a.pararServidor();
    const b = await subir("cai", { relogio: relogio("caiu") });
    await esperarEstado(b, "caiu");
    expect(cancelamentos).toEqual(["parou", "caiu"]);
  });

  it("perder a trava com o servidor rodando para o servidor e loga o motivo", async () => {
    let tem = true;
    let tique: () => void = () => {};
    const relogio = {
      repetir: (fn: () => void, ms: number) => {
        expect(ms).toBe(20_000);
        tique = fn;
        return () => {};
      },
    };
    const s = await subir("normal", { temTrava: async () => tem, relogio });
    await esperarEstado(s, "pronto");
    const logs: string[] = [];
    s.on("log", (l: { texto: string }) => logs.push(l.texto));
    tem = false;
    tique();
    await esperarEstado(s, "parado");
    expect(logs.some((l) => /trava/i.test(l))).toBe(true);
    expect(s.codigoSaida).toBe(0);
  });

  it("sem trava, servidor que ignora o `stop` morre no prazo curto, não no da parada normal", async () => {
    let tem = true;
    let tique: () => void = () => {};
    const relogio = { repetir: (fn: () => void) => ((tique = fn), () => {}) };
    const s = await subir("travado", {
      temTrava: async () => tem,
      relogio,
      prazoParadaMs: 30_000,
      prazoParadaSemTravaMs: 200,
    });
    await esperarEstado(s, "pronto");
    tem = false;
    const inicio = Date.now();
    tique();
    await esperarEstado(s, "parado");
    expect(s.codigoSaida).toBeNull(); // morto: o `stop` foi ignorado
    expect(Date.now() - inicio).toBeLessThan(3_000);
  });

  it("parada normal (60 s) em curso é encurtada por pararSemTrava", async () => {
    const s = await subir("travado", { prazoParadaMs: 30_000, prazoParadaSemTravaMs: 200 });
    await esperarEstado(s, "pronto");
    const normal = s.pararServidor(); // `stop` ignorado: mataria só em 30 s
    await new Promise((r) => setTimeout(r, 50));
    const inicio = Date.now();
    await s.pararSemTrava();
    await normal;
    expect(s.codigoSaida).toBeNull();
    expect(Date.now() - inicio).toBeLessThan(3_000);
  });

  it("laço de 20 s sem trava durante parada normal encurta o prazo, sem aviso de perda", async () => {
    let tem = true;
    let tique: () => void = () => {};
    const relogio = { repetir: (fn: () => void) => ((tique = fn), () => {}) };
    const s = await subir("travado", {
      temTrava: async () => tem,
      relogio,
      prazoParadaMs: 30_000,
      prazoParadaSemTravaMs: 200,
    });
    await esperarEstado(s, "pronto");
    const logs: string[] = [];
    s.on("log", (l: { texto: string }) => logs.push(l.texto));
    void s.pararServidor();
    tem = false;
    const inicio = Date.now();
    tique();
    await esperarEstado(s, "parado");
    expect(Date.now() - inicio).toBeLessThan(3_000);
    expect(logs.some((l) => /Perdi a trava/.test(l))).toBe(false);
  });

  it("prazo mais longo não estica uma parada já marcada", async () => {
    const s = await subir("travado", { prazoParadaMs: 200 });
    await esperarEstado(s, "pronto");
    const inicio = Date.now();
    const p = s.pararServidor();
    void s.pararServidor(30_000);
    await p;
    expect(Date.now() - inicio).toBeLessThan(3_000);
  });

  it("com a trava em dia o servidor segue rodando", async () => {
    let tique: () => void = () => {};
    const relogio = { repetir: (fn: () => void) => ((tique = fn), () => {}) };
    const s = await subir("normal", { relogio });
    await esperarEstado(s, "pronto");
    tique();
    await new Promise((r) => setTimeout(r, 50));
    expect(s.estado).toBe("pronto");
  });
});

describe("antes de subir", () => {
  it("sem EULA aceito não sobe", async () => {
    await writeFile(join(pasta, "eula.txt"), "eula=false\n");
    await expect(iniciarServidor(opcoes())).rejects.toThrow(/EULA/);
    expect(chamadas).toHaveLength(0);
  });

  it("recusa versão do NeoForge com caminho dentro", async () => {
    await expect(iniciarServidor(opcoes("normal", { versaoNeoForge: "../x" }))).rejects.toThrow(
      /NeoForge/,
    );
    expect(chamadas).toHaveLength(0);
  });

  it("avisa se o NeoForge não foi instalado", async () => {
    await expect(iniciarServidor(opcoes("normal", { versaoNeoForge: "9.9.9" }))).rejects.toThrow(
      /instal/i,
    );
    expect(chamadas).toHaveLength(0);
  });

  it("recusa RAM manual maior que a do PC ou absurda", async () => {
    await expect(iniciarServidor(opcoes("normal", { ramMb: 32_000 }))).rejects.toThrow(/memória/i);
    await expect(iniciarServidor(opcoes("normal", { ramMb: 100 }))).rejects.toThrow(/memória/i);
    expect(chamadas).toHaveLength(0);
  });
});

describe("comando e memória", () => {
  it("usa arquivo de argumentos do NeoForge, sem -jar e sem shell", async () => {
    const s = await subir();
    await esperarEstado(s, "pronto");
    const c = chamadas[0] as (typeof chamadas)[number];
    expect(c.cmd).toBe(process.execPath);
    expect(c.args).toEqual([
      FALSO,
      "normal",
      "@user_jvm_args.txt",
      `@libraries/net/neoforged/neoforge/${NEO}/unix_args.txt`,
      "nogui",
    ]);
    expect(c.args).not.toContain("-jar");
    expect(c.opcoes.shell).toBe(false);
    expect(c.opcoes.cwd).toBe(pasta);
    expect(c.opcoes.stdio).toEqual(["pipe", "pipe", "pipe"]);
  });

  it("no Windows usa win_args.txt", async () => {
    const s = await subir("normal", { plataforma: "win32" });
    await esperarEstado(s, "pronto");
    expect(chamadas[0]?.args).toContain(`@libraries/net/neoforged/neoforge/${NEO}/win_args.txt`);
  });

  it("grava Xms = Xmx automático (metade da RAM) e as flags Aikar", async () => {
    const s = await subir();
    await esperarEstado(s, "pronto");
    const t = await readFile(join(pasta, "user_jvm_args.txt"), "utf8");
    expect(t).toContain("-Xms8192M\n");
    expect(t).toContain("-Xmx8192M\n");
    for (const f of [
      "-XX:+UseG1GC",
      "-XX:+ParallelRefProcEnabled",
      "-XX:MaxGCPauseMillis=200",
      "-XX:+UnlockExperimentalVMOptions",
      "-XX:+DisableExplicitGC",
      "-XX:+PerfDisableSharedMem",
      "-XX:G1NewSizePercent=30",
      "-XX:G1MaxNewSizePercent=40",
      "-XX:G1HeapRegionSize=8M",
      "-XX:G1ReservePercent=20",
      "-XX:G1HeapWastePercent=5",
      "-XX:G1MixedGCCountTarget=4",
      "-XX:InitiatingHeapOccupancyPercent=15",
      "-XX:G1MixedGCLiveThresholdPercent=90",
      "-XX:G1RSetUpdatingPauseTimePercent=5",
      "-XX:SurvivorRatio=32",
    ]) {
      expect(t.split("\n")).toContain(f);
    }
    expect(t.indexOf("UnlockExperimentalVMOptions")).toBeLessThan(t.indexOf("G1NewSizePercent"));
  });

  it("RAM manual sobrescreve o automático", async () => {
    const s = await subir("normal", { ramMb: 6144 });
    await esperarEstado(s, "pronto");
    const t = await readFile(join(pasta, "user_jvm_args.txt"), "utf8");
    expect(t).toContain("-Xms6144M\n");
    expect(t).toContain("-Xmx6144M\n");
  });

  it("abaixo de 4 GB avisa em pt-BR; com 4 GB ou mais, não", async () => {
    const pouco = await subir("normal", { memoriaTotalBytes: 6 * GB });
    expect(pouco.aviso).toMatch(/pouca memória para servidor com mods/);
    await pouco.pararServidor();
    const ok = await subir("normal", { memoriaTotalBytes: 8 * GB });
    expect(ok.aviso).toBeUndefined();
  });
});

describe("entrada e guarda", () => {
  it("recusa pasta relativa e javaPath relativo com separador", async () => {
    await expect(iniciarServidor(opcoes("normal", { pasta: "mundo/pasta" }))).rejects.toThrow(
      /caminho completo/,
    );
    await expect(iniciarServidor(opcoes("normal", { javaPath: "./java" }))).rejects.toThrow(
      /caminho completo/,
    );
    await expect(iniciarServidor(opcoes("normal", { javaPath: "bin/java" }))).rejects.toThrow(
      /caminho completo/,
    );
    expect(chamadas).toHaveLength(0);
  });

  it("aceita javaPath só com o nome (procurado no PATH)", async () => {
    const s = await subir("normal", { javaPath: "java-que-nao-existe-aqui", prefixoArgs: [] });
    await esperarEstado(s, "caiu");
  });

  it("segunda chamada na mesma pasta é recusada e libera quando o servidor para", async () => {
    const s = await subir();
    await expect(iniciarServidor(opcoes())).rejects.toThrow(/Já está rodando/);
    expect(chamadas).toHaveLength(1);
    await s.pararServidor();
    const outro = await subir();
    expect(outro.estado).not.toBe("caiu");
  });

  it("duas chamadas simultâneas na mesma pasta: só uma sobe", async () => {
    const r = await Promise.allSettled([subir(), subir()]);
    expect(r.filter((x) => x.status === "fulfilled")).toHaveLength(1);
    expect(chamadas).toHaveLength(1);
  });

  it("falha antes do spawn libera a pasta", async () => {
    await expect(
      iniciarServidor(opcoes("normal", { temTrava: async () => false })),
    ).rejects.toThrow();
    await subir();
  });

  it('"Done (" vindo do chat não deixa o servidor pronto', async () => {
    const s = await subir("semdone");
    const f = (s as unknown as { aoReceberLinha: (l: string) => void }).aoReceberLinha.bind(s);
    f("[12:00:00] [Server thread/INFO] [minecraft/MinecraftServer]: <Mallory> Done (1.0s)!");
    expect(s.estado).toBe("subindo");
    f(
      '[12:00:01] [Server thread/INFO] [minecraft/DedicatedServer]: Done (1.2s)! For help, type "help"',
    );
    expect(s.estado).toBe("pronto");
  });
});
