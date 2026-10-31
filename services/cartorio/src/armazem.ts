import { createHash, randomUUID } from "node:crypto";
import { createWriteStream, mkdirSync, readdirSync, renameSync, rmSync } from "node:fs";
import { rm } from "node:fs/promises";
import { join } from "node:path";
import { type Readable, Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { type Banco, emTransacao } from "./banco.js";
import { type ResultadoTrava, recusaNaTrava } from "./trava.js";
import { maisNova } from "./versoes.js";

/** Onde e quanto a nuvem guarda. O pacote é opaco aqui: quem baixa confere o manifesto dentro dele. */
export interface Armazem {
  banco: Banco;
  pasta: string;
  tetoBytes: number;
  manter: number;
  agora: () => number;
}
export interface OpcoesArmazem {
  banco: Banco;
  pasta: string;
  tetoBytes?: number;
  agora?: () => number;
}
export interface Declarado {
  sha256: string;
  bytes: number;
}
export type MotivoPacote =
  | "nao_e_a_mais_nova"
  | "nao_registrou"
  | "ja_guardada"
  | "grande_demais"
  | "tamanho_errado"
  | "hash_errado"
  | "interrompido";
export type ResultadoPacote =
  | { ok: true; versao: number; sha256: string; bytes: number }
  | { ok: false; motivo: MotivoPacote }
  | Extract<ResultadoTrava, { ok: false }>;

const TETO_PADRAO = 20 * 1024 ** 3;
/** Decidido pela Máxima (reversível): a nuvem guarda as 3 últimas cópias. */
const MANTER = 3;
const PARCIAL = ".parcial";
const arquivo = (pasta: string, versao: number) => join(pasta, `v${versao}.tar.gz`);

/** Prepara a pasta e apaga parciais de um processo que morreu no meio (nunca uma cópia guardada). */
export function criarArmazem({
  banco,
  pasta,
  tetoBytes = TETO_PADRAO,
  agora = Date.now,
}: OpcoesArmazem): Armazem {
  if (!Number.isSafeInteger(tetoBytes) || tetoBytes <= 0) {
    throw new Error(
      `Teto do pacote do mundo recusado (${tetoBytes} bytes): use um inteiro maior que zero.`,
    );
  }
  mkdirSync(pasta, { recursive: true });
  for (const nome of readdirSync(pasta)) {
    if (nome.endsWith(PARCIAL)) rmSync(join(pasta, nome), { force: true });
  }
  return { banco, pasta, tetoBytes, manter: MANTER, agora };
}

/** Quem pode enviar a versão N agora: o dono da trava, época atual, N a mais nova e registrada por ele. */
function recusa(a: Armazem, versao: number, pc: number, epoca: number): ResultadoPacote | null {
  const agora = a.agora();
  const dono = a.banco
    .prepare("SELECT 1 FROM trava WHERE dono_pc_id = ? AND epoca = ? AND expira_em > ?")
    .get(pc, epoca, agora);
  if (!dono) return recusaNaTrava(a.banco, pc, epoca, agora);
  const nova = maisNova(a.banco);
  if (nova?.numero !== versao) return { ok: false, motivo: "nao_e_a_mais_nova" };
  if (nova.pcId !== pc) return { ok: false, motivo: "nao_registrou" };
  if (a.banco.prepare("SELECT 1 FROM copias_nuvem WHERE versao = ?").get(versao)) {
    return { ok: false, motivo: "ja_guardada" };
  }
  return null;
}

class TamanhoErrado extends Error {}

/**
 * Grava o fluxo em `v<N>.<aleatório>.tar.gz.parcial` com hash e contagem em fluxo; confere com o declarado; numa
 * transação reconfere trava e versão (pode ter mudado durante o envio), faz o `rename` e registra; depois apaga as
 * cópias além das 3 mais novas. Qualquer falha apaga o parcial e a cópia anterior fica intacta.
 */
export async function receberPacote(
  a: Armazem,
  versao: number,
  pc: number,
  epoca: number,
  fluxo: Readable,
  { sha256, bytes }: Declarado,
): Promise<ResultadoPacote> {
  const antes = recusa(a, versao, pc, epoca);
  if (antes) return antes;
  if (bytes > a.tetoBytes) return { ok: false, motivo: "grande_demais" };

  const parcial = join(a.pasta, `v${versao}.${randomUUID()}.tar.gz${PARCIAL}`);
  const hash = createHash("sha256");
  let contados = 0;
  const conferir = new Transform({
    transform(pedaco: Buffer, _cod, pronto) {
      contados += pedaco.length;
      if (contados > bytes) return pronto(new TamanhoErrado());
      hash.update(pedaco);
      pronto(null, pedaco);
    },
  });
  let apagadas: number[] = [];
  try {
    try {
      await pipeline(fluxo, conferir, createWriteStream(parcial, { flags: "wx" }));
    } catch (erro) {
      if (erro instanceof TamanhoErrado) return { ok: false, motivo: "tamanho_errado" };
      if (fluxo.errored) return { ok: false, motivo: "interrompido" };
      throw erro;
    }
    if (contados !== bytes) return { ok: false, motivo: "tamanho_errado" };
    if (hash.digest("hex") !== sha256) return { ok: false, motivo: "hash_errado" };

    const r = emTransacao(a.banco, () => {
      const depois = recusa(a, versao, pc, epoca);
      if (depois) return depois;
      renameSync(parcial, arquivo(a.pasta, versao));
      a.banco
        .prepare(
          "INSERT INTO copias_nuvem (versao, sha256, bytes, guardada_em) VALUES (?, ?, ?, ?)",
        )
        .run(versao, sha256, bytes, a.agora());
      apagadas = (
        a.banco
          .prepare(
            `DELETE FROM copias_nuvem WHERE versao NOT IN
               (SELECT versao FROM copias_nuvem ORDER BY versao DESC LIMIT ?)
             RETURNING versao`,
          )
          .all(a.manter) as Array<{ versao: number }>
      ).map((l) => l.versao);
      return null;
    });
    if (r) return r;
  } finally {
    await rm(parcial, { force: true });
  }
  // Depois do commit: a linha já saiu, o arquivo é só sobra. A mais nova nunca está aqui (LIMIT pega as maiores).
  for (const v of apagadas) rmSync(arquivo(a.pasta, v), { force: true });
  return { ok: true, versao, sha256, bytes };
}

/** Cópia guardada da versão N, ou `undefined` se a nuvem não tem essa versão. */
export function pacoteGuardado(
  a: Armazem,
  versao: number,
): { caminho: string; sha256: string; bytes: number } | undefined {
  const linha = a.banco
    .prepare("SELECT sha256, bytes FROM copias_nuvem WHERE versao = ?")
    .get(versao) as { sha256: string; bytes: number } | undefined;
  return linha && { caminho: arquivo(a.pasta, versao), ...linha };
}
