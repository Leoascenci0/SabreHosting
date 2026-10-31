/** Último problema da cópia para o histórico longo, para a tela de Backups mostrar. Só memória: some ao fechar o app. */
export function criarAvisoHistorico() {
  let texto: string | undefined;
  return {
    definir(novo: string | undefined): void {
      texto = novo;
    },
    ler: (): string | undefined => texto,
  };
}

export type AvisoHistorico = ReturnType<typeof criarAvisoHistorico>;
