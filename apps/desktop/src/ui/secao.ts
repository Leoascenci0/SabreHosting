// Seção recolhível (appuimel-2.5/2.6): o mesmo comportamento em todas as telas. Lembra aberta/fechada só neste PC
// (preferência local; sem localStorage, abre sempre).
export interface SecaoLigada {
  /** Abre a seção à força (ex.: campo com erro dentro dela) e lembra. */
  abrir(): void;
}

function lido(chave: string): boolean {
  try {
    return localStorage.getItem(chave) !== "fechada";
  } catch {
    return true;
  }
}

function guardado(chave: string, aberta: boolean): void {
  try {
    localStorage.setItem(chave, aberta ? "aberta" : "fechada");
  } catch {
    /* sem armazenamento local: segue sem lembrar */
  }
}

/** `nome` entra no texto do leitor de tela: "Recolher <nome>" / "Abrir <nome>". */
export function ligarSecao(
  seta: HTMLButtonElement,
  corpo: HTMLElement,
  chave: string,
  nome: string,
): SecaoLigada {
  const aplicar = (aberta: boolean): void => {
    corpo.hidden = !aberta;
    seta.setAttribute("aria-expanded", String(aberta));
    seta.setAttribute("aria-label", `${aberta ? "Recolher" : "Abrir"} ${nome}`);
  };
  aplicar(lido(chave));
  seta.addEventListener("click", () => {
    const aberta = seta.getAttribute("aria-expanded") !== "true";
    aplicar(aberta);
    guardado(chave, aberta);
  });
  return {
    abrir() {
      aplicar(true);
      guardado(chave, true);
    },
  };
}
