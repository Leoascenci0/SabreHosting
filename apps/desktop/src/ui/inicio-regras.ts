import { dataEmPalavras, haQuanto } from "./ha-quanto.js";
import { textoCartorio } from "./navegacao-regras.js";
import type { EstadoInicio } from "./ponte.js";

export type TomPeca = "ligado" | "desligado" | "troca" | "atencao";
export interface Peca {
  id: "pc" | "servidor" | "grupo";
  rotulo: string;
  tom: TomPeca;
  palavra: string;
  detalhe: string;
}
export interface Numero {
  id: "jogadores" | "tempo" | "ram" | "mundo" | "backups" | "ultimo";
  rotulo: string;
  valor: string;
  /** Contexto real ao lado do número; nunca um "era X" inventado. */
  comparacao: string;
  /** Por que o valor é "—". */
  dica?: string;
}

const SEM = "—";
const SO_HOST = "só quem hospeda sabe";
const virgula = (n: number): string => n.toFixed(1).replace(".", ",").replace(/,0$/, "");

export function tempoLigado(segundos: number): string {
  const min = Math.floor(segundos / 60);
  if (min < 1) return "menos de 1 min";
  if (min < 60) return `${min} min`;
  return `${Math.floor(min / 60)} h ${String(min % 60).padStart(2, "0")} min`;
}

export function tamanhoEmPalavras(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  return gb >= 1 ? `${virgula(gb)} GB` : `${Math.round(bytes / 1024 ** 2)} MB`;
}

const gbDeMb = (mb: number): string => `${virgula(mb / 1024)} GB`;

/** As seis cifras do Início: só o que o app sabe; o resto é "—" com a razão. */
export function gradeDeNumeros(e: EstadoInicio, agora: number = Date.now()): Numero[] {
  const d = e.tipo === "ninguem" || e.tipo === "outro" || e.tipo === "eu" ? e : undefined;
  const meu = e.tipo === "eu" && !e.parando ? e : undefined;
  const ultimo = d?.ultimoBackup ? haQuanto(d.ultimoBackup, agora) : undefined;
  const n = d?.quantidadeBackups;
  return [
    meu?.jogadores !== undefined
      ? {
          id: "jogadores",
          rotulo: "Jogadores",
          valor: String(meu.jogadores.length),
          comparacao: "online agora",
        }
      : { id: "jogadores", rotulo: "Jogadores", valor: SEM, comparacao: "", dica: SO_HOST },
    meu?.ligadoSegundos !== undefined
      ? {
          id: "tempo",
          rotulo: "Tempo ligado",
          valor: tempoLigado(meu.ligadoSegundos),
          comparacao: "desde que você ligou",
        }
      : { id: "tempo", rotulo: "Tempo ligado", valor: SEM, comparacao: "", dica: SO_HOST },
    meu?.ramReservadaMb !== undefined
      ? {
          id: "ram",
          rotulo: "RAM",
          valor: gbDeMb(meu.ramReservadaMb),
          comparacao:
            meu.totalMemMb !== undefined
              ? `reservada, de ${gbDeMb(meu.totalMemMb)} do PC`
              : "reservada ao servidor",
        }
      : { id: "ram", rotulo: "RAM", valor: SEM, comparacao: "", dica: SO_HOST },
    d?.tamanhoMundoBytes !== undefined
      ? {
          id: "mundo",
          rotulo: "Mundo",
          valor: tamanhoEmPalavras(d.tamanhoMundoBytes),
          comparacao: "no disco deste PC",
        }
      : {
          id: "mundo",
          rotulo: "Mundo",
          valor: SEM,
          comparacao: "",
          dica: "sem pasta do mundo neste PC",
        },
    n !== undefined
      ? {
          id: "backups",
          rotulo: "Backups",
          valor: String(n),
          comparacao: n === 1 ? "backup guardado" : "backups guardados",
        }
      : {
          id: "backups",
          rotulo: "Backups",
          valor: SEM,
          comparacao: "",
          dica: "sem pasta de backups",
        },
    ultimo !== undefined && d?.ultimoBackup
      ? {
          id: "ultimo",
          rotulo: "Último backup",
          valor: ultimo,
          comparacao: dataEmPalavras(d.ultimoBackup, agora) ?? "",
        }
      : {
          id: "ultimo",
          rotulo: "Último backup",
          valor: SEM,
          comparacao: "",
          dica: "nenhum backup ainda",
        },
  ];
}

/** Este PC / Servidor / Grupo: cor (borda) + ícone + palavra, nunca só cor. */
export function pecasDeEstado(e: EstadoInicio): Peca[] {
  const grupo = textoCartorio(e).replace("Cartório: ", "");
  const tomGrupo: TomPeca =
    e.tipo === "carregando" ? "troca" : e.tipo === "sem-cartorio" ? "atencao" : "ligado";
  const g: Peca = {
    id: "grupo",
    rotulo: "Grupo",
    tom: tomGrupo,
    palavra: grupo.charAt(0).toUpperCase() + grupo.slice(1).replace("…", ""),
    detalhe: e.tipo === "sem-cartorio" ? "sem resposta do grupo" : "conexão com o grupo",
  };
  const peca = (pc: [TomPeca, string, string], sv: [TomPeca, string, string]): Peca[] => [
    { id: "pc", rotulo: "Este PC", tom: pc[0], palavra: pc[1], detalhe: pc[2] },
    { id: "servidor", rotulo: "Servidor", tom: sv[0], palavra: sv[1], detalhe: sv[2] },
    g,
  ];
  switch (e.tipo) {
    case "carregando":
      return peca(["troca", "Verificando", ""], ["troca", "Verificando", ""]);
    case "sem-cartorio":
      return peca(
        ["atencao", "Sem conexão", "não sei se pode hospedar"],
        ["atencao", "Sem informação", ""],
      );
    case "orfao":
      return peca(
        ["atencao", "Servidor preso", "feche o Java"],
        ["atencao", "Preso", "da sessão anterior"],
      );
    case "outro":
      return peca(
        ["desligado", "Só joga", "outro PC tem a vez"],
        ["ligado", "Ligado", `no PC do ${e.nomePc}`],
      );
    case "eu":
      return e.parando
        ? peca(["troca", "Devolvendo a vez", ""], ["troca", "Desligando", ""])
        : peca(["ligado", "Hospedando", "tem a vez de hospedar"], ["ligado", "Ligado", "neste PC"]);
    case "ninguem":
      return e.atualizando !== undefined || e.trabalho !== undefined
        ? peca(["troca", "Ocupado", "mexendo no mundo"], ["troca", "Ligando", ""])
        : peca(["desligado", "Pode hospedar", "a vez está livre"], ["desligado", "Desligado", ""]);
  }
}
