import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { isAbsolute, join } from "node:path";
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
  /** Configurações › Backups › Histórico longo numa pasta (liga). */
  historicoLongoLigado: boolean;
  /** Configurações › Backups › Histórico longo numa pasta (pasta). Vem do arquivo: entrada não confiável. */
  historicoLongoPasta: string;
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

const PADRAO: Preferencias = {
  abrirComWindows: false,
  distanciaVisao: DISTANCIA_VISAO_PADRAO,
  distanciaSimulacao: DISTANCIA_SIMULACAO_PADRAO,
  intervaloBackupMin: INTERVALO_BACKUP_PADRAO,
  historicoLongoLigado: false,
  historicoLongoPasta: "",
};
const ARQUIVO = "preferencias.json";

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
    historicoLongoLigado:
      typeof bruto.historicoLongoLigado === "boolean" ? bruto.historicoLongoLigado : false,
    historicoLongoPasta:
      typeof bruto.historicoLongoPasta === "string" ? bruto.historicoLongoPasta : "",
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
