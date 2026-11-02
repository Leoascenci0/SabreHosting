import type { EstadoInicio } from "./ponte.js";
// Regras puras da barra superior (sem tela): qual área está aberta e para onde a seta leva o foco.
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

export type TomChip = "ligado" | "desligado" | "troca" | "atencao";

// Chip de estado da barra superior: o mesmo EstadoInicio da tela Início, resumido em tom + palavra.
// "Ligando…" não é estado novo: é "ninguém hospeda" com trabalho em curso (atualizando/restaurando/trocando versão).
export function rotuloChip(e: EstadoInicio): { tom: TomChip; texto: string } {
  switch (e.tipo) {
    case "carregando":
      return { tom: "troca", texto: "Verificando…" };
    case "sem-cartorio":
      return { tom: "atencao", texto: "Sem cartório" };
    case "orfao":
      return { tom: "atencao", texto: "Servidor preso" };
    case "outro":
      return { tom: "ligado", texto: `${e.nomePc} hospeda` };
    case "eu":
      if (e.parando) return { tom: "troca", texto: "Desligando…" };
      return {
        tom: "ligado",
        texto: e.jogadores === undefined ? "Online" : `${e.jogadores.length} online`,
      };
    case "ninguem":
      return e.atualizando !== undefined || e.trabalho !== undefined
        ? { tom: "troca", texto: "Ligando…" }
        : { tom: "desligado", texto: "Desligado" };
  }
}

export function textoCartorio(e: EstadoInicio): string {
  if (e.tipo === "carregando") return "Cartório: verificando…";
  return e.tipo === "sem-cartorio" ? "Cartório: sem resposta" : "Cartório: conectado";
}
