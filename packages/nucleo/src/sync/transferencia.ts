import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { isIPv4, type AddressInfo } from "node:net";
import { baixarConferido, type OpcoesDownload } from "../servidor/baixar.js";

/**
 * Transferência de arquivos entre PCs pela rede privada (WireGuard, 10.66.0.0/24).
 * O servidor só entrega arquivos de pacote já fechado, achados pelo hash (nunca por caminho do cliente);
 * o cliente reaproveita `baixarConferido` (retomada, conferência de hash, troca atômica).
 */

/** .1 é o cartório e .200+ é reservado: PCs ficam em 10.66.0.2–199 (mesma faixa de `gerarPropriedades`). */
const REDE_PRIVADA = /^10\.66\.0\.(?:[2-9]|[1-9]\d|1\d\d)$/;
/** Porta em que cada PC serve o mundo na rede privada: constante do app, não entra no cadastro. */
export const PORTA_ESPALHAR = 25570;
const HASH_SHA256 = /^[0-9a-f]{64}$/;

/** Só o IP da rede privada do SabreHosting; loopback apenas quando o teste pede. */
export function conferirEnderecoPrivado(
  endereco: string,
  permitirLoopbackParaTeste = false,
): string {
  const ok =
    isIPv4(endereco) &&
    (REDE_PRIVADA.test(endereco) || (permitirLoopbackParaTeste && endereco === "127.0.0.1"));
  if (!ok) {
    throw new Error(
      `Endereço "${endereco}" recusado: a transferência só usa o IP deste PC na rede privada (10.66.0.2 a 10.66.0.199).`,
    );
  }
  return endereco;
}

export interface OpcoesServidor {
  /** IP deste PC na rede privada. */
  endereco: string;
  porta: number;
  /** Devolve o PC dono do token, ou null se inválido/revogado (em produção: `GET /eu` do cartório). */
  conferirToken: (token: string) => Promise<string | null>;
  /** Acha o arquivo de um pacote FECHADO pelo hash; nunca recebe caminho do cliente. */
  arquivos: (sha256: string) => { caminho: string } | undefined;
  /** Só para teste: aceita 127.0.0.1. Nunca ligado pelo app. */
  permitirLoopbackParaTeste?: boolean;
  /** Relógio em ms; só o teste troca. */
  agora?: () => number;
  /** Tempo ocioso do socket em ms (padrão 60 s, maior que os 30 s sem dados do cliente); só o teste troca. */
  tempoOciosoMs?: number;
  /** Prazo para o cabeçalho HTTP chegar inteiro (padrão 10 s); só o teste troca. */
  tempoCabecalhoMs?: number;
  /** Prazo para a requisição chegar inteira, corpo incluso (padrão 10 s); só o teste troca. */
  tempoRequisicaoMs?: number;
  /** De quanto em quanto o Node confere esses prazos (padrão dele: 30 s); só o teste troca. */
  intervaloConferenciaMs?: number;
}

/** Cabeçalho lento, conexão parada e excesso de conexões não seguram o PC que hospeda. */
const TEMPO_CABECALHO_MS = 10_000;
const TEMPO_OCIOSO_MS = 60_000;
const MAX_CONEXOES = 16;

/** Tentativas erradas (token ausente ou inválido) por IP: 5 em 60 s, contadas do 1º erro. */
const MAX_FALHAS = 5;
const JANELA_FALHAS_MS = 60_000;
/** Token já conferido vale 30 s: revogar no cartório leva até isso para valer aqui. */
const VALIDADE_TOKEN_MS = 30_000;

export interface Servidor {
  porta: number;
  fechar: () => Promise<void>;
}

const bearer = (req: IncomingMessage): string | undefined => {
  const [tipo, valor] = (req.headers.authorization ?? "").split(" ");
  return tipo === "Bearer" && valor ? valor : undefined;
};

const texto = (
  resp: ServerResponse,
  codigo: number,
  msg: string,
  extra: Record<string, string> = {},
) =>
  void resp.writeHead(codigo, { "content-type": "text/plain; charset=utf-8", ...extra }).end(msg);

