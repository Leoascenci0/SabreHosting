import { createWriteStream } from "node:fs";
import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { hashDoArquivo } from "../integridade/hash.js";

const TAMANHO_HEX = { sha1: 40, sha256: 64, sha512: 128 } as const;

export interface HashEsperado {
  algoritmo: keyof typeof TAMANHO_HEX;
  valor: string;
}

export interface OpcoesDownload {
  url: string;
  hashEsperado: HashEsperado;
  destino: string;
  /** Quantas vezes tenta (retomando) se a conexão cair. Padrão: 3. */
  tentativas?: number;
  /** Teto do arquivo em bytes. Padrão: 1 GiB. */
  tamanhoMaximo?: number;
  /** Milissegundos sem receber nada antes de desistir da conexão. Padrão: 30 s. */
  tempoSemDados?: number;
  /** Milissegundos no máximo para uma passada inteira. Padrão: 30 min. */
  tempoTotal?: number;
  /** Só para teste: libera http em localhost/127.0.0.1. Nunca ligado pelo app. Padrão: falso. */
  permitirHttpLocal?: boolean;
  /** Libera http só em IP da rede privada 10.66.0.x (WireGuard já cifra o caminho). Padrão: falso. */
  permitirHttpPrivado?: boolean;
  /** Cabeçalhos extras (ex.: Authorization). Vão só ao endereço pedido, nunca a um redirecionamento. */
  cabecalhos?: Record<string, string>;
  /** Limite de velocidade em bytes por segundo (inteiro ≥ 1). Só atrasa o fluxo; o hash continua conferido. Padrão: sem limite. */
  limiteBytesPorSeg?: number;
}

export class ErroDownload extends Error {
  constructor(mensagem: string, opcoes?: ErrorOptions) {
    super(mensagem, opcoes);
    this.name = "ErroDownload";
  }
}

/** Erro de rede que vale tentar de novo, mantendo o parcial. */
class ErroDeConexao extends ErroDownload {}

const existe = (caminho: string) =>
  stat(caminho).then(
    () => true,
    () => false,
  );

const tamanhoOuZero = (caminho: string) =>
  stat(caminho).then(
    (s) => s.size,
    () => 0,
  );

const IP_PRIVADO = /^10\.66\.0\.(?:\d{1,3})$/;
const ehIpPrivado = (h: string) =>
  IP_PRIVADO.test(h) && h.split(".").every((n) => Number(n) <= 255);

function validar({
  url,
  hashEsperado,
  permitirHttpLocal = false,
  permitirHttpPrivado = false,
  limiteBytesPorSeg,
}: OpcoesDownload): string {
  if (
    limiteBytesPorSeg !== undefined &&
    (!Number.isInteger(limiteBytesPorSeg) || limiteBytesPorSeg < 1)
  ) {
    throw new ErroDownload(
      "O limite de velocidade do download precisa ser um número inteiro maior que zero.",
    );
  }
  const { algoritmo, valor } = hashEsperado;
  const tamanho = TAMANHO_HEX[algoritmo] as number | undefined;
  if (!tamanho || !new RegExp(`^[0-9a-f]{${tamanho}}$`, "i").test(valor)) {
    throw new ErroDownload(`O hash informado para o download é inválido (${algoritmo}).`);
  }
  const { protocol, hostname } = new URL(url);
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  const liberado =
    protocol === "http:" &&
    ((permitirHttpLocal && local) || (permitirHttpPrivado && ehIpPrivado(hostname)));
  if (protocol !== "https:" && !liberado) {
    throw new ErroDownload("O download precisa usar https; recusei por segurança.");
  }
  return valor.toLowerCase();
}

interface Limites {
  tamanhoMaximo: number;
  tempoSemDados: number;
  tempoTotal: number;
  cabecalhos: Record<string, string>;
  limiteBytesPorSeg: number | undefined;
}

const MAX_SALTOS = 5;

async function descartar(parcial: string): Promise<void> {
  await rm(parcial, { force: true });
  await rm(`${parcial}.meta`, { force: true });
}

