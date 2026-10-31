import { createPrivateKey, createPublicKey, randomBytes } from "node:crypto";
import { createConnection } from "node:net";

/** Pacote de ligação definitivo, igual ao que o `adicionar-pc.sh` imprime. */
export interface PacoteLigacao {
  ip_pc: string;
  chave_publica_hub: string;
  endpoint: string;
  allowed_ips: string;
}

/** Quem mexe no WireGuard da nuvem (root). O cartório só pede; a validação de verdade mora no ajudante. */
export interface AjudanteEntrada {
  /** Reserva um IP na sala de entrada (10.66.0.200–254) para a chave provisória. */
  adicionar(chavePub: string): Promise<string>;
  /** Adiciona o peer definitivo (10.66.0.2–199) sem tirar o provisório. Mesma chave = mesmo IP. */
  trocar(ipProv: string, nome: string, chavePub: string): Promise<PacoteLigacao>;
  /** Tira o peer provisório; sem peer, não faz nada. */
  remover(ipProv: string): Promise<void>;
}

/** Socket do serviço do ajudante (root:sabre 0660); o cartório não tem sudo (rede-1.5). */
export const CAMINHO_SOCKET = "/run/sabre/ajudante.sock";
const PRAZO_AJUDANTE_MS = 10_000;
const TETO_RESPOSTA = 4096;

/** 44 caracteres de base64 = 32 bytes (o 43º símbolo só pode ter os 2 bits finais zerados). */
export const CHAVE_WG = /^[A-Za-z0-9+/]{42}[AEIMQUYcgkosw048]=$/;
const IP_REDE = /^10\.66\.0\.(\d{1,3})$/;

function final(ip: unknown): number {
  const m = typeof ip === "string" ? IP_REDE.exec(ip) : null;
  return m ? Number(m[1]) : -1;
}
export const naSalaDeEntrada = (ip: string) => final(ip) >= 200 && final(ip) <= 254;

/** Um pedido por conexão: uma linha JSON de ida, uma de volta, em até 10 s. */
export function pedirAoSocket(
  caminho: string,
  comando: string,
  args: string[],
  prazoMs = PRAZO_AJUDANTE_MS,
): Promise<string> {
  return new Promise((ok, falha) => {
    const conexao = createConnection(caminho);
    let recebido = Buffer.alloc(0);
    let resposta = "";
    const acabar = (erro?: Error) => {
      conexao.destroy();
      if (erro) falha(erro);
      else ok(resposta);
    };
    conexao.setTimeout(prazoMs, () =>
      acabar(new Error("Ajudante do WireGuard não respondeu a tempo.")),
    );
    conexao.on("error", acabar);
    conexao.on("end", () => acabar(new Error("Ajudante do WireGuard fechou sem responder.")));
    // Teto de 4096 bytes antes do \n, contado no total (o \n pode vir no mesmo pedaço do excesso).
    conexao.on("data", (pedaco: Buffer) => {
      recebido = Buffer.concat([recebido, pedaco]);
      const fim = recebido.indexOf(10);
      if ((fim < 0 ? recebido.length : fim) > TETO_RESPOSTA)
        acabar(new Error("Ajudante do WireGuard devolveu uma saída ilegível."));
      else if (fim >= 0) {
        resposta = recebido.subarray(0, fim).toString("utf8");
        acabar();
      }
    });
    conexao.end(`${JSON.stringify({ comando, args })}\n`);
  });
}

/** A saída do ajudante é conferida como entrada de fora: um campo torto não chega ao PC. */
function lerJson(saida: string): Record<string, unknown> {
  try {
    const v: unknown = JSON.parse(saida);
    if (v && typeof v === "object") return v as Record<string, unknown>;
  } catch {
    // cai no erro abaixo
  }
  throw new Error("Ajudante do WireGuard devolveu uma saída ilegível.");
}

/** O real: pedido pelo socket do serviço do ajudante. Recusa do ajudante (`{"codigo":…}`) vira erro. */
export function criarAjudanteSocket(caminho = CAMINHO_SOCKET): AjudanteEntrada {
  const rodar = async (comando: string, ...args: string[]) => {
    const r = lerJson(await pedirAoSocket(caminho, comando, args));
    if ("codigo" in r)
      throw new Error(
        `Ajudante do WireGuard recusou o pedido: ${String(r["erro"] ?? r["codigo"])}`,
      );
    return r;
  };
  return {
    async adicionar(chavePub) {
      const { ip } = await rodar("entrada-adicionar", chavePub);
      if (typeof ip !== "string" || !naSalaDeEntrada(ip))
        throw new Error("Ajudante do WireGuard devolveu um IP fora da sala de entrada.");
      return ip;
    },
    async trocar(ipProv, nome, chavePub) {
      const p = await rodar("entrada-trocar", ipProv, nome, chavePub);
      const n = final(p["ip_pc"]);
      const endpoint = typeof p["endpoint"] === "string" ? p["endpoint"] : "";
      if (
        n < 2 ||
        n > 199 ||
        typeof p["chave_publica_hub"] !== "string" ||
        !CHAVE_WG.test(p["chave_publica_hub"]) ||
        !/^[A-Za-z0-9.-]+:\d{1,5}$/.test(endpoint) ||
        typeof p["allowed_ips"] !== "string" ||
        !/^[0-9./]+$/.test(p["allowed_ips"])
      )
        throw new Error("Ajudante do WireGuard devolveu um pacote de ligação inválido.");
      return {
        ip_pc: String(p["ip_pc"]),
        chave_publica_hub: p["chave_publica_hub"],
        endpoint,
        allowed_ips: p["allowed_ips"],
      };
    },
    async remover(ipProv) {
      await rodar("entrada-remover", ipProv);
    },
  };
}

/** Par X25519 provisório (mesma curva e mesmo ajuste de bits do `wg genkey`), sem processo filho. */
export function gerarParProvisorio(): { privada: string; publica: string } {
  const b = randomBytes(32);
  b[0] = (b[0] ?? 0) & 248;
  b[31] = ((b[31] ?? 0) & 127) | 64;
  const der = Buffer.concat([Buffer.from("302e020100300506032b656e04220420", "hex"), b]);
  const jwk = createPublicKey(createPrivateKey({ key: der, format: "der", type: "pkcs8" })).export({
    format: "jwk",
  });
  return {
    privada: b.toString("base64"),
    publica: Buffer.from(jwk.x ?? "", "base64url").toString("base64"),
  };
}
