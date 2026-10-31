export function navegacaoPermitida(destino: string, paginaDoApp: string): boolean {
  try {
    const alvo = new URL(destino);
    const pagina = new URL(paginaDoApp);
    return alvo.protocol === pagina.protocol && alvo.pathname === pagina.pathname;
  } catch {
    return false;
  }
}

// Só a página do próprio app pode falar com o processo principal.
export function veioDaPagina(
  evento: { senderFrame?: { url: string } | null },
  paginaDoApp: string,
): boolean {
  return navegacaoPermitida(evento.senderFrame?.url ?? "", paginaDoApp);
}

export function ehBooleano(valor: unknown): valor is boolean {
  return typeof valor === "boolean";
}
