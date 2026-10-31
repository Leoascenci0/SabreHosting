// Ponta a ponta da trava (cart-2.1): cartório de verdade em 127.0.0.1 (porta 0, banco num diretório temporário) +
// cliente/renovador do núcleo + servidor de Minecraft falso. Nada de mundo real nem da máquina da nuvem.
import { spawn } from "node:child_process";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { salvarSeguro } from "../../packages/nucleo/src/servidor/comandos.js";
import { ARGS_VIGIA_TESTE } from "../../packages/nucleo/test/ajuda/vigia.js";
import { criarCliente } from "../../packages/nucleo/src/cartorio/cliente.js";
import { cofreEmMemoria } from "../../packages/nucleo/src/cartorio/cofre.js";
import { hospedar } from "../../packages/nucleo/src/cartorio/hospedar.js";
import type {
  EstadoServidor,
  ServidorMinecraft,
} from "../../packages/nucleo/src/servidor/processo.js";
import { abrirBanco, criarConvite } from "../../services/cartorio/src/banco.js";
import { criarCartorio } from "../../services/cartorio/src/servidor.js";

const RAIZ = join(dirname(fileURLToPath(import.meta.url)), "../..");
const FALSO = join(RAIZ, "packages/nucleo/test/ajuda/servidor-falso.mjs");
const NEO = "21.1.172";
// Tempos curtos de teste; a regra do cartório (prazo ≥ 3 × renovação) continua valendo.
const TEMPOS = { prazoMs: 300, renovarMs: 100 };
// Teste que exige a trava VIVA por vários prazos: o prazo local do renovador é 3 × renovação − 1,25 × renovação, então
// com 100 ms a folga é de 75 ms e uma máquina ocupada atrasa a renovação e a trava cai (comportamento certo do código).
const TEMPOS_FOLGADOS = { prazoMs: 1500, renovarMs: 500 };

let pasta: string;
let criados: ChildProcess[];
let servidores: ServidorMinecraft[];
let fechar: Array<() => Promise<unknown>>;

beforeEach(async () => {
  pasta = await mkdtemp(join(tmpdir(), "sabre-integ-"));
  const jogo = join(pasta, "jogo");
  const dir = join(jogo, "libraries/net/neoforged/neoforge", NEO);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, "unix_args.txt"), "# args\n");
  await writeFile(join(jogo, "eula.txt"), "eula=true\n");
  criados = [];
  servidores = [];
  fechar = [];
});

afterEach(async () => {
  for (const s of servidores) await s.pararServidor().catch(() => {});
  for (const f of fechar.splice(0).reverse()) await f().catch(() => {});
  for (const filho of criados) {
    if (filho.exitCode === null && filho.signalCode === null) filho.kill("SIGKILL");
  }
  await rm(pasta, { recursive: true, force: true });
});

async function subirCartorio(trava = TEMPOS, esperaHttpMs = 200) {
  const banco = abrirBanco(join(pasta, "cartorio.db"));
  const app = criarCartorio({
    banco,
    logger: { level: "silent" },
    trava,
  });
  await app.listen({ host: "127.0.0.1", port: 0 });
  fechar.push(() => app.close());
  const url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  /** Um PC do grupo: convite → token no cofre → cliente. */
  async function pc(nomePc: string) {
    // Convite sem sala de entrada (o PC de teste já está na rede): o caminho com ajudante está em convite.test.ts.
    const convite = criarConvite(banco, nomePc, Date.now(), 60_000);
    const usado = await app.inject({ method: "POST", url: "/convites/usar", payload: { convite } });
    const cofre = cofreEmMemoria();
    await cofre.guardar(usado.json<{ token: string }>().token);
    return criarCliente({ url, cofre, prazoMs: esperaHttpMs, esperaBaseMs: 10 });
  }
  return { app, pc };
}

function espiao(cmd: string, args: readonly string[], opcoes: SpawnOptions): ChildProcess {
  const filho = spawn(cmd, args, opcoes);
  criados.push(filho);
  return filho;
}

async function hospedarFalso(
  cliente: ReturnType<typeof criarCliente>,
  perdas: string[] = [],
  extra: Partial<Parameters<typeof hospedar>[0]> & { modo?: string } = {},
) {
  const { modo = "normal", ...resto } = extra;
  const h = await hospedar({
    cliente,
    pasta: join(pasta, "jogo"),
    javaPath: process.execPath,
    versaoNeoForge: NEO,
    prefixoArgs: [FALSO, modo],
    vigiaArgs: ARGS_VIGIA_TESTE,
    spawnFn: espiao,
    memoriaTotalBytes: 16 * 1024 ** 3,
    plataforma: "linux",
    prazoParadaMs: 5000,
    aoPerder: (motivo) => void perdas.push(motivo),
    ...resto,
  });
  servidores.push(h.servidor);
  fechar.push(() => h.renovador.soltar());
  return h;
}

function esperarEstado(s: ServidorMinecraft, alvo: EstadoServidor): Promise<void> {
  if (s.estado === alvo) return Promise.resolve();
  return new Promise((ok) => {
    s.on("estado", (e: { estado: EstadoServidor }) => {
      if (e.estado === alvo) ok();
    });
  });
}

const dormir = (ms: number) => new Promise((ok) => setTimeout(ok, ms));

