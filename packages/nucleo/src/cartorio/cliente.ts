import { BlockList, isIP } from "node:net";
import { IP_DO_HUB } from "../rede/wireguard.js";
import type { Cofre } from "./cofre.js";
import {
  type RespostaAtualizacao,
  type RespostaTrava,
  cortarErro,
  validarConviteCriado,
  validarEntradaNoGrupo,
  validarEstadoTrava,
  validarGrupo,
  validarEu,
  validarListaPcs,
  validarRespostaAtualizacao,
  validarRespostaTrava,
} from "./tipos.js";

/** "cancelado": quem pediu desistiu (trava solta ou perdida); nunca repete. */
export type TipoErroCartorio = "rede" | "servidor" | "acesso" | "resposta" | "cancelado";

/** Nunca leva o token: nem na mensagem, nem na causa. */
export class ErroCartorio extends Error {
  /** Código HTTP da recusa (só nas do tipo "resposta"); a tela escolhe a mensagem por ele. */
  readonly status: number | undefined;
  constructor(
    mensagem: string,
    readonly tipo: TipoErroCartorio,
    opcoes?: ErrorOptions & { status?: number },
  ) {
    super(mensagem, opcoes);
    this.status = opcoes?.status;
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

/** Onde `http` é aceito: o hub no túnel WireGuard (que já cifra) e o loopback; fora disso, só `https`. */
const REDE_PRIVADA = new BlockList();
REDE_PRIVADA.addAddress(IP_DO_HUB);
REDE_PRIVADA.addSubnet("127.0.0.0", 8);
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

interface Pedido<T> {
  metodo: "GET" | "POST";
  rota: string;
  corpo?: object;
  /** Só GETs e `/trava/renovar`: `pegar`/`passar`/`soltar` mudam a época e não podem ir duas vezes. */
  repetir: boolean;
  /** Rotas da trava devolvem a recusa (409) como resposta, não como erro. */
  recusaE409?: boolean;
  /** Prazo próprio da tentativa (o `usar` espera o ajudante do WireGuard na nuvem). */
  prazoMs?: number;
  /** Confere o corpo (vem da rede). Sem ela, a rota não devolve corpo (204). */
  validar?: (corpo: unknown, status: number) => T;
  /** Abortado: nenhuma tentativa nova e a em curso cai (o renovador cancela ao soltar ou perder a trava). */
  sinal?: AbortSignal;
}

/** Teto do corpo de qualquer resposta: as do cartório têm poucas centenas de bytes. */
const TETO_CORPO = 64 * 1024;
const GRANDE_DEMAIS = "O cartório devolveu uma resposta grande demais; recusei.";

const cancelado = () =>
  new ErroCartorio("Pedido ao cartório cancelado (a trava foi solta ou perdida).", "cancelado");

/** Lê o JSON contando bytes: passou do teto, cancela o resto (resposta da rede nunca enche a memória). */
async function lerJson(resposta: Response): Promise<unknown> {
  if (Number(resposta.headers.get("content-length") ?? 0) > TETO_CORPO) {
    await resposta.body?.cancel();
    throw new ErroCartorio(GRANDE_DEMAIS, "resposta");
  }
  const partes: Uint8Array[] = [];
  let total = 0;
  const leitor = resposta.body?.getReader();
  for (;;) {
    const trecho = await leitor?.read();
    if (!trecho || trecho.done) break;
    total += trecho.value.byteLength;
    if (total > TETO_CORPO) {
      await leitor?.cancel();
      throw new ErroCartorio(GRANDE_DEMAIS, "resposta");
    }
    partes.push(trecho.value);
  }
  return JSON.parse(Buffer.concat(partes).toString("utf8"));
}

const CONVITE_ANTIGO =
  "Este convite é de uma versão antiga do cartório; peça um convite novo ao dono do grupo.";
const PRAZO_USAR_MS = 15_000;
const CONVITE_RECUSADO =
  "O cartório recusou o convite: inválido, já usado ou vencido. Peça um novo ao dono do grupo.";

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
  /** Sem `token` (só o `usar` do convite), o pedido vai sem cabeçalho de autorização. */
  async function uma<T>(p: Pedido<T>, token: string | undefined): Promise<T> {
    let resposta: Response;
    try {
      resposta = await fetchFn(`${base}${p.rota}`, {
        method: p.metodo,
        headers: {
          ...(token ? { authorization: `Bearer ${token}` } : {}),
          ...(p.corpo ? { "content-type": "application/json" } : {}),
        },
        body: p.corpo ? JSON.stringify(p.corpo) : undefined,
        redirect: "error",
        signal: AbortSignal.any([
          AbortSignal.timeout(p.prazoMs ?? prazoMs),
          ...(p.sinal ? [p.sinal] : []),
        ]),
      });
    } catch (e) {
      if (p.sinal?.aborted) throw cancelado();
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
        token
          ? "O cartório recusou o acesso deste PC. Peça um convite novo ao administrador do grupo."
          : CONVITE_RECUSADO,
        "acesso",
      );
    }
    if (!resposta.ok && !(p.recusaE409 && resposta.status === 409)) {
      // A mensagem do cartório (pt-BR, para o amigo) vai junto: "Só o dono do grupo cria convites."
      const corpo = (await lerJson(resposta).catch(() => null)) as { erro?: unknown } | null;
      const erro = typeof corpo?.erro === "string" ? ` ${cortarErro(corpo.erro)}` : "";
      throw new ErroCartorio(
        `O cartório recusou o pedido (${resposta.status}).${erro}`,
        "resposta",
        { status: resposta.status },
      );
    }
    if (!p.validar) {
      await resposta.body?.cancel();
      return undefined as T;
    }
    try {
      return p.validar(await lerJson(resposta), resposta.status);
    } catch (e) {
      if (e instanceof ErroCartorio) throw e;
      throw new ErroCartorio("O cartório devolveu uma resposta ilegível.", "resposta", {
        cause: e,
      });
    }
  }

