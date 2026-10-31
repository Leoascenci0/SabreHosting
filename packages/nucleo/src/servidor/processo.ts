import { spawn as spawnPadrao } from "node:child_process";
import type { ChildProcess, SpawnOptions } from "node:child_process";
import { EventEmitter } from "node:events";
import { stat } from "node:fs/promises";
import { totalmem } from "node:os";
import { isAbsolute, join, resolve as resolverCaminho } from "node:path";
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
  /** Quanto esperar a resposta de `temTrava`; sem resposta vale como "sem trava". Padrão: 10 s. */
  prazoTravaMs?: number;
  /** Quanto esperar o `stop` antes de matar. Padrão: 60 s. */
  prazoParadaMs?: number;
  /**
   * Idem quando a trava se perdeu. Padrão: 10 s, para caber na margem do renovador (cartorio/renovador.ts) antes de o
   * cartório liberar a trava para outro PC.
   */
  prazoParadaSemTravaMs?: number;
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
const PRAZO_PARADA_SEM_TRAVA_MS = 10_000;
const PRAZO_TRAVA_PADRAO_MS = 10_000;
/** Pastas com servidor deste PC em andamento (regra de ouro 1: um servidor por mundo). */
const pastasEmUso = new Set<string>();
/** "Pronto" só pela linha do próprio servidor (`...]: Done (`); chat vem como `<Nome> Done (`. */
const LINHA_PRONTO = /(?:^|\]: )Done \(/;

/** Erro, demora e `false` valem como sem trava; só `true` dentro do prazo confirma. */
export async function travaConfirmada(
  temTrava: () => Promise<boolean>,
  prazoMs: number,
): Promise<"sim" | "nao" | "semResposta"> {
  let timer: NodeJS.Timeout | undefined;
  const semResposta = new Promise<"semResposta">((resolve) => {
    timer = setTimeout(() => resolve("semResposta"), prazoMs);
  });
  try {
    const r = await Promise.race([temTrava(), semResposta]);
    return r === true ? "sim" : r === "semResposta" ? r : "nao";
  } catch {
    return "nao";
  } finally {
    clearTimeout(timer);
  }
}

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
  /** Quando (relógio monotônico) o processo será morto se não sair; um prazo menor sempre encurta. */
  private morte?: { quando: number; timer: NodeJS.Timeout };
  private readonly saiu: Promise<void>;
  private cancelarRelogio: () => void = () => {};
  private verificando = false;
  private falhouAoIniciar = false;

  constructor(
    private readonly filho: ChildProcess,
    private readonly prazoParadaMs: number,
    private readonly prazoParadaSemTravaMs: number,
    confirmarTrava: () => Promise<"sim" | "nao" | "semResposta">,
    relogio: NonNullable<OpcoesIniciar["relogio"]>,
  ) {
    super();
    this.saiu = new Promise((resolve) => {
      filho.once("close", (codigo) => {
        this.cancelarRelogio();
        this.codigoSaida = codigo;
        this.mudar(this.estado === "parando" ? "parado" : "caiu");
        if (this.estado === "caiu" && !this.falhouAoIniciar) {
          this.registrar("aviso", `O servidor encerrou sozinho (código ${codigo ?? "sinal"}).`);
        }
        resolve();
      });
    });
    filho.once("error", (erro) => {
      if (filho.pid !== undefined) return; // erro depois de subir: o `close` cuida.
      this.falhouAoIniciar = true;
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
      () => void this.conferirTrava(confirmarTrava),
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
    if (this.estado === "subindo" && LINHA_PRONTO.test(linha)) this.mudar("pronto");
  }

  private async conferirTrava(
    confirmarTrava: () => Promise<"sim" | "nao" | "semResposta">,
  ): Promise<void> {
    const ativo = () => this.estado === "subindo" || this.estado === "pronto";
    if (this.verificando || (!ativo() && this.estado !== "parando")) return;
    this.verificando = true;
    let resposta: "sim" | "nao" | "semResposta";
    try {
      resposta = await confirmarTrava();
    } finally {
      this.verificando = false;
    }
    if (resposta === "sim") return;
    // Parada normal em curso: só encurta o prazo, sem aviso. Parado ou caído: nada a fazer.
    if (this.estado === "parando") return void (await this.pararSemTrava());
    if (!ativo()) return;
    this.registrar(
      "aviso",
      resposta === "semResposta"
        ? "O cartório não respondeu a tempo; parando o servidor para não ficar sem a trava de host."
        : "Perdi a trava de host do cartório; parando o servidor para não duplicar o mundo.",
    );
    await this.pararSemTrava();
  }

  /** Parada de quem perdeu a trava (laço de 20 s daqui e renovador do cartório): prazo curto antes de matar. */
  pararSemTrava(): Promise<void> {
    return this.pararServidor(this.prazoParadaSemTravaMs);
  }

  /**
   * Única porta de escrita no console do servidor. Recusa quebra de linha e caractere de controle (nenhum
   * comando "pega carona" noutro) e só escreve com o servidor pronto.
   */
  enviar(linha: string): void {
    if (/[\p{Cc}\p{Zl}\p{Zp}]/u.test(linha)) {
      throw new Error(
        "O comando tem quebra de linha ou caractere de controle; não enviei nada ao servidor.",
      );
    }
    if (this.estado !== "pronto")
      throw new Error("O servidor ainda não está pronto para comandos.");
    this.filho.stdin?.write(`${linha}\n`);
  }

  /**
   * Escreve `stop`; se não sair até o prazo (padrão: `prazoParadaMs`), mata e avisa no log. Chamada com parada já
   * em curso só pode ENCURTAR o prazo (perda da trava no meio de uma parada normal).
   */
  pararServidor(prazoMs = this.prazoParadaMs): Promise<void> {
    if (this.estado === "parado" || this.estado === "caiu") return Promise.resolve();
    this.armarMorte(prazoMs);
    this.paradaEmCurso ??= (async () => {
      this.mudar("parando");
      this.filho.stdin?.write("stop\n");
      try {
        await this.saiu;
      } finally {
        clearTimeout(this.morte?.timer);
      }
    })();
    return this.paradaEmCurso;
  }

  private armarMorte(prazoMs: number): void {
    const quando = performance.now() + prazoMs;
    if (this.morte && this.morte.quando <= quando) return;
    clearTimeout(this.morte?.timer);
    const timer = setTimeout(() => {
      this.registrar(
        "aviso",
        `O servidor não encerrou em ${prazoMs} ms; forçando o encerramento (o mundo pode perder os últimos instantes).`,
      );
      this.filho.kill("SIGKILL");
    }, prazoMs);
    this.morte = { quando, timer };
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
  const { pasta, versaoNeoForge } = opcoes;
  const plataforma = opcoes.plataforma ?? process.platform;
  if (!isAbsolute(pasta)) {
    throw new Error("A pasta do servidor precisa ser um caminho completo (começando na raiz).");
  }
  if (!isAbsolute(opcoes.javaPath) && /[\\/]/.test(opcoes.javaPath)) {
    throw new Error(
      "O Java precisa ser o nome do programa (ex.: java) ou um caminho completo, não um caminho relativo.",
    );
  }
  if (!/^\d[\w.+-]*$/.test(versaoNeoForge) || versaoNeoForge.includes("..")) {
    throw new Error("Versão do NeoForge inválida.");
  }
  const totalBytes = opcoes.memoriaTotalBytes ?? totalmem();
  const ramMb = validarRam(opcoes.ramMb, totalBytes);

  // Marcada antes de qualquer `await`, para duas chamadas ao mesmo tempo não passarem juntas.
  const chave =
    plataforma === "win32" ? resolverCaminho(pasta).toLowerCase() : resolverCaminho(pasta);
  if (pastasEmUso.has(chave)) {
    throw new Error(
      "Já está rodando um servidor nesta pasta; não dá para subir outro no mesmo mundo.",
    );
  }
  pastasEmUso.add(chave);
  try {
    const servidor = await subirServidor(opcoes, ramMb, plataforma);
    const liberar = () => {
      if (servidor.estado === "parado" || servidor.estado === "caiu") {
        pastasEmUso.delete(chave);
        servidor.off("estado", liberar);
      }
    };
    servidor.on("estado", liberar);
    liberar();
    return servidor;
  } catch (erro) {
    pastasEmUso.delete(chave);
    throw erro;
  }
}

async function subirServidor(
  opcoes: OpcoesIniciar,
  ramMb: number,
  plataforma: NodeJS.Platform,
): Promise<ServidorMinecraft> {
  const { pasta, versaoNeoForge, temTrava } = opcoes;

  const eula = await podeSubir(pasta);
  if (!eula.pode) throw new Error(eula.motivo);
  const argsNeoForge = `libraries/net/neoforged/neoforge/${versaoNeoForge}/${plataforma === "win32" ? "win" : "unix"}_args.txt`;
  try {
    await stat(join(pasta, argsNeoForge));
  } catch {
    throw new Error(`O NeoForge ${versaoNeoForge} ainda não foi instalado nesta pasta.`);
  }

  // Reconferida logo antes do spawn: é a regra de ouro 1.
  const confirmar = () => travaConfirmada(temTrava, opcoes.prazoTravaMs ?? PRAZO_TRAVA_PADRAO_MS);
  const trava = await confirmar();
  if (trava === "semResposta") {
    throw new Error("O cartório não respondeu; não dá para hospedar sem a trava.");
  }
  if (trava === "nao") {
    throw new Error("Este PC não tem a trava de host do cartório; o servidor não pode subir.");
  }
  await gravarAtomico(join(pasta, "user_jvm_args.txt"), textoJvm(ramMb));

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
    opcoes.prazoParadaSemTravaMs ?? PRAZO_PARADA_SEM_TRAVA_MS,
    confirmar,
    relogio,
  );
  if (ramMb < AVISO_ABAIXO_MB) {
    servidor.aviso =
      "Há pouca memória para servidor com mods; pode travar. Feche outros programas.";
  }
  return servidor;
}
