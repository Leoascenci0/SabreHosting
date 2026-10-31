import { chaveValida } from "./wireguard.js";

/** Convite lido e conferido. Contém segredo (`chavePrivadaProvisoria`, `codigo`): nunca vai para log nem para erro. */
export interface Convite {
  grupo: string;
  /** `host:porta` do WireGuard do hub. */
  hub: string;
  chavePublicaHub: string;
  /** IP da sala de entrada (10.66.0.200–254). */
  ipProvisorio: string;
  chavePrivadaProvisoria: string;
  codigo: string;
  portaCartorio: number;
  /** Epoch em milissegundos. */
  venceEm: number;
}

export type MotivoConvite = "torto" | "versao" | "vencido";
export type ResultadoConvite =
  { ok: true; convite: Convite } | { ok: false; motivo: MotivoConvite; mensagem: string };

/** Tamanho típico ~350; o teto barra colagem errada antes de decodificar. */
const TAMANHO_MAXIMO = 2000;
const FORMA = /^sabre:\/\/convite\/(\d+)\.([A-Za-z0-9_-]+)$/;

const recusa = (motivo: MotivoConvite, mensagem: string): ResultadoConvite => ({
  ok: false,
  motivo,
  mensagem,
});
const TORTO = recusa(
  "torto",
  "Esse convite não está certo. Copie o texto inteiro, começando em sabre://convite/, e cole de novo.",
);

/**
 * Lê o texto `sabre://convite/1.<base64url de um JSON>` (formato do cartório, `emitirConvite`). PURA: confere forma,
 * campos e prazo antes de qualquer outra coisa. As mensagens são fixas — nunca repetem o texto, o código nem as chaves.
 */
export function lerConvite(texto: string, agora: number): ResultadoConvite {
  const limpo = texto.trim();
  if (limpo.length > TAMANHO_MAXIMO) return TORTO;
  const forma = FORMA.exec(limpo);
  if (!forma?.[2]) return TORTO;
  if (forma[1] !== "1")
    return recusa(
      "versao",
      "Esse convite é de uma versão mais nova. Atualize o SabreHosting e tente de novo.",
    );
  let d: Record<string, unknown>;
  try {
    const lido: unknown = JSON.parse(Buffer.from(forma[2], "base64url").toString("utf8"));
    if (typeof lido !== "object" || lido === null || Array.isArray(lido)) return TORTO;
    d = lido as Record<string, unknown>;
  } catch {
    return TORTO;
  }
  const ip = typeof d.i === "string" ? /^10\.66\.0\.(0|[1-9]\d{0,2})$/.exec(d.i) : null;
  const ultimo = Number(ip?.[1]);
  const hub = typeof d.h === "string" ? /^[A-Za-z0-9.-]+:([1-9]\d{0,4})$/.exec(d.h) : null;
  const codigoOk = typeof d.c === "string" && /^[A-Za-z0-9_-]{1,128}$/.test(d.c);
  const grupoOk = typeof d.g === "string" && /^[^\p{Cc}]{1,64}$/u.test(d.g.trim());
  if (
    !grupoOk ||
    !hub ||
    Number(hub[1]) > 65535 ||
    !chaveValida(d.k) ||
    !ip ||
    ultimo < 200 ||
    ultimo > 254 ||
    !chaveValida(d.p) ||
    !codigoOk ||
    !Number.isInteger(d.a) ||
    (d.a as number) < 1 ||
    (d.a as number) > 65535 ||
    !Number.isInteger(d.e)
  )
    return TORTO;
  const venceEm = (d.e as number) * 1000;
  if (venceEm <= agora)
    return recusa(
      "vencido",
      "Esse convite venceu. Peça um convite novo para quem administra o grupo.",
    );
  return {
    ok: true,
    convite: {
      grupo: (d.g as string).trim(),
      hub: d.h as string,
      chavePublicaHub: d.k as string,
      ipProvisorio: d.i as string,
      chavePrivadaProvisoria: d.p as string,
      codigo: d.c as string,
      portaCartorio: d.a as number,
      venceEm,
    },
  };
}
