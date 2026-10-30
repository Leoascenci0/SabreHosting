import { spawn as spawnPadrao } from "node:child_process";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import { stat } from "node:fs/promises";
import { totalmem } from "node:os";
import { join } from "node:path";
import { gravarAtomico, podeSubir } from "./configurar.js";

export type EstadoServidor = "parado" | "subindo" | "pronto" | "parando" | "caiu";

export interface OpcoesIniciar {
  pasta: string;
  javaPath: string;
  versaoNeoForge: string;
  /** Dono da trava do cartório agora? Obrigatório: sem trava o servidor não sobe nem continua. */
  temTrava: () => Promise<boolean>;
  /** Configurações › Servidor › Memória máxima (MB). Sem valor: automático. */
  ramMb?: number;
  /** Quanto esperar o `stop` antes de matar. Padrão: 60 s. */
  prazoParadaMs?: number;
  /** Repete `fn` a cada `ms` e devolve quem cancela. Padrão: `setInterval`. */
  relogio?: { repetir: (fn: () => void, ms: number) => () => void };
  // Só para os testes (servidor falso no lugar do java):
  spawnFn?: (cmd: string, args: readonly string[], opcoes: SpawnOptions) => ChildProcess;
  prefixoArgs?: string[];
  plataforma?: NodeJS.Platform;
  memoriaTotalBytes?: number;
}

const MB = 1024 * 1024;
const TETO_RAM_MB = 12 * 1024;
const MINIMO_RAM_MB = 512;
const AVISO_ABAIXO_MB = 4 * 1024;
const INTERVALO_TRAVA_MS = 20_000;
const PRAZO_PARADA_PADRAO_MS = 60_000;

// Flags do Aikar (G1GC). `UnlockExperimentalVMOptions` precisa vir antes das G1*Percent.
const FLAGS_AIKAR = [
  "-XX:+UseG1GC",
  "-XX:+UnlockExperimentalVMOptions",
  "-XX:+ParallelRefProcEnabled",
  "-XX:MaxGCPauseMillis=200",
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
];

/** Metade da RAM do PC, no máximo 12 GB, em MB inteiros para baixo. */
export function ramAutomaticaMb(totalBytes: number): number {
  return Math.min(Math.floor(totalBytes / 2 / MB), TETO_RAM_MB);
}

function textoJvm(ramMb: number): string {
  return [`-Xms${ramMb}M`, `-Xmx${ramMb}M`, ...FLAGS_AIKAR, ""].join("\n");
}

/** Eventos: `estado` ({estado, codigo?}) e `log` ({nivel: "info" | "aviso", texto}). */
export class ServidorMinecraft extends EventEmitter {
  estado: EstadoServidor = "subindo";
  /** `null` quando o processo foi morto por sinal; `undefined` enquanto roda. */
  codigoSaida?: number | null;
  aviso?: string;
  private paradaEmCurso?: Promise<void>;
  private readonly saiu: Promise<void>;
  private cancelarRelogio: () => void = () => {};
  private verificando = false;

  constructor(
    private readonly filho: ChildProcess,
    private readonly prazoParadaMs: number,
    temTrava: () => Promise<boolean>,
    relogio: NonNullable<OpcoesIniciar["relogio"]>,
  ) {
    super();
    this.saiu = new Promise((resolve) => {
      filho.once("close", (codigo) => {
        this.cancelarRelogio();
        this.codigoSaida = codigo;
        this.mudar(this.estado === "parando" ? "parado" : "caiu");
        if (this.estado === "caiu") {
          this.registrar("aviso", `O servidor encerrou sozinho (código ${codigo ?? "sinal"}).`);
        }
        resolve();
      });
    });
    filho.once("error", (erro) => {
      if (filho.pid !== undefined) return; // erro depois de subir: o `close` cuida.
      this.registrar("aviso", `Não consegui iniciar o Java: ${erro.message}`);
      this.cancelarRelogio();
      this.mudar("caiu");
    });
    filho.stdin?.on("error", () => {}); // EPIPE se o servidor já saiu.
    for (const fluxo of [filho.stdout, filho.stderr]) {
      let resto = "";
      fluxo?.setEncoding("utf8");
      fluxo?.on("data", (pedaco: string) => {
        const linhas = (resto + pedaco).split(/\r?\n/);
        resto = linhas.pop() ?? "";
        for (const linha of linhas) this.aoReceberLinha(linha);
      });
    }
    this.cancelarRelogio = relogio.repetir(
      () => void this.conferirTrava(temTrava),
      INTERVALO_TRAVA_MS,
    );
  }

  private mudar(estado: EstadoServidor): void {
    if (this.estado === estado) return;
    this.estado = estado;
    this.emit("estado", { estado, codigo: this.codigoSaida });
  }

