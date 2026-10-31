import { type Banco, emTransacao } from "./banco.js";

/**
 * Trava de atualização (syncmel-1.8a): cada PC atualiza a PRÓPRIA cópia do mundo em segundo plano, mesmo com outro
 * PC hospedando. Separada da trava de host: nunca dá direito de hospedar; enquanto vale, o PC não pega o host
 * (`trava.ts`) e o host não pega atualização (o mundo vivo não se toca).
 */
export type MotivoAtualizacao = "hospedando" | "epoca_velha" | "nao_e_dono" | "vencida";
export type ResultadoAtualizacao =
  | { ok: true; epoca: number; expiraEm: number }
  | { ok: false; motivo: MotivoAtualizacao; epoca: number; expiraEm: number };
interface Linha {
  epoca: number;
  expira_em: number;
}

/** Mesmo molde do `mudar` da trava: a condição do SQL é a regra; o motivo só é lido se nada mudou. */
function mudar(
  banco: Banco,
  pc: number,
  sql: string,
  parametros: number[],
  motivo: (l: Linha | undefined) => MotivoAtualizacao,
): ResultadoAtualizacao {
  return emTransacao(banco, () => {
    const feito = banco.prepare(`${sql} RETURNING epoca, expira_em`).get(...parametros) as
      Linha | undefined;
    if (feito) return { ok: true, epoca: feito.epoca, expiraEm: feito.expira_em };
    const l = banco.prepare("SELECT epoca, expira_em FROM atualizacao WHERE pc_id = ?").get(pc) as
      Linha | undefined;
    return { ok: false, motivo: motivo(l), epoca: l?.epoca ?? 0, expiraEm: l?.expira_em ?? 0 };
  });
}

/** Sem linha: o PC nunca pegou. Com a época atual, só recusa quem já venceu (o `soltar` nunca chega aqui). */
function recusa(epoca: number) {
  return (l: Linha | undefined): MotivoAtualizacao =>
    !l ? "nao_e_dono" : l.epoca !== epoca ? "epoca_velha" : "vencida";
}

/** O próprio PC começa (ou, app reiniciado, recomeça) a atualizar: época + 1. Quem hospeda agora é recusado. */
export function pegarAtualizacao(
  banco: Banco,
  pc: number,
  agora: number,
  prazoMs: number,
): ResultadoAtualizacao {
  return mudar(
    banco,
    pc,
    `INSERT INTO atualizacao (pc_id, epoca, expira_em)
     SELECT ?, 1, ? WHERE NOT EXISTS (SELECT 1 FROM trava WHERE dono_pc_id = ? AND expira_em > ?)
     ON CONFLICT (pc_id) DO UPDATE SET epoca = epoca + 1, expira_em = excluded.expira_em`,
    [pc, agora + prazoMs, pc, agora],
    () => "hospedando",
  );
}

/** Só a época atual, ainda valendo, empurra o prazo. */
export function renovarAtualizacao(
  banco: Banco,
  pc: number,
  epoca: number,
  agora: number,
  prazoMs: number,
): ResultadoAtualizacao {
  return mudar(
    banco,
    pc,
    "UPDATE atualizacao SET expira_em = ? WHERE pc_id = ? AND epoca = ? AND expira_em > ?",
    [agora + prazoMs, pc, epoca, agora],
    recusa(epoca),
  );
}

/** A época atual zera o prazo. Repetir dá certo de novo (resposta perdida na rede não prende o PC). */
export function soltarAtualizacao(banco: Banco, pc: number, epoca: number): ResultadoAtualizacao {
  return mudar(
    banco,
    pc,
    "UPDATE atualizacao SET expira_em = 0 WHERE pc_id = ? AND epoca = ?",
    [pc, epoca],
    recusa(epoca),
  );
}
