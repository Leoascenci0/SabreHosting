import { EventEmitter } from "node:events";
import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { gerarMundo } from "../../test/ajuda/mundos.js";
import type { ServidorMinecraft } from "../servidor/processo.js";
import { agendarBackups, fazerBackup } from "./agendador.js";
import * as pacote from "./pacote.js";

// O espião deixa o `criarPacote` real rodar, mas anota em `eventos` quando ele começa.
vi.mock("./pacote.js", async (original) => {
  const real = await original<typeof import("./pacote.js")>();
  return { ...real, criarPacote: vi.fn(real.criarPacote) };
});

const PRAZO = 30_000;
let eventos: string[];
let real: typeof pacote.criarPacote;
let pastas: string[];

function nova(): string {
  const p = mkdtempSync(join(tmpdir(), "sabre-agend-"));
  pastas.push(p);
  return p;
}

interface Falso extends EventEmitter {
  estado: string;
}

/** Servidor falso: confirma o `save-all flush` depois de `atrasoMs`, ou nunca (`null`). */
function servidorFalso(atrasoMs: number | null = 40): ServidorMinecraft & Falso {
  const s = Object.assign(new EventEmitter(), {
    estado: "pronto",
    enviar(linha: string) {
      eventos.push(`enviar:${linha}`);
      if (linha === "save-off") {
        setTimeout(
          () =>
            s.emit("log", {
              nivel: "info",
              texto: "[12:00:00] [Server thread/INFO]: Automatic saving is now disabled",
            }),
          0,
        );
      }
      if (linha === "save-all flush" && atrasoMs !== null) {
        setTimeout(() => {
          eventos.push("log:Saved the game");
          s.emit("log", {
            nivel: "info",
            texto: "[12:00:01] [Server thread/INFO]: Saved the game",
          });
        }, atrasoMs);
      }
    },
  });
  return s as unknown as ServidorMinecraft & Falso;
}

function relogioFalso() {
  let tique: (() => void) | undefined;
  const r = {
    ms: undefined as number | undefined,
    limpou: 0,
    setInterval(f: () => void, ms: number) {
      tique = f;
      r.ms = ms;
      return 1 as unknown as NodeJS.Timeout;
    },
    clearInterval() {
      r.limpou++;
      tique = undefined;
    },
    disparar() {
      tique?.();
    },
    get ativo() {
      return tique !== undefined;
    },
  };
  return r;
}

beforeEach(async () => {
  eventos = [];
  pastas = [];
  vi.mocked(pacote.criarPacote).mockClear();
  real = (await vi.importActual<typeof import("./pacote.js")>("./pacote.js")).criarPacote;
  vi.mocked(pacote.criarPacote).mockImplementation((...a) => {
    eventos.push("criarPacote");
    return real(...a);
  });
});

afterEach(() => {
  for (const p of pastas) rmSync(p, { recursive: true, force: true });
});

function base(servidor: ServidorMinecraft) {
  return {
    servidor,
    pastaDoMundo: gerarMundo({ tamanho: "1MB", pasta: nova() }),
    pastaBackups: join(nova(), "backups"),
    versao: 7,
    epoca: 2,
    agora: () => new Date("2026-10-30T14:05:09.123Z"),
  };
}

