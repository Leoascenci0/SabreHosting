// Contrato escrito à mão a partir das rotas de `services/cartorio/src/servidor.ts` (o núcleo não importa o cartório).
// Mudou uma resposta lá, muda aqui; o teste de `tests/integracao/` pega a diferença.

import { type PacoteDeLigacao, validarPacote } from "../rede/wireguard.js";

const MOTIVOS = [
  "ocupada",
  "atualizando",
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

/** Este PC (`GET /eu`): `dono` diz se ele é o dono do grupo. */
export interface Eu extends Pc {
  dono: boolean;
}

/** Um item de `GET /pcs`: só id, nome e se é o dono (nunca token, hash ou IP). */
export type PcDoGrupo = Eu;

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

const MOTIVOS_ATUALIZACAO = ["hospedando", "epoca_velha", "nao_e_dono", "vencida"] as const;

/** 409 de `POST /atualizacao/{pegar,renovar,soltar}` (syncmel-1.8a). Sem `donoPcId`: é sempre a trava do próprio PC. */
export interface AtualizacaoRecusada {
  ok: false;
  erro: string;
  motivo: (typeof MOTIVOS_ATUALIZACAO)[number];
  epoca: number;
  expiraEm: number;
}

/** O 200 tem o mesmo formato do da trava de host (o `Renovador` serve às duas). */
export type RespostaAtualizacao = TravaAceita | AtualizacaoRecusada;

/** `GET /trava`. */
export interface EstadoTrava {
  dono: Pc | null;
  epoca: number;
  expiraEm: number;
  prazoMs: number;
  renovarMs: number;
}

/** `GET/PUT /grupo/config`: o que todos os PCs do grupo usam igual (hostmel-3.1b). */
export interface ConfigGrupo {
  versaoMinecraft: string;
  /** sha1 do jar oficial da versão; vazio enquanto ninguém escolheu (padrão do cartório). */
  sha1Manifesto: string | null;
  atualizadoEm: number;
}

/** Um mod da lista do grupo (lanc-1.4). `arquivo` é só o nome do `.jar`; `sha512` é o hash que o download precisa bater. */
export interface ModGrupo {
  nome: string;
  versao: string;
  arquivo: string;
  url: string;
  sha512: string;
  lado: "cliente" | "servidor" | "ambos";
}

/** Única origem aceita para baixar mod. Conferida aqui (resposta da rede) e de novo ao baixar. */
export const HOST_MODS = "cdn.modrinth.com";
export const ARQUIVO_MOD = /^[A-Za-z0-9][A-Za-z0-9._+()-]{0,127}\.jar$/;

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

/** Versão registrada no cartório (`GET /versoes/mais-nova`). */
export interface VersaoRegistrada {
  numero: number;
  epoca: number;
  pcId: number;
  manifestoSha256: string;
  arquivos: number;
  bytes: number;
  criadaEm: number;
}

/** PC com a versão e o IP dele na rede privada (`null` até confirmar a entrada). */
export interface PcComCopia extends Pc {
  ip: string | null;
}

/** `GET /versoes/:n/copias`; `nuvem` diz só que a nuvem guarda a versão (não é fonte do espalhar ainda). */
export interface Copias {
  numero: number;
  nuvem: boolean;
  pcs: PcComCopia[];
}

/** Maior número de versão registrado no cartório (0 se nenhum), com ou sem pacote guardado. */
export function validarUltimoRegistrado(v: unknown): number {
  return inteiro(objeto(v, "versão mais nova"), "ultimoRegistrado");
}

export function validarMaisNova(v: unknown): VersaoRegistrada | null {
  const o = objeto(v, "versão mais nova");
  if (o.versao === null) return null;
  const x = objeto(o.versao, "versão");
  const sha = texto(x, "manifestoSha256");
  if (!/^[0-9a-f]{64}$/.test(sha))
    throw new Error("Resposta inválida do cartório: manifestoSha256.");
  return {
    numero: inteiro(x, "numero", 1),
    epoca: inteiro(x, "epoca"),
    pcId: inteiro(x, "pcId", 1),
    manifestoSha256: sha,
    arquivos: inteiro(x, "arquivos"),
    bytes: inteiro(x, "bytes"),
    criadaEm: inteiro(x, "criadaEm"),
  };
}

export function validarCopias(v: unknown): Copias {
  const o = objeto(v, "cópias");
  if (typeof o.nuvem !== "boolean" || !Array.isArray(o.pcs))
    throw new Error("Resposta inválida do cartório: cópias.");
  return {
    numero: inteiro(o, "numero", 1),
    nuvem: o.nuvem,
    pcs: o.pcs.map((p) => {
      const c = objeto(p, "PC");
      if (c.ip !== null && typeof c.ip !== "string")
        throw new Error("Resposta inválida do cartório: ip.");
      return { ...validarPc(c), ip: c.ip };
    }),
  };
}

export function validarEu(v: unknown): Eu {
  const o = objeto(v, "PC");
  if (typeof o.dono !== "boolean") throw new Error("Resposta inválida do cartório: dono.");
  return { id: inteiro(o, "id", 1), nome: texto(o, "nome"), dono: o.dono };
}

export function validarListaPcs(v: unknown): PcDoGrupo[] {
  if (!Array.isArray(v)) throw new Error("Resposta inválida do cartório: lista de PCs.");
  return v.map(validarEu);
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

export function validarRespostaAtualizacao(v: unknown): RespostaAtualizacao {
  const o = objeto(v, "trava de atualização");
  if (o.ok === true) {
    return {
      ok: true,
      epoca: inteiro(o, "epoca", 1),
      expiraEm: inteiro(o, "expiraEm"),
      renovarMs: inteiro(o, "renovarMs", 1),
    };
  }
  const motivo = MOTIVOS_ATUALIZACAO.find((m) => m === o.motivo);
  if (o.ok !== false || !motivo) {
    throw new Error("Resposta inválida do cartório: recusa da trava de atualização.");
  }
  return {
    ok: false,
    erro: cortarErro(texto(o, "erro")),
    motivo,
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

export function validarConfigGrupo(v: unknown): ConfigGrupo {
  const o = objeto(v, "configuração do grupo");
  const sha1 = o.sha1Manifesto;
  if (sha1 !== null && !(typeof sha1 === "string" && /^[0-9a-f]{40}$/.test(sha1)))
    throw new Error("Resposta inválida do cartório: sha1Manifesto.");
  return {
    versaoMinecraft: texto(o, "versaoMinecraft"),
    sha1Manifesto: sha1,
    atualizadoEm: inteiro(o, "atualizadoEm"),
  };
}

export function validarModsGrupo(v: unknown): ModGrupo[] {
  const o = objeto(v, "mods do grupo");
  if (!Array.isArray(o.mods) || o.mods.length > 200)
    throw new Error("Resposta inválida do cartório: lista de mods.");
  return o.mods.map((m: unknown): ModGrupo => {
    const x = objeto(m, "mod do grupo");
    const url = texto(x, "url");
    const arquivo = texto(x, "arquivo");
    const sha512 = texto(x, "sha512");
    const lado = x.lado;
    let ok = false;
    try {
      const u = new URL(url);
      ok = u.protocol === "https:" && u.hostname === HOST_MODS && !u.username && !u.password;
    } catch {
      /* url torta: ok continua falso */
    }
    if (
      !ok ||
      !ARQUIVO_MOD.test(arquivo) ||
      arquivo.includes("..") ||
      !/^[0-9a-f]{128}$/.test(sha512)
    )
      throw new Error("Resposta inválida do cartório: mod do grupo.");
    if (lado !== "cliente" && lado !== "servidor" && lado !== "ambos")
      throw new Error("Resposta inválida do cartório: lado do mod.");
    return { nome: texto(x, "nome"), versao: texto(x, "versao"), arquivo, url, sha512, lado };
  });
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

/** `201` de `POST /versoes`. */
export function validarVersaoCriada(v: unknown): number {
  return inteiro(objeto(v, "versão criada"), "numero", 1);
}

/** `201` de `PUT /versoes/:n/pacote`: o que a nuvem diz ter guardado. */
export function validarPacoteGuardado(v: unknown): {
  versao: number;
  sha256: string;
  bytes: number;
} {
  const o = objeto(v, "pacote guardado");
  const sha256 = texto(o, "sha256");
  if (!/^[0-9a-f]{64}$/.test(sha256)) throw new Error("Resposta inválida do cartório: sha256.");
  return { versao: inteiro(o, "versao", 1), sha256, bytes: inteiro(o, "bytes") };
}
