import { DatabaseSync } from "node:sqlite";
import { gerarSegredo, hashSegredo } from "./segredo.js";

export type Banco = DatabaseSync;
export interface Pc {
  id: number;
  nome: string;
}

/** Migrações em ordem; a posição + 1 é a versão do esquema. Nunca editar uma que já saiu: acrescentar outra. */
const MIGRACOES = [
  `CREATE TABLE pcs (
     id INTEGER PRIMARY KEY,
     nome TEXT NOT NULL,
     criado_em INTEGER NOT NULL
   );
   CREATE TABLE tokens (
     hash TEXT PRIMARY KEY,
     pc_id INTEGER NOT NULL REFERENCES pcs(id),
     criado_em INTEGER NOT NULL,
     revogado_em INTEGER
   );
   CREATE TABLE convites (
     hash TEXT PRIMARY KEY,
     nome_pc TEXT NOT NULL,
     criado_em INTEGER NOT NULL,
     expira_em INTEGER NOT NULL,
     usado_em INTEGER,
     pc_id INTEGER REFERENCES pcs(id)
   );`,
];

export function abrirBanco(caminho: string): Banco {
  const banco = new DatabaseSync(caminho);
  banco.exec(
    "PRAGMA foreign_keys = ON; CREATE TABLE IF NOT EXISTS esquema (versao INTEGER NOT NULL)",
  );
  const linha = banco.prepare("SELECT versao FROM esquema").get() as { versao: number } | undefined;
  const versao = linha?.versao ?? 0;
  if (versao > MIGRACOES.length) {
    banco.close();
    throw new Error(`Banco do cartório na versão ${versao}, mais nova que este programa.`);
  }
  emTransacao(banco, () => {
    MIGRACOES.slice(versao).forEach((sql) => banco.exec(sql));
    banco.exec("DELETE FROM esquema");
    banco.prepare("INSERT INTO esquema (versao) VALUES (?)").run(MIGRACOES.length);
  });
  return banco;
}

function emTransacao<T>(banco: Banco, fazer: () => T): T {
  banco.exec("BEGIN IMMEDIATE");
  try {
    const r = fazer();
    banco.exec("COMMIT");
    return r;
  } catch (erro) {
    banco.exec("ROLLBACK");
    throw erro;
  }
}

/** Devolve o código do convite (a única vez que ele existe em claro). */
export function criarConvite(
  banco: Banco,
  nomePc: string,
  agora: number,
  validadeMs: number,
): string {
  const convite = gerarSegredo();
  banco
    .prepare("INSERT INTO convites (hash, nome_pc, criado_em, expira_em) VALUES (?, ?, ?, ?)")
    .run(hashSegredo(convite), nomePc, agora, agora + validadeMs);
  return convite;
}

/** Troca o convite pelo token do PC, uma única vez. `undefined` se o convite não vale (inventado, usado ou vencido). */
export function usarConvite(banco: Banco, convite: string, agora: number): string | undefined {
  const hash = hashSegredo(convite);
  return emTransacao(banco, () => {
    const marcado = banco
      .prepare(
        "UPDATE convites SET usado_em = ? WHERE hash = ? AND usado_em IS NULL AND expira_em > ?",
      )
      .run(agora, hash, agora);
    if (marcado.changes !== 1) return undefined;
    const { nome_pc } = banco.prepare("SELECT nome_pc FROM convites WHERE hash = ?").get(hash) as {
      nome_pc: string;
    };
    const pc = banco.prepare("INSERT INTO pcs (nome, criado_em) VALUES (?, ?)").run(nome_pc, agora);
    banco.prepare("UPDATE convites SET pc_id = ? WHERE hash = ?").run(pc.lastInsertRowid, hash);
    const token = gerarSegredo();
    banco
      .prepare("INSERT INTO tokens (hash, pc_id, criado_em) VALUES (?, ?, ?)")
      .run(hashSegredo(token), pc.lastInsertRowid, agora);
    return token;
  });
}

export function pcDoToken(banco: Banco, token: string): Pc | undefined {
  return banco
    .prepare(
      `SELECT pcs.id, pcs.nome FROM tokens JOIN pcs ON pcs.id = tokens.pc_id
       WHERE tokens.hash = ? AND tokens.revogado_em IS NULL`,
    )
    .get(hashSegredo(token)) as Pc | undefined;
}