/** `fetch` seguindo redirecionamento à mão: cada salto precisa ser https. */
async function buscar(url: string, cabecalhos: Record<string, string>, sinal: AbortSignal) {
  for (let salto = 0; ; salto++) {
    const resposta = await fetch(url, { headers: cabecalhos, signal: sinal, redirect: "manual" });
    const destino = resposta.headers.get("location");
    if (resposta.status < 300 || resposta.status >= 400 || !destino) return resposta;
    await resposta.body?.cancel();
    const proximo = new URL(destino, url);
    if (salto >= MAX_SALTOS || proximo.protocol !== "https:") {
      throw new ErroDownload(
        "O servidor redirecionou o download para um endereço não seguro; recusei.",
      );
    }
    url = proximo.href;
    cabecalhos = Object.fromEntries(
      Object.entries(cabecalhos).filter(([k]) => ["range", "if-range"].includes(k)),
    ); // token não acompanha redirecionamento
  }
}

/**
 * Uma passada: baixa (ou continua) o `.parcial`. Devolve quando o corpo terminou;
 * `true` se o parcial já estava completo (416 com content-range de tamanho igual ao do parcial) e nada foi baixado.
 */
async function baixarParcial(url: string, parcial: string, limites: Limites): Promise<boolean> {
  const meta = `${parcial}.meta`;
  let validador = await readFile(meta, "utf8").catch(() => "");
  let inicio = validador ? await tamanhoOuZero(parcial) : 0;
  const cabecalhos: Record<string, string> = { ...limites.cabecalhos };
  if (inicio > 0) {
    cabecalhos.range = `bytes=${inicio}-`;
    cabecalhos["if-range"] = validador;
  }

  const controle = new AbortController();
  const totalTimer = setTimeout(
    () => controle.abort(new ErroDownload("O download demorou demais e foi cancelado.")),
    limites.tempoTotal,
  );
  let paradoTimer: NodeJS.Timeout | undefined;
  const vigiar = () => {
    clearTimeout(paradoTimer);
    paradoTimer = setTimeout(
      () => controle.abort(new ErroDeConexao("O servidor parou de enviar dados.")),
      limites.tempoSemDados,
    );
  };
  vigiar();
  try {
    let resposta: Response;
    try {
      resposta = await buscar(url, cabecalhos, controle.signal);
    } catch (e) {
      if (e instanceof ErroDownload) throw e;
      throw (
        motivoDoAborto(controle.signal) ??
        new ErroDeConexao("Sem conexão com o servidor de download.", { cause: e })
      );
    }

    // 416: se o servidor diz que o arquivo tem o tamanho do parcial, ele já está completo: só confere o hash.
    // Qualquer outro 416 não aceita retomar: recomeça do zero (agora sem Range).
    if (inicio > 0 && resposta.status === 416) {
      await resposta.body?.cancel();
      if (resposta.headers.get("content-range") === `bytes */${inicio}`) return true;
      await descartar(parcial);
      return await baixarParcial(url, parcial, limites);
    }
    if (resposta.status !== 200 && resposta.status !== 206) {
      await resposta.body?.cancel();
      throw new ErroDownload(`O servidor de download respondeu ${resposta.status}.`);
    }
    if (resposta.status === 200) inicio = 0;
    else if (!new RegExp(`^bytes ${inicio}-`).test(resposta.headers.get("content-range") ?? "")) {
      await resposta.body?.cancel();
      if (inicio === 0)
        throw new ErroDownload("O servidor devolveu um trecho fora do lugar; recusei o download.");
      await descartar(parcial);
      return await baixarParcial(url, parcial, limites); // uma vez só: agora sem Range
    }
    if (inicio + Number(resposta.headers.get("content-length") ?? 0) > limites.tamanhoMaximo) {
      await resposta.body?.cancel();
      await descartar(parcial);
      throw new ErroDownload("O arquivo é maior que o limite permitido; recusei o download.");
    }

    validador = resposta.headers.get("etag") ?? resposta.headers.get("last-modified") ?? "";
    if (inicio === 0) await rm(meta, { force: true });
    if (validador && inicio === 0) await writeFile(meta, validador);
    if (!resposta.body) throw new ErroDeConexao("O servidor não enviou o arquivo.");
    let recebido = inicio;
    // Freio: o trecho só segue quando o total desta passada cabe na banda (bytes ÷ limite = instante mais cedo).
    const comeco = Date.now();
    let passou = 0;
    let freio: NodeJS.Timeout | undefined;
    const contar = new Transform({
      destroy(erro, fim) {
        clearTimeout(freio); // abortou com o freio esperando: nenhum timer fica vivo
        fim(erro);
      },
      transform(trecho: Buffer, _enc, ok) {
        vigiar();
        recebido += trecho.length;
        if (recebido > limites.tamanhoMaximo) {
          return ok(new ErroDownload("O arquivo passou do limite permitido; cancelei o download."));
        }
        passou += trecho.length;
        const espera = limites.limiteBytesPorSeg
          ? comeco + (passou / limites.limiteBytesPorSeg) * 1000 - Date.now()
          : 0;
        if (espera > 0) freio = setTimeout(() => ok(null, trecho), espera);
        else ok(null, trecho);
      },
    });
    try {
      await pipeline(
        Readable.fromWeb(resposta.body as never),
        contar,
        createWriteStream(parcial, { flags: inicio === 0 ? "w" : "a" }),
        { signal: controle.signal },
      );
    } catch (e) {
      const motivo = motivoDoAborto(controle.signal);
      if (motivo instanceof ErroDownload && !(motivo instanceof ErroDeConexao)) throw motivo;
      if (e instanceof ErroDownload) {
        await descartar(parcial);
        throw e;
      }
      throw motivo ?? new ErroDeConexao("A conexão caiu no meio do download.", { cause: e });
    }
    return false;
  } finally {
    clearTimeout(totalTimer);
    clearTimeout(paradoTimer);
  }
}

