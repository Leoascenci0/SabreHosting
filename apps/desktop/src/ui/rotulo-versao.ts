/** Texto do botão de confirmar a troca de versão; enquanto ocupado, avisa que o backup vem antes. */
export function rotuloConfirmarVersao(ocupado: boolean): string {
  return ocupado ? "Fazendo backup antes…" : "Trocar";
}
