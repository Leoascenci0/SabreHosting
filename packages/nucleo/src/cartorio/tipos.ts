// Contrato escrito à mão a partir das rotas de `services/cartorio/src/servidor.ts` (o núcleo não importa o cartório).
// Mudou uma resposta lá, muda aqui; o teste de `tests/integracao/` pega a diferença.

import { type PacoteDeLigacao, validarPacote } from "../rede/wireguard.js";

const MOTIVOS = [
  "ocupada",
  "epoca_velha",
  "nao_e_dono",
  "vencida",
  "destino_desconhecido",
  "destino_sem_acesso",
  "destino_invalido",
] as const;
export type MotivoRecusa = (typeof MOTIVOS)[number];

export interface Pc {
  id: number;
  nome: string;
}

/** 200 de `POST /trava/{pegar,renovar,passar,soltar}`. `expiraEm` é do relógio do cartório: não usar para prazo. */
export interface TravaAceita {
  ok: true;
  epoca: number;
  expiraEm: number;
  renovarMs: number;
}

/** 409 das mesmas rotas. `epoca` é a atual do cartório, não a deste PC: nunca adotar. */
export interface TravaRecusada {
  ok: false;
  erro: string;
  motivo: MotivoRecusa;
  donoPcId: number | null;
  epoca: number;
  expiraEm: number;
}

export type RespostaTrava = TravaAceita | TravaRecusada;

/** `GET /trava`. */
export interface EstadoTrava {
  dono: Pc | null;
  epoca: number;
  expiraEm: number;
  prazoMs: number;
  renovarMs: number;
}

/** `GET /grupo`. */
export interface Grupo {
  nome: string;
  endereco_jogar: string;
}

/** 201 de `POST /convites` (só o PC dono). `convite` é o texto `sabre://convite/1.…`; mostrar e esquecer. */
export interface ConviteCriado {
  convite: string;
  expiraEm: number;
}

/** 200 de `POST /convites/usar`. O token vai para o cofre; o pacote, para o túnel definitivo. */
export interface EntradaNoGrupo {
  token: string;
  pacote: PacoteDeLigacao;
}

// Conferência das respostas (elas vêm da rede: nada de `as T`). Só o que o tipo promete passa, campo a campo;
// campo a mais é ignorado e não volta no objeto. Erro aqui vira `ErroCartorio` "resposta" no cliente.

type Campos = Record<string, unknown>;

function objeto(v: unknown, nome: string): Campos {
  if (typeof v !== "object" || v === null || Array.isArray(v))
    throw new Error(`Resposta inválida do cartório: ${nome}.`);
  return v as Campos;
}

/** Inteiro seguro ≥ `minimo` (época, prazo, instante do relógio do cartório). */
function inteiro(o: Campos, campo: string, minimo = 0): number {
  const v = o[campo];
  if (!Number.isSafeInteger(v) || (v as number) < minimo)
    throw new Error(`Resposta inválida do cartório: ${campo}.`);
  return v as number;
}

const TETO_ERRO = 200;

/** Mensagem do cartório vai para o log e para a tela: corta em ~200 caracteres (com reticências). */
export function cortarErro(t: string): string {
  return t.length > TETO_ERRO ? `${t.slice(0, TETO_ERRO)}…` : t;
}

function texto(o: Campos, campo: string): string {
  const v = o[campo];
  if (typeof v !== "string" || v === "")
    throw new Error(`Resposta inválida do cartório: ${campo}.`);
  return v;
}

export function validarPc(v: unknown): Pc {
  const o = objeto(v, "PC");
  return { id: inteiro(o, "id", 1), nome: texto(o, "nome") };
}

/** Aceita: a época sempre ≥ 1 (pegar sobe a época). Recusa: a do cartório, que começa em 0. */
export function validarRespostaTrava(v: unknown): RespostaTrava {
  const o = objeto(v, "trava");
  if (o.ok === true) {
    return {
      ok: true,
      epoca: inteiro(o, "epoca", 1),
      expiraEm: inteiro(o, "expiraEm"),
      renovarMs: inteiro(o, "renovarMs", 1),
    };
  }
  const motivo = MOTIVOS.find((m) => m === o.motivo);
  if (o.ok !== false || !motivo) throw new Error("Resposta inválida do cartório: recusa da trava.");
  return {
    ok: false,
    erro: cortarErro(texto(o, "erro")),
    motivo,
    donoPcId: o.donoPcId === null ? null : inteiro(o, "donoPcId", 1),
    epoca: inteiro(o, "epoca"),
    expiraEm: inteiro(o, "expiraEm"),
  };
}

export function validarEstadoTrava(v: unknown): EstadoTrava {
  const o = objeto(v, "estado da trava");
  return {
    dono: o.dono === null ? null : validarPc(o.dono),
    epoca: inteiro(o, "epoca"),
    expiraEm: inteiro(o, "expiraEm"),
    prazoMs: inteiro(o, "prazoMs", 1),
    renovarMs: inteiro(o, "renovarMs", 1),
  };
}

export function validarGrupo(v: unknown): Grupo {
  const o = objeto(v, "grupo");
  return { nome: texto(o, "nome"), endereco_jogar: texto(o, "endereco_jogar") };
}

export function validarConviteCriado(v: unknown): ConviteCriado {
  const o = objeto(v, "convite");
  return { convite: texto(o, "convite"), expiraEm: inteiro(o, "expiraEm") };
}

/** O pacote passa pela mesma conferência do túnel (`validarPacote`): campo torto poderia injetar linha na config. */
export function validarEntradaNoGrupo(v: unknown): EntradaNoGrupo {
  const o = objeto(v, "entrada no grupo");
  return { token: texto(o, "token"), pacote: validarPacote(o.pacote) };
}
