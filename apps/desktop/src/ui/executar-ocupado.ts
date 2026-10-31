/**
 * Roda uma ação da tela marcando "ocupado" e SEMPRE desmarca no fim (`finally`): uma exceção no meio nunca deixa os
 * botões travados. Se a ação lançar, `aoFalhar` mostra a mensagem.
 */
export async function executarOcupado(
  ocupar: (sim: boolean) => void,
  fazer: () => Promise<void>,
  aoFalhar: () => void,
): Promise<void> {
  ocupar(true);
  try {
    await fazer();
  } catch {
    aoFalhar();
  } finally {
    ocupar(false);
  }
}
