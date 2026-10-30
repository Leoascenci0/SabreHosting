// Contrato escrito à mão a partir das rotas de `services/cartorio/src/servidor.ts` (o núcleo não importa o cartório).
// Mudou uma resposta lá, muda aqui; o teste de `tests/integracao/` pega a diferença.

export type MotivoRecusa =
  | "ocupada"
  | "epoca_velha"
  | "nao_e_dono"
  | "vencida"
  | "destino_desconhecido"
  | "destino_invalido";

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
