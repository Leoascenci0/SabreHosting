import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { Readable } from "node:stream";
import { pipeline } from "node:stream/promises";

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
}

export class ErroDownload extends Error {
  constructor(mensagem: string, opcoes?: ErrorOptions) {
    super(mensagem, opcoes);
    this.name = "ErroDownload";
  }
}

/** Erro de rede que vale tentar de novo, mantendo o parcial. */
class ErroDeConexao extends ErroDownload {}

async function hashDoArquivo(caminho: string, algoritmo: string): Promise<string> {
  const hash = createHash(algoritmo);
  await pipeline(createReadStream(caminho), hash);
  return hash.digest("hex");
}

const tamanhoOuZero = (caminho: string) =>
  stat(caminho).then(
    (s) => s.size,
    () => 0,
  );

function validar({ url, hashEsperado }: OpcoesDownload): string {
  const { algoritmo, valor } = hashEsperado;
  const tamanho = TAMANHO_HEX[algoritmo] as number | undefined;
  if (!tamanho || !new RegExp(`^[0-9a-f]{${tamanho}}$`, "i").test(valor)) {
    throw new ErroDownload(`O hash informado para o download é inválido (${algoritmo}).`);
  }
  const { protocol, hostname } = new URL(url);
  const local = hostname === "localhost" || hostname === "127.0.0.1";
  if (protocol !== "https:" && !(protocol === "http:" && local)) {
    throw new ErroDownload("O download precisa usar https; recusei por segurança.");
  }
  return valor.toLowerCase();
}

/** Uma passada: baixa (ou continua) o `.parcial`. Devolve quando o corpo terminou. */
async function baixarParcial(url: string, parcial: string): Promise<void> {
  const meta = `${parcial}.meta`;
  let validador = await readFile(meta, "utf8").catch(() => "");
  let inicio = validador ? await tamanhoOuZero(parcial) : 0;
  const cabecalhos: Record<string, string> = {};
  if (inicio > 0) {
    cabecalhos.range = `bytes=${inicio}-`;
    cabecalhos["if-range"] = validador;
  }

  let resposta: Response;
  try {
    resposta = await fetch(url, { headers: cabecalhos });
  } catch (e) {
    throw new ErroDeConexao("Sem conexão com o servidor de download.", { cause: e });
  }

  // 200 no lugar de 206 (ou 416): o servidor não retoma; recomeça do zero.
  if (inicio > 0 && resposta.status === 416) {
    await resposta.body?.cancel();
    await rm(parcial, { force: true });
    return baixarParcial(url, parcial);
  }
  if (resposta.status !== 200 && resposta.status !== 206) {
    await resposta.body?.cancel();
    throw new ErroDownload(`O servidor de download respondeu ${resposta.status}.`);
  }
  if (resposta.status === 200) inicio = 0;
  else if (!new RegExp(`^bytes ${inicio}-`).test(resposta.headers.get("content-range") ?? "")) {
    await resposta.body?.cancel();
    await rm(parcial, { force: true });
    throw new ErroDownload(
      "O servidor devolveu um trecho fora do lugar; vou recomeçar o download.",
    );
  }

  validador = resposta.headers.get("etag") ?? resposta.headers.get("last-modified") ?? "";
  if (inicio === 0) await rm(meta, { force: true });
  if (validador && inicio === 0) await writeFile(meta, validador);
  if (!resposta.body) throw new ErroDeConexao("O servidor não enviou o arquivo.");
  try {
    await pipeline(
      Readable.fromWeb(resposta.body as never),
      createWriteStream(parcial, { flags: inicio === 0 ? "w" : "a" }),
    );
  } catch (e) {
    throw new ErroDeConexao("A conexão caiu no meio do download.", { cause: e });
  }
}

/**
 * Baixa `url` para `destino` só depois de conferir o hash. O arquivo final nunca existe
 * sem ter sido conferido: baixa para `<destino>.parcial` e só então faz `rename` (atômico).
 */
export async function baixarConferido(
  opcoes: OpcoesDownload,
): Promise<{ caminho: string; doCache: boolean }> {
  const { url, hashEsperado, destino, tentativas = 3 } = opcoes;
  const esperado = validar(opcoes);
  const parcial = `${destino}.parcial`;

  if (
    (await tamanhoOuZero(destino)) > 0 &&
    (await hashDoArquivo(destino, hashEsperado.algoritmo)) === esperado
  ) {
    return { caminho: destino, doCache: true };
  }

  for (let n = 1; ; n++) {
    try {
      await baixarParcial(url, parcial);
      break;
    } catch (e) {
      if (!(e instanceof ErroDeConexao) || n >= tentativas) throw e;
    }
  }

  const obtido = await hashDoArquivo(parcial, hashEsperado.algoritmo);
  if (obtido !== esperado) {
    await rm(parcial, { force: true });
    await rm(`${parcial}.meta`, { force: true });
    throw new ErroDownload(
      "O arquivo baixado não confere com o hash esperado e foi descartado. Tente de novo; se repetir, avise o grupo.",
    );
  }
  await rename(parcial, destino);
  await rm(`${parcial}.meta`, { force: true });
  return { caminho: destino, doCache: false };
}
