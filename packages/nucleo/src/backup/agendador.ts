/**
 * Backup do mundo com o servidor rodando, de tempos em tempos.
 *
 * Regra de ouro 2: o mundo só é lido dentro do `salvarSeguro` (`save-off` + `save-all flush`, e `save-on` sempre no
 * fim). Aqui não há outro fluxo de save: só o pacote (bkp-1.2) e o relógio. Rotação é bkp-2.1; envio ao cartório, outro item.
 */
import { existsSync } from "node:fs";
import { join } from "node:path";
import { salvarSeguro } from "../servidor/comandos.js";
import type { ServidorMinecraft } from "../servidor/processo.js";
import type { OrigemBackup } from "./manifesto.js";
import { PacoteDescartado, criarPacote, type PacoteCriado } from "./pacote.js";

export interface OpcoesBackup {
  servidor: ServidorMinecraft;
  pastaDoMundo: string;
  pastaBackups: string;
  versao: number;
  epoca: number;
  /** Quem pediu o backup (padrão `automatico`); vai no manifesto do pacote. */
  origem?: OrigemBackup;
  /** Relógio injetado (testes); o nome do arquivo sai dele. */
  agora?: () => Date;
  /** Prazo para o servidor confirmar o `save-all flush`. */
  prazoSalvarMs?: number;
  /** Prazo para a cópia do mundo; estourou, o pacote é abortado e descartado. */
  prazoCopiaMs?: number;
}

export interface BackupFeito extends PacoteCriado {
  duracaoMs: number;
}

/** `2026-10-30T14:05:09.123Z` vira `2026-10-30T14-05-09-123Z` (":" e "." não valem em nome de arquivo no Windows). */
export function nomeDoBackup(data: Date, versao: number): string {
  return `${data.toISOString().replace(/[:.]/g, "-")}-v${versao}.tar.gz`;
}

/** Um backup agora. Devolve o pacote já conferido e fechado em `<pastaBackups>/<data>-v<versao>.tar.gz`. */
export async function fazerBackup(opcoes: OpcoesBackup): Promise<BackupFeito> {
  const { servidor, pastaDoMundo, pastaBackups, versao, epoca, origem } = opcoes;
  const destino = join(pastaBackups, nomeDoBackup((opcoes.agora ?? (() => new Date()))(), versao));
  // Regra 4: o rename do pacote trocaria um backup bom que tenha o mesmo nome; recusa antes de mexer no servidor.
  if (existsSync(destino)) {
    throw new Error("Já existe um backup com esse nome; não escrevi por cima dele. Tente de novo.");
  }
  const inicio = Date.now();
  const pacote = await salvarSeguro(
    servidor,
    (sinal) =>
      criarPacote(pastaDoMundo, destino, {
        versao,
        epoca,
        ...(origem ? { origem } : {}),
        sinal,
        confirmar: () => servidor.estado === "pronto",
      }).catch((erro: unknown) => {
        if (!(erro instanceof PacoteDescartado) || sinal.aborted) throw erro;
        throw new Error("O servidor caiu durante o backup; descartei o pacote incompleto.", {
          cause: erro,
        });
      }),
    opcoes.prazoSalvarMs,
    opcoes.prazoCopiaMs,
  );
  return { ...pacote, duracaoMs: Date.now() - inicio };
}

export interface Relogio {
  setInterval(tarefa: () => void, ms: number): NodeJS.Timeout;
  clearInterval(timer: NodeJS.Timeout): void;
}

export interface OpcoesAgenda extends OpcoesBackup {
  /** Configurações › Backups › Intervalo (padrão 10 min). */
  intervaloMin?: number;
  relogio?: Relogio;
  aoConcluir?: (backup: BackupFeito) => void;
  aoFalhar?: (erro: Error) => void;
  aoAvisar?: (texto: string) => void;
}

export interface Agenda {
  /** Cancela o relógio e espera o backup em curso terminar; depois disso nenhum backup começa. */
  parar(): Promise<void>;
  /**
   * Backup manual agora (botão "Fazer backup agora"): o MESMO `fazerBackup` do relógio, com origem `manual`, e a mesma
   * vez (um backup por vez). Recusa, em pt-BR, se a agenda parou, o servidor não está pronto ou há backup em curso.
   */
  fazerAgora(): Promise<BackupFeito>;
}

/** Um backup por vez, só com o servidor "pronto". Falha de um backup é informada e o próximo tenta de novo. */
export function agendarBackups(opcoes: OpcoesAgenda): Agenda {
  const { intervaloMin = 10, relogio = globalThis, aoConcluir, aoFalhar, aoAvisar } = opcoes;
  if (!Number.isFinite(intervaloMin) || intervaloMin <= 0) {
    throw new Error("O intervalo do backup precisa ser um número de minutos maior que zero.");
  }
  let emCurso: Promise<void> | undefined;
  let parado = false;

  const tique = (): void => {
    if (parado || opcoes.servidor.estado !== "pronto") return;
    if (emCurso !== undefined) {
      aoAvisar?.(
        "O backup anterior ainda em andamento; pulei este para não rodar dois ao mesmo tempo.",
      );
      return;
    }
    emCurso = fazerBackup(opcoes)
      .then((feito) => aoConcluir?.(feito))
      .catch((erro: unknown) => aoFalhar?.(erro instanceof Error ? erro : new Error(String(erro))))
      .finally(() => {
        emCurso = undefined;
      });
  };

  const timer = relogio.setInterval(tique, intervaloMin * 60_000);
  // Não segura o processo vivo só por causa do backup agendado.
  timer.unref?.();

  return {
    fazerAgora() {
      if (parado) return Promise.reject(new Error("O backup parou junto com o servidor."));
      if (opcoes.servidor.estado !== "pronto") {
        return Promise.reject(new Error("O servidor ainda não está pronto para um backup."));
      }
      if (emCurso !== undefined) return Promise.reject(new Error("Já tem um backup em andamento."));
      const resultado = fazerBackup({ ...opcoes, origem: "manual" }).then((feito) => {
        aoConcluir?.(feito); // rotação e cópia do histórico, como em qualquer backup bom
        return feito;
      });
      emCurso = resultado
        .then(
          () => undefined,
          () => undefined,
        )
        .finally(() => {
          emCurso = undefined;
        });
      return resultado;
    },
    async parar() {
      if (!parado) {
        parado = true;
        relogio.clearInterval(timer);
      }
      await emCurso;
    },
  };
}
