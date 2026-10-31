/**
 * Saída por fora da bandeja (ex.: desligar o Windows): o app passa por `sairDoApp` antes de fechar se houver algo a
 * encerrar com calma. O servidor de arquivos conta, mesmo sem servidor Minecraft ativo (syncmel-1.11b).
 */
export function precisaEncerrarAntesDeSair(e: {
  podeSair: boolean;
  encerrando: boolean;
  servidorMinecraftAtivo: boolean;
  servindoArquivos: boolean;
}): boolean {
  return !e.podeSair && (e.encerrando || e.servidorMinecraftAtivo || e.servindoArquivos);
}