export async function servirArquivos(opcoes: OpcoesServidor): Promise<Servidor> {
  const endereco = conferirEnderecoPrivado(opcoes.endereco, opcoes.permitirLoopbackParaTeste);

  const agora = opcoes.agora ?? Date.now;
  const falhas = new Map<string, { n: number; inicio: number }>();
  const conferidos = new Map<string, { pc: string; ate: number }>();
  // De propósito, pedido com sucesso NÃO zera as falhas do IP: quem erra e acerta alternando continua limitado.
  // Limitação conhecida: uma rajada paralela passa por barrado() antes de contarFalha(); risco baixo na rede WireGuard.
  const barrado = (ip: string) => {
    const f = falhas.get(ip);
    return f !== undefined && f.n >= MAX_FALHAS && agora() - f.inicio < JANELA_FALHAS_MS;
  };
  const contarFalha = (ip: string) => {
    const t = agora();
    for (const [chave, f] of falhas) if (t - f.inicio >= JANELA_FALHAS_MS) falhas.delete(chave);
    const f = falhas.get(ip);
    if (f) f.n++;
    else falhas.set(ip, { n: 1, inicio: t });
  };
  const guardar = (token: string, pc: string) => {
    const t = agora();
    for (const [chave, c] of conferidos) if (c.ate <= t) conferidos.delete(chave);
    conferidos.set(token, { pc, ate: t + VALIDADE_TOKEN_MS });
  };

  async function atender(req: IncomingMessage, resp: ServerResponse) {
    // IP da conexão (cada PC tem o seu no WireGuard); sem X-Forwarded-For, que o cliente poderia forjar.
    const ip = req.socket.remoteAddress ?? "";
    // Barrado antes de ler o token e de falar com o cartório: token errado não vira amplificação.
    if (barrado(ip)) {
      return texto(resp, 429, "Muitas tentativas erradas. Espere 1 minuto e tente de novo.", {
        "retry-after": "60",
      });
    }
    // 1º autentica (nada de revelar se o arquivo existe); servidor sem segredo: quem decide é o cartório.
    const token = bearer(req);
    if (!token) {
      contarFalha(ip);
      return texto(resp, 401, "Token ausente.");
    }
    const guardado = conferidos.get(token);
    if (!guardado || guardado.ate <= agora()) {
      let pc: string | null;
      try {
        pc = await opcoes.conferirToken(token);
      } catch {
        return texto(resp, 503, "Não consegui conferir o token agora; tente de novo.");
      }
      if (!pc) {
        contarFalha(ip);
        return texto(resp, 401, "Token inválido ou revogado.");
      }
      guardar(token, pc);
    }

    const caminhoUrl = (req.url ?? "").split("?")[0] ?? "";
    const hash = /^\/arquivos\/([^/]+)$/.exec(caminhoUrl)?.[1];
    if (req.method !== "GET" || !hash || !HASH_SHA256.test(hash)) {
      return texto(resp, 404, "Arquivo não encontrado.");
    }
    const achado = opcoes.arquivos(hash);
    const tamanho = await stat(achado?.caminho ?? "").then(
      (s) => (s.isFile() ? s.size : -1),
      () => -1,
    );
    if (!achado || tamanho < 0) return texto(resp, 404, "Arquivo não encontrado.");

    const etag = `"${hash}"`;
    const base = { "content-type": "application/octet-stream", etag, "accept-ranges": "bytes" };
    let inicio = 0;
    let fim = tamanho - 1;
    let parcial = false;
    const faixa = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range ?? "");
    const ifRange = req.headers["if-range"];
    if (faixa && (ifRange === undefined || ifRange === etag)) {
      inicio = Number(faixa[1]);
      if (inicio >= tamanho) {
        return texto(resp, 416, "Faixa fora do arquivo.", {
          "content-range": `bytes */${tamanho}`,
        });
      }
      if (faixa[2]) fim = Math.min(Number(faixa[2]), tamanho - 1);
      if (fim < inicio)
        return texto(resp, 416, "Faixa inválida.", { "content-range": `bytes */${tamanho}` });
      parcial = true;
    }
    resp.writeHead(parcial ? 206 : 200, {
      ...base,
      "content-length": fim - inicio + 1,
      ...(parcial ? { "content-range": `bytes ${inicio}-${fim}/${tamanho}` } : {}),
    });
    if (tamanho === 0) return void resp.end();
    const fluxo = createReadStream(achado.caminho, { start: inicio, end: fim });
    fluxo.on("error", () => resp.destroy());
    resp.on("close", () => fluxo.destroy());
    fluxo.pipe(resp);
  }

  const servidor = createServer((req, resp) => {
    atender(req, resp).catch(() =>
      resp.headersSent ? resp.destroy() : texto(resp, 500, "Erro interno."),
    );
  });
  servidor.headersTimeout = opcoes.tempoCabecalhoMs ?? TEMPO_CABECALHO_MS;
  servidor.requestTimeout = opcoes.tempoRequisicaoMs ?? TEMPO_CABECALHO_MS;
  if (opcoes.intervaloConferenciaMs !== undefined) {
    // Existe no Node 18+, mas falta nos tipos instalados.
    (servidor as { connectionsCheckingInterval?: number }).connectionsCheckingInterval =
      opcoes.intervaloConferenciaMs;
  }
  servidor.keepAliveTimeout = 5_000;
  servidor.timeout = opcoes.tempoOciosoMs ?? TEMPO_OCIOSO_MS;
  servidor.maxConnections = MAX_CONEXOES;
  await new Promise<void>((ok, erro) => {
    servidor.once("error", erro);
    servidor.listen(opcoes.porta, endereco, ok);
  });
  return {
    porta: (servidor.address() as AddressInfo).port,
    fechar: () =>
      new Promise<void>((ok) => {
        servidor.close(() => ok());
        servidor.closeAllConnections();
      }),
  };
}

export interface OpcoesPedido extends Pick<
  OpcoesDownload,
  "destino" | "tentativas" | "tamanhoMaximo" | "tempoSemDados" | "tempoTotal"
> {
  /** IP do PC que hospeda, na rede privada. */
  endereco: string;
  porta: number;
  sha256: string;
  /** Token deste PC (nunca vai para log nem para redirecionamento). */
  token: string;
  /** Só para teste: aceita 127.0.0.1. */
  permitirLoopbackParaTeste?: boolean;
}

/** Pede um arquivo por hash a outro PC: retoma de onde parou, confere o hash e só então move ao destino. */
export async function pedirArquivo({
  endereco,
  porta,
  sha256,
  token,
  permitirLoopbackParaTeste,
  ...resto
}: OpcoesPedido) {
  conferirEnderecoPrivado(endereco, permitirLoopbackParaTeste);
  return baixarConferido({
    ...resto,
    url: `http://${endereco}:${porta}/arquivos/${sha256}`,
    hashEsperado: { algoritmo: "sha256", valor: sha256 },
    cabecalhos: { authorization: `Bearer ${token}` },
    permitirHttpPrivado: true,
    permitirHttpLocal: permitirLoopbackParaTeste === true,
  });
}
