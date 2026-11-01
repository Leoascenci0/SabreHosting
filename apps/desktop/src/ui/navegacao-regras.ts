// Regras puras da barra lateral (sem tela): qual área está aberta e para onde a seta leva o foco.
export const AREAS = ["inicio", "backups", "grupo", "configuracoes"] as const;
export type Area = (typeof AREAS)[number];

// Grupo e Mods têm tela própria (Mods é subtela de Grupo, sem item na barra): os dois marcam "Grupo".
export function areaDeTela(idTela: string): Area | undefined {
  switch (idTela) {
    case "cartao":
    case "tela-importar": // subtela do Início (Importar mundo)
      return "inicio";
    case "tela-backups":
      return "backups";
    case "tela-grupo":
    case "tela-mods":
      return "grupo";
    case "tela-config":
      return "configuracoes";
    default:
      return undefined; // Boas-vindas: primeira vez, sem barra
  }
}

export function proximoIndice(atual: number, total: number, tecla: string): number | undefined {
  switch (tecla) {
    case "ArrowDown":
    case "ArrowRight":
      return (atual + 1) % total;
    case "ArrowUp":
    case "ArrowLeft":
      return (atual - 1 + total) % total;
    case "Home":
      return 0;
    case "End":
      return total - 1;
    default:
      return undefined;
  }
}