describe("trava de host contra o cartório real", () => {
  it("renovando, a trava passa do prazo e outro PC continua recusado; parou, solta", async () => {
    const { pc } = await subirCartorio(TEMPOS_FOLGADOS, 2_000);
    const a = await pc("PC A");
    const b = await pc("PC B");
    const { servidor, renovador } = await hospedarFalso(a);
    await esperarEstado(servidor, "pronto");

    await dormir(2 * TEMPOS_FOLGADOS.prazoMs); // sem renovação a trava já teria vencido 2 vezes
    expect(await renovador.temTrava()).toBe(true);
    const recusa = await b.pegar();
    expect(recusa).toMatchObject({ ok: false, motivo: "ocupada" });

    await servidor.pararServidor();
    await dormir(50); // o `soltar` sai no evento de parada
    expect(await renovador.temTrava()).toBe(false);
    expect(await b.pegar()).toMatchObject({ ok: true });
  }, 30_000);

  it("renovação para → prazo local vence → save-all e parada do servidor", async () => {
    const { app, pc } = await subirCartorio();
    const perdas: string[] = [];
    const { servidor, renovador } = await hospedarFalso(await pc("PC A"), perdas);
    const logs: string[] = [];
    servidor.on("log", (l: { texto: string }) => logs.push(l.texto));
    await esperarEstado(servidor, "pronto");
    expect(await renovador.temTrava()).toBe(true);

    await app.close(); // o cartório some: a renovação para de ser aceita
    await esperarEstado(servidor, "parado");

    expect(await renovador.temTrava()).toBe(false);
    expect(perdas).toHaveLength(1);
    expect(perdas[0]).toMatch(/cartório não respondeu/);
    const ordem = [
      "RECEBIDO save-off",
      "RECEBIDO save-all flush",
      "Saved the game",
      "RECEBIDO save-on",
      "Stopping server",
    ].map((trecho) => logs.findIndex((l) => l.endsWith(trecho)));
    expect(ordem.every((i) => i >= 0)).toBe(true);
    expect(ordem).toEqual([...ordem].sort((x, y) => x - y));
  }, 10_000);

  it("perdeu a trava e o servidor não sai com `stop`: morto no prazo da perda, não no da parada normal", async () => {
    const { app, pc } = await subirCartorio();
    const { servidor } = await hospedarFalso(await pc("PC A"), [], {
      modo: "travado",
      prazoParadaMs: 30_000,
      prazoParadaSemTravaMs: 300,
    });
    await esperarEstado(servidor, "pronto");
    await app.close();
    const inicio = Date.now();
    await esperarEstado(servidor, "parado");
    expect(servidor.codigoSaida).toBeNull(); // morto: o `stop` foi ignorado
    expect(Date.now() - inicio).toBeLessThan(3_000);
  }, 10_000);

  it("backup pendurado na fila não atrasa a parada: perda → parado em ≤ prazoSalvar + prazoParadaSemTrava", async () => {
    // Trava folgada só para a subida sobreviver a uma máquina ocupada; o que se mede (perda → parado) parte do
    // `aoPerder` e depende só de prazoSalvarMs/prazoParadaSemTravaMs, então a prova continua a mesma.
    const { app, pc } = await subirCartorio(TEMPOS_FOLGADOS, 2_000);
    let perdeuEm = 0;
    const { servidor } = await hospedar({
      cliente: await pc("PC A"),
      pasta: join(pasta, "jogo"),
      javaPath: process.execPath,
      versaoNeoForge: NEO,
      prefixoArgs: [FALSO, "mudo"], // nunca confirma o `save-all flush`
      vigiaArgs: ARGS_VIGIA_TESTE,
      spawnFn: espiao,
      memoriaTotalBytes: 16 * 1024 ** 3,
      plataforma: "linux",
      prazoParadaMs: 30_000,
      prazoSalvarMs: 300,
      prazoParadaSemTravaMs: 300,
      aoPerder: () => void (perdeuEm = Date.now()),
    });
    servidores.push(servidor);
    await esperarEstado(servidor, "pronto");
    // Backup em curso segurando a fila de comandos por até 60 s.
    const backup = salvarSeguro(servidor, async () => {}, 60_000).catch(() => {});
    await app.close();
    await esperarEstado(servidor, "parado");
    expect(perdeuEm).toBeGreaterThan(0);
    expect(Date.now() - perdeuEm).toBeLessThan(300 + 300 + 700); // prazos + folga do teste
    await backup;
  }, 30_000);

  it("aviso da tela que lança erro não impede a parada na perda", async () => {
    const { app, pc } = await subirCartorio(TEMPOS_FOLGADOS, 2_000); // folga só na subida; a parada segue pelos prazos abaixo
    const { servidor } = await hospedarFalso(await pc("PC A"), [], {
      modo: "travado",
      prazoParadaMs: 30_000,
      prazoSalvarMs: 300,
      prazoParadaSemTravaMs: 300,
      aoPerder: () => {
        throw new Error("tela quebrou");
      },
    });
    const logs: string[] = [];
    servidor.on("log", (l: { texto: string }) => logs.push(l.texto));
    await esperarEstado(servidor, "pronto");
    await app.close();
    const inicio = Date.now();
    await esperarEstado(servidor, "parado");
    expect(Date.now() - inicio).toBeLessThan(3_000);
    expect(logs.some((l) => /tela quebrou/.test(l))).toBe(true);
  }, 30_000);
});
