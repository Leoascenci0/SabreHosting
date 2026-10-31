import { DatabaseSync } from "node:sqlite";
import { gerarSegredo, hashSegredo } from "./segredo.js";

export type Banco = DatabaseSync;
export interface Pc {
  id: number;
  nome: string;
}

/** Migrações em ordem; a posição + 1 é a versão do esquema. Nunca editar uma que já saiu: acrescentar outra. */
export const MIGRACOES = [
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
  // Trava de host: uma linha só. `epoca` (fencing token) sobe a cada troca de dono e nunca desce.
  `CREATE TABLE trava (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     dono_pc_id INTEGER REFERENCES pcs(id),
     expira_em INTEGER NOT NULL DEFAULT 0,
     epoca INTEGER NOT NULL DEFAULT 0 CHECK (epoca >= 0)
   );
   INSERT INTO trava (id) VALUES (1);
   CREATE TRIGGER trava_epoca_nunca_desce BEFORE UPDATE OF epoca ON trava
   WHEN NEW.epoca < OLD.epoca BEGIN SELECT RAISE(ABORT, 'A época da trava nunca desce.'); END;`,
  // A linha única não se recria nem se apaga: INSERT OR REPLACE / REPLACE / DELETE zerariam a época (fencing).
  `CREATE TRIGGER trava_nao_recria BEFORE INSERT ON trava
   BEGIN SELECT RAISE(ABORT, 'A trava é uma linha só e não se recria.'); END;
   CREATE TRIGGER trava_nao_apaga BEFORE DELETE ON trava
   BEGIN SELECT RAISE(ABORT, 'A trava não se apaga.'); END;`,
  // Versões do mundo: número que só cresce (max + 1, sem buraco), registro que não muda nem se apaga.
  // `copias`: uma linha por PC, a versão que ele tem agora.
  `CREATE TABLE versoes (
     numero INTEGER PRIMARY KEY,
     epoca INTEGER NOT NULL CHECK (typeof(epoca) = 'integer' AND epoca >= 1),
     pc_id INTEGER NOT NULL REFERENCES pcs(id),
     manifesto_sha256 TEXT NOT NULL
       CHECK (length(manifesto_sha256) = 64 AND manifesto_sha256 NOT GLOB '*[^0-9a-f]*'),
     arquivos INTEGER NOT NULL CHECK (typeof(arquivos) = 'integer' AND arquivos >= 0),
     bytes INTEGER NOT NULL CHECK (typeof(bytes) = 'integer' AND bytes >= 0),
     criada_em INTEGER NOT NULL CHECK (typeof(criada_em) = 'integer' AND criada_em >= 0)
   );
   CREATE TRIGGER versoes_sem_buraco BEFORE INSERT ON versoes
   WHEN NEW.numero IS NOT (SELECT coalesce(max(numero), 0) + 1 FROM versoes)
   BEGIN SELECT RAISE(ABORT, 'A versão nova é a última + 1, sem buraco.'); END;
   CREATE TRIGGER versoes_nao_muda BEFORE UPDATE ON versoes
   BEGIN SELECT RAISE(ABORT, 'Versão registrada não muda.'); END;
   CREATE TRIGGER versoes_nao_apaga BEFORE DELETE ON versoes
   BEGIN SELECT RAISE(ABORT, 'Versão registrada não se apaga.'); END;
   CREATE TABLE copias (
     pc_id INTEGER PRIMARY KEY REFERENCES pcs(id),
     versao INTEGER NOT NULL REFERENCES versoes(numero),
     informada_em INTEGER NOT NULL CHECK (typeof(informada_em) = 'integer' AND informada_em >= 0)
   );`,
  // Cópias do mundo guardadas na nuvem (arquivo `mundo/v<N>.tar.gz`); a rotação apaga as mais velhas.
  `CREATE TABLE copias_nuvem (
     versao INTEGER PRIMARY KEY REFERENCES versoes(numero),
     sha256 TEXT NOT NULL CHECK (length(sha256) = 64 AND sha256 NOT GLOB '*[^0-9a-f]*'),
     bytes INTEGER NOT NULL CHECK (typeof(bytes) = 'integer' AND bytes >= 0),
     guardada_em INTEGER NOT NULL CHECK (typeof(guardada_em) = 'integer' AND guardada_em >= 0)
   );
   CREATE TRIGGER copias_nuvem_nao_muda BEFORE UPDATE ON copias_nuvem
   BEGIN SELECT RAISE(ABORT, 'Cópia guardada não muda.'); END;`,
];

/** Abre o banco e aplica as migrações que faltam, tudo numa transação (versão lida dentro dela). */
export function abrirBanco(caminho: string, migracoes = MIGRACOES): Banco {
  const banco = new DatabaseSync(caminho);
  try {
    banco.exec("PRAGMA busy_timeout = 5000; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON");
    emTransacao(banco, () => {
      banco.exec("CREATE TABLE IF NOT EXISTS esquema (versao INTEGER NOT NULL)");
      const linha = banco.prepare("SELECT versao FROM esquema").get() as
        { versao: number } | undefined;
      const versao = linha?.versao ?? 0;
      if (versao > migracoes.length) {
        throw new Error(`Banco do cartório na versão ${versao}, mais nova que este programa.`);
      }
      migracoes.slice(versao).forEach((sql) => banco.exec(sql));
      banco.exec("DELETE FROM esquema");
      banco.prepare("INSERT INTO esquema (versao) VALUES (?)").run(migracoes.length);
    });
  } catch (erro) {
    banco.close();
    throw erro;
  }
  return banco;
}

export function emTransacao<T>(banco: Banco, fazer: () => T): T {
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
