import type { SQLInputValue } from "node:sqlite";
import { type Banco, emTransacao } from "./banco.js";

/** Prazo da trava e intervalo em que o host renova (o app lê o intervalo da resposta). */
export interface TemposTrava {
  prazoMs: number;
  renovarMs: number;
}
export type MotivoRecusa =
  "ocupada" | "epoca_velha" | "nao_e_dono" | "vencida" | "destino_desconhecido";
export type ResultadoTrava =
  | { ok: true; epoca: number; expiraEm: number }
  | { ok: false; motivo: MotivoRecusa; donoPcId: number | null; epoca: number; expiraEm: number };
export interface EstadoTrava {
  donoPcId: number | null;
  epoca: number;
  expiraEm: number;
}
interface Linha {
  dono_pc_id: number | null;
  epoca: number;
  expira_em: number;
}

/** Padrão 60 s / 20 s. Prazo menor que 3 renovações derruba o host por um atraso de rede à toa. */
export function conferirTempos({
  prazoMs = 60_000,
  renovarMs = 20_000,
}: Partial<TemposTrava> = {}): TemposTrava {
  if (
    !Number.isInteger(renovarMs) ||
    renovarMs <= 0 ||
    !Number.isInteger(prazoMs) ||
    prazoMs < 3 * renovarMs
  ) {
    throw new Error(
      `Tempos da trava recusados: o prazo (${prazoMs} ms) precisa ser pelo menos 3 × a renovação (${renovarMs} ms), e a renovação maior que zero.`,
    );
  }
  return { prazoMs, renovarMs };
}

function linha(banco: Banco): Linha {
  return banco.prepare("SELECT dono_pc_id, epoca, expira_em FROM trava").get() as unknown as Linha;
}

/**
 * Um UPDATE condicional dentro de BEGIN IMMEDIATE: a condição é a regra, nunca "ler e depois escrever".
 * Só se nada mudou a linha é lida (na mesma transação) para dizer o motivo da recusa.
 */
function mudar(
  banco: Banco,
  sql: string,
  parametros: SQLInputValue[],
  motivo: (l: Linha) => MotivoRecusa,
): ResultadoTrava {
  return emTransacao(banco, () => {
    const feito = banco
      .prepare(`UPDATE trava SET ${sql} RETURNING epoca, expira_em`)
      .get(...parametros) as { epoca: number; expira_em: number } | undefined;
    if (feito) return { ok: true, epoca: feito.epoca, expiraEm: feito.expira_em };
    const l = linha(banco);
    return {
      ok: false,
      motivo: motivo(l),
      donoPcId: l.dono_pc_id,
      epoca: l.epoca,
      expiraEm: l.expira_em,
    };
  });
}

/** Por que uma operação do dono foi recusada. O último caso só acontece em `passar` (destino inexistente). */
function recusaDoDono(pc: number, epoca: number, agora: number) {
  return (l: Linha): MotivoRecusa =>
    l.epoca !== epoca
      ? "epoca_velha"
      : l.dono_pc_id !== pc
        ? "nao_e_dono"
        : l.expira_em <= agora
          ? "vencida"
          : "destino_desconhecido";
}

/** Livre, vencida ou já deste PC (app que reiniciou) → dono = pc, época + 1. */
export function pegar(banco: Banco, pc: number, agora: number, prazoMs: number): ResultadoTrava {
  return mudar(
    banco,
    `dono_pc_id = ?, expira_em = ?, epoca = epoca + 1
     WHERE dono_pc_id IS NULL OR dono_pc_id = ? OR expira_em <= ?`,
    [pc, agora + prazoMs, pc, agora],
    () => "ocupada",
  );
}

/** Só o dono atual, com a época atual e a trava ainda valendo, empurra o prazo. A época não muda. */
export function renovar(
  banco: Banco,
  pc: number,
  epoca: number,
  agora: number,
  prazoMs: number,
): ResultadoTrava {
  return mudar(
    banco,
    "expira_em = ? WHERE dono_pc_id = ? AND epoca = ? AND expira_em > ?",
    [agora + prazoMs, pc, epoca, agora],
    recusaDoDono(pc, epoca, agora),
  );
}

/** Migração de host: só o dono atual (época atual, valendo) passa para um PC do grupo; época + 1. */
export function passar(
  banco: Banco,
  de: number,
  para: number,
  epoca: number,
  agora: number,
  prazoMs: number,
): ResultadoTrava {
  return mudar(
    banco,
    `dono_pc_id = ?, expira_em = ?, epoca = epoca + 1
     WHERE dono_pc_id = ? AND epoca = ? AND expira_em > ? AND EXISTS (SELECT 1 FROM pcs WHERE id = ?)`,
    [para, agora + prazoMs, de, epoca, agora, para],
    recusaDoDono(de, epoca, agora),
  );
}

/** Só o dono com a época atual solta. A época fica: o próximo `pegar` a sobe. */
export function soltar(banco: Banco, pc: number, epoca: number): ResultadoTrava {
  return mudar(
    banco,
    "dono_pc_id = NULL, expira_em = 0 WHERE dono_pc_id = ? AND epoca = ?",
    [pc, epoca],
    recusaDoDono(pc, epoca, Infinity),
  );
}

/** Dono só enquanto a trava vale; vencida aparece sem dono. */
export function estadoTrava(banco: Banco, agora: number): EstadoTrava {
  const l = linha(banco);
  return {
    donoPcId: l.expira_em > agora ? l.dono_pc_id : null,
    epoca: l.epoca,
    expiraEm: l.expira_em,
  };
}
