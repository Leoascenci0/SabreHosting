// Indicador "Passo n de N", igual em Boas-vindas e Importar mundo (appui-1.6). Só texto e bolinhas; sem estado próprio.

/** Texto do indicador; o número fica sempre entre 1 e o total. */
export function rotuloDoPasso(n: number, total: number): string {
  const passo = Math.min(Math.max(Math.trunc(n), 1), total);
  return `Passo ${passo} de ${total}`;
}

/** Escreve o rótulo (um `role="status"` fala o passo novo) e acende as bolinhas, que são só enfeite (`aria-hidden`). */
export function marcarPasso(
  rotulo: HTMLElement,
  bolinhas: HTMLElement,
  n: number,
  total: number,
): void {
  rotulo.textContent = rotuloDoPasso(n, total);
  const itens = [...bolinhas.children] as HTMLElement[];
  itens.forEach((b, i) => {
    b.dataset["atual"] = String(i + 1 === n);
    b.dataset["feito"] = String(i + 1 <= n);
  });
}
