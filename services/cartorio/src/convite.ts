import { type AjudanteEntrada, type PacoteLigacao, gerarParProvisorio } from "./ajudante.js";
import { type Banco, criarConvite, entrarPeloConvite, lerConvite } from "./banco.js";

/** Dados do grupo que vão no texto do convite e no `GET /grupo` (configuração da nuvem de cada grupo). */
export interface Grupo {
  nome: string;
  /** Endereço que o botão Jogar usa (`host` ou `host:porta`). */
  enderecoJogar: string;
  /** Endereço público do WireGuard do hub (`host:porta`). */
  hubEndpoint: string;
  hubChavePub: string;
  portaCartorio: number;
}

/** Nome do PC no formato da rede (o mesmo do `adicionar-pc.sh`). */
export const NOME_PC = "^[a-z0-9][a-z0-9-]{0,31}$";
export const HORA_MS = 3_600_000;
export const VALIDADE_PADRAO_H = 24;
export const VALIDADE_MAXIMA_H = 72;

/**
 * Gera o par provisório, reserva o IP na sala de entrada e grava o convite. Devolve o texto
 * `sabre://convite/1.<base64url>` (§5.3) — a única vez que o código e a chave privada provisória existem.
 */
export async function emitirConvite(
  banco: Banco,
  ajudante: AjudanteEntrada,
  grupo: Grupo,
  pedido: { nomePc: string; validadeMs: number; paraDono?: boolean },
  agora: number,
): Promise<{ convite: string; expiraEm: number }> {
  const par = gerarParProvisorio();
  const ip = await ajudante.adicionar(par.publica);
  let codigo: string;
  try {
    codigo = criarConvite(banco, pedido.nomePc, agora, pedido.validadeMs, {
      ipProv: ip,
      chavePubProv: par.publica,
      paraDono: pedido.paraDono,
    });
  } catch (erro) {
    await ajudante.remover(ip).catch(() => undefined);
    throw erro;
  }
  const expiraEm = agora + pedido.validadeMs;
  const dados = {
    g: grupo.nome,
    h: grupo.hubEndpoint,
    k: grupo.hubChavePub,
    i: ip,
    p: par.privada,
    c: codigo,
    a: grupo.portaCartorio,
    e: Math.floor(expiraEm / 1000),
  };
  const texto = Buffer.from(JSON.stringify(dados)).toString("base64url");
  return { convite: `sabre://convite/1.${texto}`, expiraEm };
}

export type ResultadoEntrada =
  | { ok: true; token: string; pacote: PacoteLigacao }
  | { ok: false; motivo: "invalido" | "ajudante" };

/**
 * `POST /convites/usar` de convite com sala de entrada: só do IP provisório. Banco primeiro (marca e dá o token),
 * depois o ajudante (idempotente): se ele falhar, o PC repete com a mesma chave e recebe token novo.
 */
export async function entrarNoGrupo(
  banco: Banco,
  ajudante: AjudanteEntrada,
  pedido: { convite: string; chavePub: string; ip: string },
  agora: number,
): Promise<ResultadoEntrada> {
  const linha = lerConvite(banco, pedido.convite);
  if (!linha || linha.ip_prov !== pedido.ip) return { ok: false, motivo: "invalido" };
  const entrada = entrarPeloConvite(banco, pedido.convite, pedido.chavePub, agora);
  if (!entrada) return { ok: false, motivo: "invalido" };
  let pacote: PacoteLigacao;
  try {
    pacote = await ajudante.trocar(entrada.ipProv, entrada.nome, pedido.chavePub);
  } catch {
    return { ok: false, motivo: "ajudante" };
  }
  banco.prepare("UPDATE convites SET ip_def = ? WHERE pc_id = ?").run(pacote.ip_pc, entrada.pcId);
  return { ok: true, token: entrada.token, pacote };
}

/** `POST /convites/confirmar`: o PC já fala pelo IP definitivo; o provisório sai. */
export async function confirmarEntrada(
  banco: Banco,
  ajudante: AjudanteEntrada,
  pcId: number,
  ip: string,
  agora: number,
): Promise<"ok" | "ip_errado"> {
  const c = banco
    .prepare(
      `SELECT hash, ip_prov, ip_def FROM convites
       WHERE pc_id = ? AND ip_prov IS NOT NULL AND prov_removido_em IS NULL`,
    )
    .get(pcId) as { hash: string; ip_prov: string; ip_def: string | null } | undefined;
  if (!c) return "ok";
  if (c.ip_def !== ip) return "ip_errado";
  await ajudante.remover(c.ip_prov);
  banco
    .prepare("UPDATE convites SET confirmado_em = ?, prov_removido_em = ? WHERE hash = ?")
    .run(agora, agora, c.hash);
  return "ok";
}

/**
 * Convite vencido (usado ou não) ou já confirmado = peer provisório morto. Quem falhar fica marcado como pendente e a
 * próxima volta tenta de novo.
 */
export async function limparProvisorios(
  banco: Banco,
  ajudante: AjudanteEntrada,
  agora: number,
): Promise<{ removidos: number; falhas: number }> {
  const pendentes = banco
    .prepare(
      `SELECT hash, ip_prov FROM convites WHERE ip_prov IS NOT NULL AND prov_removido_em IS NULL
         AND (expira_em <= ? OR confirmado_em IS NOT NULL)`,
    )
    .all(agora) as Array<{ hash: string; ip_prov: string }>;
  let removidos = 0;
  let falhas = 0;
  for (const c of pendentes) {
    try {
      await ajudante.remover(c.ip_prov);
      banco.prepare("UPDATE convites SET prov_removido_em = ? WHERE hash = ?").run(agora, c.hash);
      removidos++;
    } catch {
      falhas++;
    }
  }
  return { removidos, falhas };
}
