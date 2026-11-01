/**
 * Roda uma parte opcional do arranque (bandeja, ícone da janela). Se falhar, registra o erro (sem esconder) e devolve
 * `undefined`: o app segue e a janela nasce mesmo assim (appmel-1.30).
 */
export function tentar<T>(
  nome: string,
  fazer: () => T,
  registrar: (mensagem: string, erro: unknown) => void = console.error,
): T | undefined {
  try {
    return fazer();
  } catch (erro) {
    registrar(`Não foi possível iniciar: ${nome}. O app segue sem isso.`, erro);
    return undefined;
  }
}
