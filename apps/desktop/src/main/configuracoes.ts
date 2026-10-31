import type { ConfiguracoesDaTela, Resultado } from "../ui/ponte.js";
import { validarDistancias } from "@sabrehosting/nucleo/servidor/configurar";
import { lerPreferencias, salvarPreferencias } from "./preferencias.js";

export interface DepsConfiguracoes {
  pasta: string;
  /** Liga ou desliga o início junto com o Windows (só o `app` sabe fazer). */
  aplicarAbrirComWindows(ligado: boolean): void;
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
  return {
    abrirComWindows: v["abrirComWindows"],
    distanciaVisao: v["distanciaVisao"],
    distanciaSimulacao: v["distanciaSimulacao"],
  };
}

export function criarConfiguracoes(deps: DepsConfiguracoes) {
  return {
    ler: (): ConfiguracoesDaTela => lerPreferencias(deps.pasta),
    /** Valida tudo ANTES de gravar: valor inválido não toca no arquivo. */
    salvar(valor: unknown): Resultado {
      const novo = lerValor(valor);
      if (!novo) return { ok: false, mensagem: "Valor inválido. Nada foi alterado." };
      try {
        validarDistancias(novo.distanciaVisao, novo.distanciaSimulacao);
      } catch (e) {
        return { ok: false, mensagem: e instanceof Error ? e.message : GENERICA };
      }
      try {
        salvarPreferencias(deps.pasta, novo);
        deps.aplicarAbrirComWindows(novo.abrirComWindows);
      } catch {
        return { ok: false, mensagem: GENERICA };
      }
      return { ok: true };
    },
  };
}

export type Configuracoes = ReturnType<typeof criarConfiguracoes>;