describe("fazerBackup", () => {
  it(
    "só lê o mundo depois do 'Saved the game' e religa o save no fim",
    async () => {
      const o = base(servidorFalso());
      const feito = await fazerBackup(o);
      expect(eventos).toEqual([
        "enviar:save-off",
        "enviar:save-all flush",
        "log:Saved the game",
        "criarPacote",
        "enviar:save-on",
      ]);
      expect(feito.caminho).toBe(join(o.pastaBackups, "2026-10-30T14-05-09-123Z-v7.tar.gz"));
      expect(feito.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(feito.tamanho).toBeGreaterThan(1024 * 1024 * 0.5);
      expect(feito.duracaoMs).toBeGreaterThanOrEqual(0);
      expect(readdirSync(o.pastaBackups)).toEqual(["2026-10-30T14-05-09-123Z-v7.tar.gz"]);
    },
    PRAZO,
  );

  it(
    "save-on volta mesmo se o pacote falhar, com erro em pt-BR e sem sobra",
    async () => {
      const o = base(servidorFalso(5));
      rmSync(o.pastaDoMundo, { recursive: true });
      await expect(fazerBackup(o)).rejects.toThrow(/mundo/i);
      expect(eventos.at(-1)).toBe("enviar:save-on");
      expect(existsSync(o.pastaBackups) ? readdirSync(o.pastaBackups) : []).toEqual([]);
    },
    PRAZO,
  );

  it(
    "servidor que não confirma o flush: nada é lido e o save-on volta",
    async () => {
      const o = { ...base(servidorFalso(null)), prazoSalvarMs: 60 };
      await expect(fazerBackup(o)).rejects.toThrow(/não confirmou/);
      expect(eventos).toEqual(["enviar:save-off", "enviar:save-all flush", "enviar:save-on"]);
    },
    PRAZO,
  );

  it(
    "servidor que cai durante a cópia: descarta o pacote e avisa em pt-BR",
    async () => {
      const s = servidorFalso(5);
      const o = base(s);
      vi.mocked(pacote.criarPacote).mockImplementationOnce(async (...a) => {
        const r = await real(...a);
        s.estado = "caiu";
        return r;
      });
      await expect(fazerBackup(o)).rejects.toThrow(/servidor caiu/i);
      expect(readdirSync(o.pastaBackups)).toEqual([]);
    },
    PRAZO,
  );

  it(
    "nunca escreve por cima de um backup que já existe",
    async () => {
      const o = base(servidorFalso(5));
      mkdirSync(o.pastaBackups, { recursive: true });
      const existente = join(o.pastaBackups, "2026-10-30T14-05-09-123Z-v7.tar.gz");
      writeFileSync(existente, "backup bom");
      await expect(fazerBackup(o)).rejects.toThrow(/já existe/i);
      expect(eventos).toEqual([]); // nem save-off: recusa antes de mexer no servidor
      expect(readdirSync(o.pastaBackups)).toEqual(["2026-10-30T14-05-09-123Z-v7.tar.gz"]);
    },
    PRAZO,
  );
});

describe("agendarBackups", () => {
  it("usa 10 min por padrão e aceita outro intervalo", () => {
    const a = relogioFalso();
    const b = relogioFalso();
    const s = servidorFalso();
    agendarBackups({ ...base(s), relogio: a }).parar();
    agendarBackups({ ...base(s), intervaloMin: 2.5, relogio: b }).parar();
    expect(a.ms).toBe(10 * 60_000);
    expect(b.ms).toBe(150_000);
  });

  it("recusa intervalo inválido", () => {
    for (const ruim of [0, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
      expect(() => agendarBackups({ ...base(servidorFalso()), intervaloMin: ruim })).toThrow(
        /intervalo/i,
      );
    }
  });

  it(
    "dois disparos seguidos fazem um backup só e avisam do que foi pulado",
    async () => {
      const r = relogioFalso();
      const avisos: string[] = [];
      const feitos: string[] = [];
      const ag = agendarBackups({
        ...base(servidorFalso(80)),
        relogio: r,
        aoAvisar: (t) => avisos.push(t),
        aoConcluir: (b) => feitos.push(b.caminho),
      });
      r.disparar();
      r.disparar();
      await ag.parar();
      expect(vi.mocked(pacote.criarPacote)).toHaveBeenCalledTimes(1);
      expect(eventos.filter((e) => e === "enviar:save-off")).toHaveLength(1);
      expect(avisos).toHaveLength(1);
      expect(avisos[0]).toMatch(/ainda em andamento/);
      expect(feitos).toHaveLength(1);
    },
    PRAZO,
  );

  it("só faz backup com o servidor pronto", async () => {
    const r = relogioFalso();
    const s = servidorFalso(5);
    s.estado = "subindo";
    const ag = agendarBackups({ ...base(s), relogio: r });
    r.disparar();
    await ag.parar();
    expect(eventos).toEqual([]);
  });

  it(
    "falha de um backup é informada e não derruba o agendador",
    async () => {
      const r = relogioFalso();
      const s = servidorFalso(5);
      const o = base(s);
      const erros: string[] = [];
      const feitos: string[] = [];
      vi.mocked(pacote.criarPacote).mockRejectedValueOnce(new Error("disco cheio"));
      const ag = agendarBackups({
        ...o,
        relogio: r,
        aoFalhar: (e) => erros.push(e.message),
        aoConcluir: (b) => feitos.push(b.caminho),
      });
      r.disparar();
      await vi.waitFor(() => expect(erros).toEqual(["disco cheio"]), { timeout: 5000 });
      expect(eventos.at(-1)).toBe("enviar:save-on");
      // Mesmo instante de relógio no 2º disparo: o nome repetiria; outro instante para este teste.
      let n = 0;
      ag.parar();
      const r2 = relogioFalso();
      const ag2 = agendarBackups({
        ...o,
        relogio: r2,
        agora: () => new Date(Date.UTC(2026, 9, 30, 15, 0, n++)),
        aoConcluir: (b) => feitos.push(b.caminho),
      });
      r2.disparar();
      await ag2.parar();
      expect(feitos).toHaveLength(1);
    },
    PRAZO,
  );

  it(
    "parar() limpa o timer, espera o backup em curso e não deixa novo começar",
    async () => {
      const r = relogioFalso();
      const feitos: string[] = [];
      const ag = agendarBackups({
        ...base(servidorFalso(80)),
        relogio: r,
        aoConcluir: (b) => feitos.push(b.caminho),
      });
      r.disparar();
      let terminou = false;
      const esperando = ag.parar().then(() => (terminou = true));
      expect(r.limpou).toBe(1);
      expect(r.ativo).toBe(false);
      await new Promise((res) => setTimeout(res, 10));
      expect(terminou).toBe(false); // o backup em curso ainda não acabou
      await esperando;
      expect(feitos).toHaveLength(1);
      expect(eventos.at(-1)).toBe("enviar:save-on");
      await ag.parar(); // idempotente
      expect(r.limpou).toBe(1);
    },
    PRAZO,
  );
});
