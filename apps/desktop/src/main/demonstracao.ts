import type { Resultado } from "../ui/ponte.js";

/** Texto fixo das recusas: o main responde isto no lugar de gravar, hospedar ou falar com o cartório. */
export const TEXTO_DEMONSTRACAO = "Isso é só uma demonstração. Nada foi alterado.";
export const RECUSA_DEMONSTRACAO: Extract<Resultado, { ok: false }> = {
  ok: false,
  mensagem: TEXTO_DEMONSTRACAO,
};

export interface Demonstracao<P> {
  ativa(): boolean;
  /** As peças de mentira (só existem depois do primeiro `entrar`). */
  pecas(): P | undefined;
  /** Liga o modo; monta as peças falsas na primeira vez e reaproveita nas seguintes. */
  entrar(): Promise<void>;
  sair(): void;
}

/**
 * Modo "Explorar sem grupo" (appmel-1.31): vive só na memória do processo (nunca em disco; ao fechar o app volta
 * desligado). `montar` cria as peças falsas, em pasta temporária; nada aqui toca o mundo, o cofre ou o cartório.
 */
export function criarDemonstracao<P>(montar: () => Promise<P>): Demonstracao<P> {
  let ligada = false;
  let pecas: P | undefined;
  let montando: Promise<P> | undefined;
  return {
    ativa: () => ligada,
    pecas: () => (ligada ? pecas : undefined),
    async entrar() {
      pecas ??= await (montando ??= montar().finally(() => (montando = undefined)));
      ligada = true;
    },
    sair() {
      ligada = false;
    },
  };
}

/**
 * Toda ação que grava ou fala com o mundo passa por aqui, no main: em demonstração devolve a recusa e NÃO chama
 * `fazer`. Esconder o botão na tela não basta (a ponte pode ser chamada direto).
 */
export function protegerEscrita<A extends unknown[], R>(
  demo: { ativa(): boolean },
  fazer: (...a: A) => R,
  recusa: R | Extract<Resultado, { ok: false }> = RECUSA_DEMONSTRACAO,
): (...a: A) => R | Extract<Resultado, { ok: false }> {
  return (...a) => (demo.ativa() ? recusa : fazer(...a));
}