const motivoDoAborto = (sinal: AbortSignal): ErroDownload | undefined =>
  sinal.reason instanceof ErroDownload ? sinal.reason : undefined;

/**
 * Baixa `url` para `destino` só depois de conferir o hash. O arquivo final nunca existe
 * sem ter sido conferido: baixa para `<destino>.parcial` e só então faz `rename` (atômico).
 */
export async function baixarConferido(
  opcoes: OpcoesDownload,
): Promise<{ caminho: string; doCache: boolean }> {
  const { url, hashEsperado, destino, tentativas = 3 } = opcoes;
  const limites: Limites = {
    tamanhoMaximo: opcoes.tamanhoMaximo ?? 1024 ** 3,
    tempoSemDados: opcoes.tempoSemDados ?? 30_000,
    tempoTotal: opcoes.tempoTotal ?? 30 * 60_000,
    cabecalhos: opcoes.cabecalhos ?? {},
    limiteBytesPorSeg: opcoes.limiteBytesPorSeg,
  };
  const esperado = validar(opcoes);
  const parcial = `${destino}.parcial`;

  if (await existe(destino)) {
    if ((await hashDoArquivo(destino, hashEsperado.algoritmo)) === esperado) {
      return { caminho: destino, doCache: true };
    }
    await rm(destino, { force: true }); // final que não confere nunca fica no lugar
  }

  const passar = async (): Promise<boolean> => {
    for (let n = 1; ; n++) {
      try {
        return await baixarParcial(url, parcial, limites);
      } catch (e) {
        if (!(e instanceof ErroDeConexao) || n >= tentativas) throw e;
      }
    }
  };
  const reaproveitado = await passar();
  let obtido = await hashDoArquivo(parcial, hashEsperado.algoritmo);
  if (obtido !== esperado && reaproveitado) {
    // Parcial "completo" estava errado: descarta e baixa de novo, uma vez (o hash ainda decide).
    await descartar(parcial);
    await passar();
    obtido = await hashDoArquivo(parcial, hashEsperado.algoritmo);
  }
  if (obtido !== esperado) {
    await descartar(parcial);
    throw new ErroDownload(
      "O arquivo baixado não confere com o hash esperado e foi descartado. Tente de novo; se repetir, avise o grupo.",
    );
  }
  await rename(parcial, destino);
  await rm(`${parcial}.meta`, { force: true });
  return { caminho: destino, doCache: false };
}
