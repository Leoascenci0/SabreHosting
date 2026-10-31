import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
import { RECENTES_PADRAO } from "@sabrehosting/nucleo/backup/rotacao";
import {
  DISTANCIA_SIMULACAO_PADRAO,
  DISTANCIA_VISAO_PADRAO,
  validarDistancias,
  type OpcoesServidor,
} from "@sabrehosting/nucleo/servidor/configurar";

export interface Preferencias {
  /** Configurações › Geral › Abrir com o Windows. */
  abrirComWindows: boolean;
  /** Configurações › Servidor › Distância de visão. */
  distanciaVisao: number;
  /** Configurações › Servidor › Distância de simulação. */
  distanciaSimulacao: number;
  /** Configurações › Backups › Intervalo (minutos entre um backup e o próximo). */
  intervaloBackupMin: number;
  /** Configurações › Backups › Quantos guardar (os dos últimos 7 dias sempre ficam além destes). */
  quantosGuardar: number;
  /** Configurações › Backups › Histórico longo numa pasta › Quantos guardar nesta pasta (+ os dos últimos 7 dias). */
  quantosGuardarHistorico: number;
  /** Configurações › Backups › Histórico longo numa pasta (liga). */
  historicoLongoLigado: boolean;
  /** Configurações › Backups › Histórico longo numa pasta (pasta). Vem do arquivo: entrada não confiável. */
  historicoLongoPasta: string;
  /** Configurações › Backups › Limite de banda para atualizar o mundo (MB/s). */
  limiteBandaMBs: number;
}

/** Ligado exige pasta completa (absoluta); desligado aceita qualquer texto. Lança erro em pt-BR. */
export function validarHistoricoLongo(ligado: boolean, pasta: string): void {
  if (ligado && (pasta.trim() === "" || !isAbsolute(pasta))) {
    throw new Error(
      "Para ligar o histórico longo, escolha a pasta completa (ex.: a pasta do Drive no seu PC).",
    );
  }
}

export const INTERVALO_BACKUP_PADRAO = 10;
export const INTERVALO_BACKUP_MIN = 1;
export const INTERVALO_BACKUP_MAX = 1440;

/** Só inteiro de 1 a 1440 minutos (1 dia); lança erro em pt-BR. */
export function validarIntervaloBackup(min: number): void {
  if (!Number.isInteger(min) || min < INTERVALO_BACKUP_MIN || min > INTERVALO_BACKUP_MAX) {
    throw new Error(
      `O intervalo do backup precisa ser um número inteiro de minutos, de ${INTERVALO_BACKUP_MIN} a ${INTERVALO_BACKUP_MAX}.`,
    );
  }
}

export const QUANTOS_GUARDAR_PADRAO = RECENTES_PADRAO;
export const QUANTOS_GUARDAR_MAX = 1000;

/** Só inteiro de 1 a 1000 (0 apagaria tudo); lança erro em pt-BR. */
export function validarQuantosGuardar(n: number): void {
  if (!Number.isInteger(n) || n < 1 || n > QUANTOS_GUARDAR_MAX) {
    throw new Error(
      `"Quantos guardar" precisa ser um número inteiro de 1 a ${QUANTOS_GUARDAR_MAX}.`,
    );
  }
}

export const LIMITE_BANDA_PADRAO = 10;
export const LIMITE_BANDA_MAX = 1000;

/** Só inteiro de 1 a 1000 MB/s (0 travaria a atualização); lança erro em pt-BR. */
export function validarLimiteBanda(mbs: number): void {
  if (!Number.isInteger(mbs) || mbs < 1 || mbs > LIMITE_BANDA_MAX) {
    throw new Error(
      `O "Limite de banda" precisa ser um número inteiro de MB/s, de 1 a ${LIMITE_BANDA_MAX}.`,
    );
  }
}

/** MB/s da tela em bytes/s para o núcleo (1 MB = 1.000.000 bytes). */
export const bytesPorSegundo = (mbs: number): number => mbs * 1_000_000;

const PADRAO: Preferencias = {
  abrirComWindows: false,
  distanciaVisao: DISTANCIA_VISAO_PADRAO,
  distanciaSimulacao: DISTANCIA_SIMULACAO_PADRAO,
  intervaloBackupMin: INTERVALO_BACKUP_PADRAO,
  quantosGuardar: QUANTOS_GUARDAR_PADRAO,
  quantosGuardarHistorico: QUANTOS_GUARDAR_PADRAO,
  historicoLongoLigado: false,
  historicoLongoPasta: "",
  limiteBandaMBs: LIMITE_BANDA_PADRAO,
};
const ARQUIVO = "preferencias.json";

