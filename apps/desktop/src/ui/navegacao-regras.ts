// Regras puras da barra lateral (sem tela): qual área está aberta e para onde a seta leva o foco.
export const AREAS = ["inicio", "backups", "grupo", "configuracoes"] as const;
export type Area = (typeof AREAS)[number];

// Grupo ainda divide a tela de Configurações (a tela própria vem no item 1.4): se o amigo
// chegou por "Grupo" e a tela continua a mesma, o item atual continua sendo "Grupo".
export function areaDeTela(idTela: string, anterior: Area | undefined): Area | undefined {
  switch (idTela) {
    case "cartao":
      return "inicio";
    case "tela-backups":
      return "backups";
    case "tela-config":
      return anterior === "grupo" ? "grupo" : "configuracoes";
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