  async function chamar<T>(p: Pedido<T>, semToken = false): Promise<T> {
    const token = semToken ? undefined : await cofre.ler();
    if (!token && !semToken) {
      throw new ErroCartorio(
        "Este PC ainda não entrou no grupo: use o convite do administrador.",
        "acesso",
      );
    }
    for (let n = 1; ; n++) {
      if (p.sinal?.aborted) throw cancelado();
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

  /** Aceita só com 200 e recusa só com 409: o contrário é resposta torta. */
  const so200ou409 =
    <T extends { ok: boolean }>(validar: (corpo: unknown) => T) =>
    (corpo: unknown, status: number) => {
      const r = validar(corpo);
      if (r.ok === (status === 409)) throw new Error("Resposta inválida do cartório: trava.");
      return r;
    };
  const validarTrava = so200ou409(validarRespostaTrava);
  const validarAtualizacao = so200ou409(validarRespostaAtualizacao);
  const trava = (rota: string, repetir: boolean, corpo?: object, sinal?: AbortSignal) =>
    chamar<RespostaTrava>({
      metodo: "POST",
      rota,
      corpo,
      repetir,
      recusaE409: true,
      validar: validarTrava,
      sinal,
    });
  /** Mesmo molde da trava de host: só `renovar` repete (pegar e soltar mudam a época). */
  const atualizacao = (rota: string, repetir: boolean, corpo?: object, sinal?: AbortSignal) =>
    chamar<RespostaAtualizacao>({
      metodo: "POST",
      rota,
      corpo,
      repetir,
      recusaE409: true,
      validar: validarAtualizacao,
      sinal,
    });
  const ler = <T>(rota: string, validar: (corpo: unknown) => T) =>
    chamar<T>({ metodo: "GET", rota, repetir: true, validar });

  return {
    eu: () => ler("/eu", validarEu),
    /** Só o dono: os PCs com acesso ao cartório (tela Configurações › Grupo). */
    listarPcs: () => ler("/pcs", validarListaPcs),
    estadoTrava: () => ler("/trava", validarEstadoTrava),
    pegar: () => trava("/trava/pegar", false),
    /** `sinal`: o renovador cancela ao soltar ou perder, e nenhuma tentativa nova sai. */
    renovar: (epoca: number, sinal?: AbortSignal) =>
      trava("/trava/renovar", true, { epoca }, sinal),
    passar: (epoca: number, para: number) => trava("/trava/passar", false, { epoca, para }),
    soltar: (epoca: number) => trava("/trava/soltar", false, { epoca }),
    /** Trava de atualização (syncmel-1.8a/b): atualizar a PRÓPRIA cópia com outro PC hospedando. Nunca dá o host. */
    pegarAtualizacao: () => atualizacao("/atualizacao/pegar", false),
    renovarAtualizacao: (epoca: number, sinal?: AbortSignal) =>
      atualizacao("/atualizacao/renovar", true, { epoca }, sinal),
    soltarAtualizacao: (epoca: number) => atualizacao("/atualizacao/soltar", false, { epoca }),
    grupo: () => ler("/grupo", validarGrupo),
    /** Este PC diz que agora tem a versão N inteira (substitui a anterior). Repete: dizer duas vezes não muda nada. */
    informarCopia: (versao: number) =>
      chamar<undefined>({ metodo: "POST", rota: "/copias", corpo: { versao }, repetir: true }),
    /** Só o PC dono. Não repete: cada tentativa reservaria outro IP provisório na nuvem. */
    criarConvite: (nomePc: string, validadeHoras?: number) =>
      chamar({
        metodo: "POST",
        rota: "/convites",
        corpo: { nomePc, validadeHoras },
        repetir: false,
        validar: validarConviteCriado,
      }),
    /** Só o dono. Não repete: tirar duas vezes daria 404 e esconderia o primeiro sucesso. 204 = tirado. */
    revogarPc: (id: number) =>
      chamar<undefined>({
        metodo: "POST",
        rota: `/pcs/${encodeURIComponent(id)}/revogar`,
        repetir: false,
      }),
    /**
     * Pelo túnel provisório, sem token. Repete: o cartório aceita a mesma chave de novo (mesmo IP, token novo), então
     * uma resposta perdida não encalha o PC.
     */
    usarConvite: (convite: string, chavePublica: string) =>
      chamar(
        {
          metodo: "POST",
          rota: "/convites/usar",
          corpo: { convite, chave_publica: chavePublica },
          repetir: true,
          prazoMs: PRAZO_USAR_MS,
          validar: (v) => {
            // Cartório antigo devolvia só {token}: sem pacote não há túnel; diz o que fazer.
            if (typeof v === "object" && v !== null && "token" in v && !("pacote" in v))
              throw new ErroCartorio(CONVITE_ANTIGO, "resposta");
            return validarEntradaNoGrupo(v);
          },
        },
        true,
      ),
    /** Já pelo IP definitivo: o cartório tira o peer provisório. Pode repetir (confirmar duas vezes não muda nada). */
    confirmarEntrada: () =>
      chamar<undefined>({ metodo: "POST", rota: "/convites/confirmar", repetir: true }),
  };
}
