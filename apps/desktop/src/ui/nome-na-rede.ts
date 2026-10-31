/**
 * Nome digitado -> formato da rede do cartório (`^[a-z0-9][a-z0-9-]{0,31}$`): sem acento, minúsculas, hífen.
 * Único normalizador: o main usa para criar o convite e a tela para mostrar "Vai ficar como".
 */
export function nomeNaRede(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 32)
    .replace(/-+$/, "");
}
