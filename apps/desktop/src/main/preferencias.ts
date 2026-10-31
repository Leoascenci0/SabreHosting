import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
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
}

const PADRAO: Preferencias = {
  abrirComWindows: false,
  distanciaVisao: DISTANCIA_VISAO_PADRAO,
  distanciaSimulacao: DISTANCIA_SIMULACAO_PADRAO,
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
  };
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
