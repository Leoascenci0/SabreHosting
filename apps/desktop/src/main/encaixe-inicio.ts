/** Encaixe de Jogar/Hospedar: depois de trocar a pasta o app reinicia em ~1,5 s e não aceita nenhum dos dois até lá. */
export const REINICIANDO = "O app está reiniciando para usar a pasta nova. Espere alguns segundos.";

export interface DepsEncaixeInicio<J, H> {
  trocada: () => boolean;
  jogar: () => J;
  hospedar: () => H;
}

export function criarEncaixeInicio<J, H>(deps: DepsEncaixeInicio<J, H>) {
  return {
    jogar(): J {
      if (deps.trocada()) throw new Error(REINICIANDO);
      return deps.jogar();
    },
    hospedar(): H | { ok: false; mensagem: string } {
      if (deps.trocada()) return { ok: false, mensagem: REINICIANDO };
      return deps.hospedar();
    },
  };
}