/** Só número de verdade (true, "5" e [3] não viram número); ausente usa o padrão. */
const numeroOuPadrao = (v: unknown, padrao: number): number =>
  v === undefined ? padrao : typeof v === "number" ? v : Number.NaN;

/** Lê campo a campo: o que estiver torto volta ao padrão sem derrubar os outros campos. */
export function lerPreferencias(pasta: string): Preferencias {
  let bruto: Partial<Record<keyof Preferencias, unknown>> = {};
  try {
    const lido: unknown = JSON.parse(readFileSync(join(pasta, ARQUIVO), "utf8"));
    if (typeof lido === "object" && lido !== null) bruto = lido;
  } catch {
    return { ...PADRAO };
  }
  const resultado: Preferencias = {
    abrirComWindows:
      typeof bruto.abrirComWindows === "boolean" ? bruto.abrirComWindows : PADRAO.abrirComWindows,
    distanciaVisao: Number(bruto.distanciaVisao),
    distanciaSimulacao: Number(bruto.distanciaSimulacao),
    intervaloBackupMin: Number(bruto.intervaloBackupMin ?? PADRAO.intervaloBackupMin),
    quantosGuardar: numeroOuPadrao(bruto.quantosGuardar, PADRAO.quantosGuardar),
    quantosGuardarHistorico: numeroOuPadrao(
      bruto.quantosGuardarHistorico,
      PADRAO.quantosGuardarHistorico,
    ),
    historicoLongoLigado:
      typeof bruto.historicoLongoLigado === "boolean" ? bruto.historicoLongoLigado : false,
    historicoLongoPasta:
      typeof bruto.historicoLongoPasta === "string" ? bruto.historicoLongoPasta : "",
    limiteBandaMBs: numeroOuPadrao(bruto.limiteBandaMBs, PADRAO.limiteBandaMBs),
  };
  try {
    validarHistoricoLongo(resultado.historicoLongoLigado, resultado.historicoLongoPasta);
  } catch {
    resultado.historicoLongoLigado = false; // pasta torta no arquivo: desliga em vez de copiar para lugar duvidoso
  }
  try {
    validarIntervaloBackup(resultado.intervaloBackupMin);
  } catch {
    resultado.intervaloBackupMin = PADRAO.intervaloBackupMin;
  }
  try {
    validarQuantosGuardar(resultado.quantosGuardar);
  } catch {
    resultado.quantosGuardar = PADRAO.quantosGuardar; // arquivo torto nunca vira "guardar 0"
  }
  try {
    validarQuantosGuardar(resultado.quantosGuardarHistorico);
  } catch {
    resultado.quantosGuardarHistorico = PADRAO.quantosGuardarHistorico;
  }
  try {
    validarLimiteBanda(resultado.limiteBandaMBs);
  } catch {
    resultado.limiteBandaMBs = PADRAO.limiteBandaMBs; // arquivo torto nunca vira "0 MB/s" nem "sem limite"
  }
  try {
    // As duas distâncias andam juntas (simulação < visão): par inválido volta ao par padrão.
    validarDistancias(resultado.distanciaVisao, resultado.distanciaSimulacao);
  } catch {
    resultado.distanciaVisao = PADRAO.distanciaVisao;
    resultado.distanciaSimulacao = PADRAO.distanciaSimulacao;
  }
  return resultado;
}

// Troca atômica (regra de ouro 3): escreve num temporário e só então renomeia.
export function salvarPreferencias(pasta: string, preferencias: Preferencias): void {
  mkdirSync(pasta, { recursive: true });
  const temporario = join(pasta, `${ARQUIVO}.tmp`);
  writeFileSync(temporario, JSON.stringify(preferencias, null, 2));
  renameSync(temporario, join(pasta, ARQUIVO));
}

/** O que o servidor lê das preferências (entra em `gerarPropriedades` junto com o IP e a porta). */
export function opcoesDoServidor(
  p: Preferencias,
): Pick<OpcoesServidor, "distanciaVisao" | "distanciaSimulacao"> {
  return { distanciaVisao: p.distanciaVisao, distanciaSimulacao: p.distanciaSimulacao };
}
