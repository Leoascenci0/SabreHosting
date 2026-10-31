import {
  agendarBackups,
  type Agenda,
  type Relogio,
  type OpcoesAgenda,
} from "@sabrehosting/nucleo/backup/agendador";
import type { AvisoHistorico } from "./aviso-historico.js";
import { listarBackups } from "@sabrehosting/nucleo/backup/listar";
import { copiarParaPasta } from "@sabrehosting/nucleo/backup/destinos/pasta";

/** Só o que a agenda precisa do servidor; `ServidorMinecraft` do núcleo cumpre. */
export interface ServidorObservado {
  estado?: string;
  on(evento: "estado", ouvinte: (e: { estado: string }) => void): unknown;
}

export interface DepsAgenda<S extends ServidorObservado> {
  /** Configurações › Backups › Intervalo, em minutos (lido na hora de ligar). */
  intervaloMin(): number;
  /** Liga o agendador do núcleo (único caminho de backup: `save-off` + flush). `undefined`: não dá para agendar. */
  iniciar(servidor: S, intervaloMin: number): Promise<Agenda | undefined>;
  aoAvisar?(texto: string): void;
}

/**
 * Backup agendado só enquanto este PC hospeda com o servidor "pronto": liga quando fica pronto, para ao
 * parar/cair e recomeça ao mudar o intervalo. Nenhum backup nasce aqui; só o relógio do núcleo.
 */
export function criarAgendaBackups<S extends ServidorObservado>(deps: DepsAgenda<S>) {
  let servidor: S | undefined;
  let agenda: Agenda | undefined;
  let geracao = 0;

  // A geração é tomada ANTES de qualquer await: duas chamadas seguidas nunca compartilham o mesmo número.
  async function desligar(): Promise<void> {
    geracao++;
    const antiga = agenda;
    agenda = undefined;
    await antiga?.parar();
  }

  async function ligar(): Promise<void> {
    const meu = ++geracao;
    const antiga = agenda;
    agenda = undefined;
    await antiga?.parar(); // com backup em curso, espera ele terminar
    if (meu !== geracao) return; // outra chamada (reagendar, parar) chegou depois e manda
    const alvo = servidor;
    if (!alvo || alvo.estado !== "pronto") return;
    try {
      const nova = await deps.iniciar(alvo, deps.intervaloMin());
      if (meu !== geracao)
        await nova?.parar(); // parou ou reagendou enquanto preparava
      else agenda = nova;
    } catch (e) {
      deps.aoAvisar?.(
        `Não consegui ligar o backup agendado: ${e instanceof Error ? e.message : e}`,
      );
    }
  }

  return {
    observar(novo: S): void {
      servidor = novo;
      novo.on("estado", ({ estado }) => {
        if (servidor !== novo) return;
        if (estado === "pronto") void ligar();
        else {
          if (estado === "parado" || estado === "caiu") servidor = undefined;
          void desligar();
        }
      });
      if (novo.estado === "pronto") void ligar();
    },
    /** O intervalo mudou: recomeça o relógio com o novo valor (sem efeito se não há servidor pronto). */
    reagendar(): void {
      if (servidor?.estado === "pronto") void ligar();
    },
    /** Espera o backup em curso terminar. */
    parar: desligar,
    ativa: (): boolean => agenda !== undefined,
  };
}

export type AgendaBackups = ReturnType<typeof criarAgendaBackups>;

export interface OpcoesAgendaReal {
  /** Configurações › Backups › Pasta (até app-1.3: `SABRE_PASTA_BACKUPS`). */
  pastaBackups: string | undefined;
  /** Pasta do mundo (até app-1.3: `SABRE_PASTA_MUNDO`). */
  pastaDoMundo: string | undefined;
  /** Época atual da trava do cartório (vai no pacote). */
  epoca(): Promise<number>;
  relogio?: Relogio;
  /** Configurações › Backups › Histórico longo numa pasta (lido a cada backup; `undefined`: desligado). */
  historicoLongo?(): string | undefined;
  /** Onde a tela de Backups lê o último problema da cópia (limpo quando a cópia dá certo ou o recurso é desligado). */
  avisoHistorico?: AvisoHistorico;
  /** Depois de cada backup bom: marca "bom" e roda a rotação (Configurações › Backups › Quantos guardar). */
  aoBackupBom?(feito: { caminho: string; sha256: string }): Promise<void>;
  /** Depois de a cópia ser conferida por hash na pasta do histórico: marca "bom" e roda a rotação dela. */
  aoCopiar?(copia: { caminho: string; sha256: string }): Promise<void>;
  aoAvisar?(texto: string): void;
}

/**
 * Depois de um backup bom, copia para o histórico longo (se ligado). Falha da cópia só vira aviso: o backup local já
 * está guardado e continua valendo. Nunca apaga nada.
 */
export async function copiarAoConcluir(
  o: Pick<
    OpcoesAgendaReal,
    "pastaBackups" | "pastaDoMundo" | "historicoLongo" | "avisoHistorico" | "aoCopiar" | "aoAvisar"
  >,
  feito: { caminho: string; sha256: string },
): Promise<void> {
  const pasta = o.historicoLongo?.();
  if (pasta === undefined || !o.pastaBackups) {
    o.avisoHistorico?.definir(undefined);
    return;
  }
  let copiado: string;
  try {
    copiado = await copiarParaPasta(feito.caminho, feito.sha256, pasta, [
      o.pastaBackups,
      o.pastaDoMundo ?? "",
    ]);
    o.avisoHistorico?.definir(undefined);
  } catch (e) {
    const texto = e instanceof Error ? e.message : String(e);
    o.avisoHistorico?.definir(texto);
    o.aoAvisar?.(texto);
    return;
  }
  // Só aqui o hash da cópia foi conferido: pode marcar "bom" e rotacionar. Erro da rotação nunca afeta o backup.
  try {
    await o.aoCopiar?.({ caminho: copiado, sha256: feito.sha256 });
  } catch (e) {
    o.aoAvisar?.(`Rotação do histórico: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/** Liga `agendarBackups` do núcleo; sem as pastas configuradas, avisa e não agenda (nunca chuta um caminho). */
export function iniciarAgendaReal(o: OpcoesAgendaReal) {
  return async (servidor: ServidorObservado, intervaloMin: number): Promise<Agenda | undefined> => {
    const { pastaBackups, pastaDoMundo } = o;
    if (!pastaBackups || !pastaDoMundo) {
      o.aoAvisar?.(
        "Este PC ainda não tem as pastas do mundo e dos backups; o backup agendado não ligou.",
      );
      return undefined;
    }
    const lista = await listarBackups(pastaBackups);
    return agendarBackups({
      servidor: servidor as OpcoesAgenda["servidor"], // vem de `hospedar` do núcleo: é um ServidorMinecraft
      pastaDoMundo,
      pastaBackups,
      versao: Math.max(0, ...lista.map((b) => b.versao)),
      epoca: await o.epoca(),
      intervaloMin,
      ...(o.relogio ? { relogio: o.relogio } : {}),
      aoConcluir: (feito) => {
        void copiarAoConcluir(o, feito);
        void o.aoBackupBom?.(feito);
      },
      aoFalhar: (e) => o.aoAvisar?.(`Backup agendado falhou: ${e.message}`),
      ...(o.aoAvisar ? { aoAvisar: o.aoAvisar } : {}),
    });
  };
}
