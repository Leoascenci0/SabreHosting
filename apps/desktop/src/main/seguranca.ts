export function navegacaoPermitida(destino: string, paginaDoApp: string): boolean {
  try {
    const alvo = new URL(destino);
    const pagina = new URL(paginaDoApp);
    return alvo.protocol === pagina.protocol && alvo.pathname === pagina.pathname;
  } catch {
    return false;
  }
}

export function ehBooleano(valor: unknown): valor is boolean {
  return typeof valor === "boolean";
}
