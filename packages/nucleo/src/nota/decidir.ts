export const SETE_DIAS_MS = 7 * 24 * 60 * 60 * 1000;

export interface EntradaDecisao {
  /** Quando foi a última medição; `null` se este PC nunca mediu. */
  ultimaMedicaoEm: Date | null;
  agora: Date;
  jogoAberto: boolean;
  /** Configurações › Geral › "Permitir que meu PC hospede" (padrão desligado). */
  permitirHospedar: boolean;
}

/** Mede no 1º uso e a cada 7 dias; nunca com o jogo aberto e nunca se o PC não pode hospedar. */
export function deveMedir(e: EntradaDecisao): boolean {
  if (e.jogoAberto || !e.permitirHospedar) return false;
  if (e.ultimaMedicaoEm === null) return true;
  return e.agora.getTime() - e.ultimaMedicaoEm.getTime() >= SETE_DIAS_MS;
}
