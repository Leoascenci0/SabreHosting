import { isAbsolute } from "node:path";
import type { CampoComErro, ConfiguracoesDaTela, Resultado } from "../ui/ponte.js";
import { validarDistancias } from "@sabrehosting/nucleo/servidor/configurar";
import {
  lerPreferencias,
  salvarPreferencias,
  validarHistoricoLongo,
  validarIntervaloBackup,
  validarQuantosGuardar,
} from "./preferencias.js";

export interface DepsConfiguracoes {
  pasta: string;
  /** Liga ou desliga o início junto com o Windows (só o `app` sabe fazer). */
  aplicarAbrirComWindows(ligado: boolean): void;
  /** Depois de gravar: o agendador de backup passa a usar o novo intervalo (minutos). */
  aplicarIntervaloBackup?(min: number): void;
  /** Seletor de pasta do sistema; `undefined` se cancelar. */
  escolherPasta?(): Promise<string | undefined>;
}

const GENERICA = "Não consegui salvar agora. Nada foi alterado.";

/** O que chega da tela é desconhecido: só inteiro e booleano passam; o resto nem chega a gravar. */
function lerValor(valor: unknown): ConfiguracoesDaTela | undefined {
  if (typeof valor !== "object" || valor === null) return undefined;
  const v = valor as Record<string, unknown>;
  if (typeof v["abrirComWindows"] !== "boolean") return undefined;
  if (typeof v["distanciaVisao"] !== "number" || typeof v["distanciaSimulacao"] !== "number") {
    return undefined;
  }
  if (typeof v["intervaloBackupMin"] !== "number") return undefined;
  if (typeof v["quantosGuardar"] !== "number") return undefined;
  if (typeof v["historicoLongoLigado"] !== "boolean") return undefined;
  if (typeof v["historicoLongoPasta"] !== "string") return undefined;
  return {
    historicoLongoLigado: v["historicoLongoLigado"],
    historicoLongoPasta: v["historicoLongoPasta"].trim(),
    intervaloBackupMin: v["intervaloBackupMin"],
    quantosGuardar: v["quantosGuardar"],
    abrirComWindows: v["abrirComWindows"],
    distanciaVisao: v["distanciaVisao"],
    distanciaSimulacao: v["distanciaSimulacao"],
  };
}

export function criarConfiguracoes(deps: DepsConfiguracoes) {
  return {
    ler: (): ConfiguracoesDaTela => lerPreferencias(deps.pasta),
    /** Só devolve caminho absoluto (o resto, inclusive cancelar, vira `undefined`); quem salva valida de novo. */
    async escolherPasta(): Promise<string | undefined> {
      try {
        const p = await deps.escolherPasta?.();
        return typeof p === "string" && isAbsolute(p) ? p : undefined;
      } catch {
        return undefined;
      }
    },
    /** Valida tudo ANTES de gravar: valor inválido não toca no arquivo. */
    salvar(valor: unknown): Resultado {
      const novo = lerValor(valor);
      if (!novo) return { ok: false, mensagem: "Valor inválido. Nada foi alterado." };
      const checagens: [CampoComErro, () => void][] = [
        ["distancias", () => validarDistancias(novo.distanciaVisao, novo.distanciaSimulacao)],
        ["intervalo", () => validarIntervaloBackup(novo.intervaloBackupMin)],
        ["quantos", () => validarQuantosGuardar(novo.quantosGuardar)],
        [
          "historico",
          () => validarHistoricoLongo(novo.historicoLongoLigado, novo.historicoLongoPasta),
        ],
      ];
      for (const [campo, checar] of checagens) {
        try {
          checar();
        } catch (e) {
          return { ok: false, mensagem: e instanceof Error ? e.message : GENERICA, campo };
        }
      }
      try {
        salvarPreferencias(deps.pasta, novo);
        deps.aplicarAbrirComWindows(novo.abrirComWindows);
        deps.aplicarIntervaloBackup?.(novo.intervaloBackupMin);
      } catch {
        return { ok: false, mensagem: GENERICA };
      }
      return { ok: true };
    },
  };
}

export type Configuracoes = ReturnType<typeof criarConfiguracoes>;