  private registrar(nivel: "info" | "aviso", texto: string): void {
    this.emit("log", { nivel, texto });
  }

  private aoReceberLinha(linha: string): void {
    this.registrar("info", linha);
    if (this.estado === "subindo" && linha.includes("Done (")) this.mudar("pronto");
  }

  private async conferirTrava(temTrava: () => Promise<boolean>): Promise<void> {
    if (this.verificando || (this.estado !== "subindo" && this.estado !== "pronto")) return;
    this.verificando = true;
    let tem = false;
    try {
      tem = await temTrava();
    } catch {
      tem = false; // sem poder confirmar, vale como perdida: nunca seguir sem trava.
    } finally {
      this.verificando = false;
    }
    if (tem) return;
    this.registrar(
      "aviso",
      "Perdi a trava de host do cartório; parando o servidor para não duplicar o mundo.",
    );
    await this.pararServidor();
  }

  /** Escreve `stop`; se não sair até o prazo, mata e avisa no log. */
  pararServidor(): Promise<void> {
    if (this.estado === "parado" || this.estado === "caiu") return Promise.resolve();
    this.paradaEmCurso ??= (async () => {
      this.mudar("parando");
      this.filho.stdin?.write("stop\n");
      const prazo = setTimeout(() => {
        this.registrar(
          "aviso",
          `O servidor não encerrou em ${this.prazoParadaMs} ms; forçando o encerramento (o mundo pode perder os últimos instantes).`,
        );
        this.filho.kill("SIGKILL");
      }, this.prazoParadaMs);
      try {
        await this.saiu;
      } finally {
        clearTimeout(prazo);
      }
    })();
    return this.paradaEmCurso;
  }
}

function validarRam(ramMb: number | undefined, totalBytes: number): number {
  if (ramMb === undefined) return ramAutomaticaMb(totalBytes);
  if (!Number.isInteger(ramMb) || ramMb < MINIMO_RAM_MB || ramMb * MB > totalBytes) {
    throw new Error(
      `A memória do servidor precisa ser um número inteiro de MB entre ${MINIMO_RAM_MB} e a memória do PC (${Math.floor(totalBytes / MB)}).`,
    );
  }
  return ramMb;
}

/** Sobe o servidor NeoForge. Recusa (erro em pt-BR) sem EULA, sem NeoForge instalado ou sem a trava. */
export async function iniciarServidor(opcoes: OpcoesIniciar): Promise<ServidorMinecraft> {
  const { pasta, versaoNeoForge, temTrava } = opcoes;
  const plataforma = opcoes.plataforma ?? process.platform;
  if (!/^\d[\w.+-]*$/.test(versaoNeoForge) || versaoNeoForge.includes("..")) {
    throw new Error("Versão do NeoForge inválida.");
  }
  const totalBytes = opcoes.memoriaTotalBytes ?? totalmem();
  const ramMb = validarRam(opcoes.ramMb, totalBytes);

  const eula = await podeSubir(pasta);
  if (!eula.pode) throw new Error(eula.motivo);
  const argsNeoForge = `libraries/net/neoforged/neoforge/${versaoNeoForge}/${plataforma === "win32" ? "win" : "unix"}_args.txt`;
  try {
    await stat(join(pasta, argsNeoForge));
  } catch {
    throw new Error(`O NeoForge ${versaoNeoForge} ainda não foi instalado nesta pasta.`);
  }
  await gravarAtomico(join(pasta, "user_jvm_args.txt"), textoJvm(ramMb));

  // Reconferida logo antes do spawn: é a regra de ouro 1.
  let tem = false;
  try {
    tem = await temTrava();
  } catch {
    tem = false;
  }
  if (!tem)
    throw new Error("Este PC não tem a trava de host do cartório; o servidor não pode subir.");

  const filho = (opcoes.spawnFn ?? spawnPadrao)(
    opcoes.javaPath,
    [...(opcoes.prefixoArgs ?? []), "@user_jvm_args.txt", `@${argsNeoForge}`, "nogui"],
    { cwd: pasta, shell: false, stdio: ["pipe", "pipe", "pipe"] },
  );
  const relogio = opcoes.relogio ?? {
    repetir: (fn, ms) => {
      const id = setInterval(fn, ms);
      id.unref();
      return () => clearInterval(id);
    },
  };
  const servidor = new ServidorMinecraft(
    filho,
    opcoes.prazoParadaMs ?? PRAZO_PARADA_PADRAO_MS,
    temTrava,
    relogio,
  );
  if (ramMb < AVISO_ABAIXO_MB) {
    servidor.aviso =
      "Há pouca memória para servidor com mods; pode travar. Feche outros programas.";
  }
  return servidor;
}
