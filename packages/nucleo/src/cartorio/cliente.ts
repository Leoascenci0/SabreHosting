import { BlockList, isIP } from "node:net";
import type { Cofre } from "./cofre.js";
import type { EstadoTrava, Pc, RespostaTrava } from "./tipos.js";

export type TipoErroCartorio = "rede" | "servidor" | "acesso" | "resposta";

/** Nunca leva o token: nem na mensagem, nem na causa. */
export class ErroCartorio extends Error {
  constructor(
    mensagem: string,
    readonly tipo: TipoErroCartorio,
    opcoes?: ErrorOptions,
  ) {
    super(mensagem, opcoes);
    this.name = "ErroCartorio";
  }
}

export interface OpcoesCliente {
  /** Endereço do cartório: https, ou http só para IP da rede privada (WireGuard) ou do próprio PC. */
  url: string;
  cofre: Cofre;
  /** Tempo-limite de cada tentativa. Padrão: 5 s (3 tentativas cabem nos 20 s da renovação). */
  prazoMs?: number;
  /** Tentativas das chamadas que podem repetir. Padrão: 3. */
  tentativas?: number;
  /** Espera antes da 2ª tentativa; dobra a cada uma. Padrão: 500 ms. */
  esperaBaseMs?: number;
  // Só para os testes:
  fetchFn?: typeof fetch;
  esperar?: (ms: number) => Promise<void>;
  /** Número em [0, 1) para o jitter. Padrão: `Math.random`. */
  sortear?: () => number;
}

/** Faixas onde `http` é aceito: o túnel WireGuard já cifra; fora dele, só `https`. */
const REDE_PRIVADA = new BlockList();
REDE_PRIVADA.addSubnet("10.0.0.0", 8);
REDE_PRIVADA.addSubnet("172.16.0.0", 12);
REDE_PRIVADA.addSubnet("192.168.0.0", 16);
REDE_PRIVADA.addSubnet("127.0.0.0", 8);
REDE_PRIVADA.addSubnet("fc00::", 7, "ipv6");
REDE_PRIVADA.addAddress("::1", "ipv6");

function conferirUrl(url: string): string {
  const { protocol, hostname } = new URL(url);
  const ip = hostname.replace(/^\[|\]$/g, "");
  const versao = isIP(ip);
  const privado = versao !== 0 && REDE_PRIVADA.check(ip, versao === 4 ? "ipv4" : "ipv6");
  if (protocol !== "https:" && !(protocol === "http:" && privado)) {
    throw new ErroCartorio(
      "O endereço do cartório precisa usar https (ou o IP da rede privada do grupo); recusei por segurança.",
      "acesso",
    );
  }
  return url.replace(/\/+$/, "");
}

interface Pedido {
  metodo: "GET" | "POST";
  rota: string;
  corpo?: object;
  /** Só GETs e `/trava/renovar`: `pegar`/`passar`/`soltar` mudam a época e não podem ir duas vezes. */
  repetir: boolean;
  /** Rotas da trava devolvem a recusa (409) como resposta, não como erro. */
  recusaE409?: boolean;
}

export type ClienteCartorio = ReturnType<typeof criarCliente>;

export function criarCliente(opcoes: OpcoesCliente) {
  const base = conferirUrl(opcoes.url);
  const {
    cofre,
    prazoMs = 5_000,
    tentativas = 3,
    esperaBaseMs = 500,
    fetchFn = fetch,
    sortear = Math.random,
  } = opcoes;
  const esperar = opcoes.esperar ?? ((ms: number) => new Promise<void>((ok) => setTimeout(ok, ms)));

  /** Uma tentativa. Erro com `tipo` "rede" ou "servidor" é o único que pode repetir. */
  async function uma<T>(p: Pedido, token: string): Promise<T> {
    let resposta: Response;
    try {
      resposta = await fetchFn(`${base}${p.rota}`, {
        method: p.metodo,
        headers: {
          authorization: `Bearer ${token}`,
          ...(p.corpo ? { "content-type": "application/json" } : {}),
        },
        body: p.corpo ? JSON.stringify(p.corpo) : undefined,
        redirect: "error",
        signal: AbortSignal.timeout(prazoMs),
      });
    } catch (e) {
      throw new ErroCartorio("Sem resposta do cartório (rede ou tempo esgotado).", "rede", {
        cause: e,
      });
    }
    if (resposta.status >= 500) {
      await resposta.body?.cancel();
      throw new ErroCartorio(`O cartório respondeu ${resposta.status}.`, "servidor");
    }
    if (resposta.status === 401) {
      await resposta.body?.cancel();
      throw new ErroCartorio(
        "O cartório recusou o acesso deste PC. Peça um convite novo ao administrador do grupo.",
        "acesso",
      );
    }
    if (!resposta.ok && !(p.recusaE409 && resposta.status === 409)) {
      await resposta.body?.cancel();
      throw new ErroCartorio(`O cartório recusou o pedido (${resposta.status}).`, "resposta");
    }
    try {
      return (await resposta.json()) as T;
    } catch (e) {
      throw new ErroCartorio("O cartório devolveu uma resposta ilegível.", "resposta", {
        cause: e,
      });
    }
  }

  async function chamar<T>(p: Pedido): Promise<T> {
    const token = await cofre.ler();
    if (!token) {
      throw new ErroCartorio(
        "Este PC ainda não entrou no grupo: use o convite do administrador.",
        "acesso",
      );
    }
    for (let n = 1; ; n++) {
      try {
        return await uma<T>(p, token);
      } catch (e) {
        const temporario =
          e instanceof ErroCartorio && (e.tipo === "rede" || e.tipo === "servidor");
        if (!p.repetir || !temporario || n >= tentativas) throw e;
        // Espera crescente com jitter: metade fixa, metade sorteada (PCs que voltam juntos não batem juntos).
        const teto = esperaBaseMs * 2 ** (n - 1);
        await esperar(Math.round(teto * (0.5 + 0.5 * sortear())));
      }
    }
  }

  const trava = (rota: string, repetir: boolean, corpo?: object) =>
    chamar<RespostaTrava>({ metodo: "POST", rota, corpo, repetir, recusaE409: true });

  return {
    eu: () => chamar<Pc>({ metodo: "GET", rota: "/eu", repetir: true }),
    estadoTrava: () => chamar<EstadoTrava>({ metodo: "GET", rota: "/trava", repetir: true }),
    pegar: () => trava("/trava/pegar", false),
    renovar: (epoca: number) => trava("/trava/renovar", true, { epoca }),
    passar: (epoca: number, para: number) => trava("/trava/passar", false, { epoca, para }),
    soltar: (epoca: number) => trava("/trava/soltar", false, { epoca }),
  };
}
