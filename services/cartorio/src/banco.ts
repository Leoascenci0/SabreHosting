import { DatabaseSync } from "node:sqlite";
import { gerarSegredo, hashSegredo } from "./segredo.js";

export type Banco = DatabaseSync;
export interface Pc {
  id: number;
  nome: string;
}
/** Dados da sala de entrada que o convite novo guarda (a chave privada provisória nunca entra aqui). */
export interface EntradaProvisoria {
  ipProv: string;
  chavePubProv: string;
  paraDono?: boolean;
}
export interface LinhaConvite {
  nome_pc: string;
  expira_em: number;
  usado_em: number | null;
  pc_id: number | null;
  para_dono: number;
  ip_prov: string | null;
  ip_def: string | null;
  prov_removido_em: number | null;
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
  // Convite do grupo (cart-1.5): um dono só; o convite guarda o IP e a chave PÚBLICA provisórios (a privada, nunca),
  // a chave definitiva do 1º uso (repetição em duas fases) e quando o peer provisório saiu.
  `ALTER TABLE pcs ADD COLUMN dono INTEGER NOT NULL DEFAULT 0 CHECK (dono IN (0, 1));
   CREATE UNIQUE INDEX pcs_um_dono ON pcs (dono) WHERE dono = 1;
   ALTER TABLE convites ADD COLUMN para_dono INTEGER NOT NULL DEFAULT 0 CHECK (para_dono IN (0, 1));
   ALTER TABLE convites ADD COLUMN ip_prov TEXT;
   ALTER TABLE convites ADD COLUMN chave_pub_prov TEXT;
   ALTER TABLE convites ADD COLUMN chave_pub_def TEXT;
   ALTER TABLE convites ADD COLUMN ip_def TEXT;
   ALTER TABLE convites ADD COLUMN confirmado_em INTEGER;
   ALTER TABLE convites ADD COLUMN prov_removido_em INTEGER;`,
  // Época sempre inteira (cartmel-1.6): texto passaria por `nunca_desce` (texto > número no SQLite). Gatilho, não
  // tabela nova: recriar a trava arriscaria zerar a época. INSERT já é barrado por `trava_nao_recria`.
  `CREATE TRIGGER trava_epoca_inteira BEFORE UPDATE OF epoca ON trava
   WHEN typeof(NEW.epoca) <> 'integer'
   BEGIN SELECT RAISE(ABORT, 'A época da trava é sempre um número inteiro.'); END;`,
  // Trava de atualização (syncmel-1.8a): uma linha por PC, separada da trava de host. Soltar zera o prazo, a linha
  // fica: a época (fencing) continua subindo nos próximos `pegar` e nunca desce.
  `CREATE TABLE atualizacao (
     pc_id INTEGER PRIMARY KEY REFERENCES pcs(id),
     epoca INTEGER NOT NULL CHECK (typeof(epoca) = 'integer' AND epoca >= 1),
     expira_em INTEGER NOT NULL CHECK (typeof(expira_em) = 'integer' AND expira_em >= 0)
   );
   CREATE TRIGGER atualizacao_epoca_nunca_desce BEFORE UPDATE OF epoca ON atualizacao
   WHEN NEW.epoca < OLD.epoca BEGIN SELECT RAISE(ABORT, 'A época da atualização nunca desce.'); END;
   CREATE TRIGGER atualizacao_nao_apaga BEFORE DELETE ON atualizacao
   BEGIN SELECT RAISE(ABORT, 'A atualização não se apaga.'); END;`,
  // Configuração do grupo (hostmel-3.1b): linha única, como a trava. Quem grava (o dono) e quando ficam anotados; o sha1 é
  // o do jar oficial da versão, conferido pelo núcleo no download. O padrão 1.21.1 mora só aqui.
  `CREATE TABLE config_grupo (
     id INTEGER PRIMARY KEY CHECK (id = 1),
     versao_minecraft TEXT NOT NULL DEFAULT '1.21.1',
     sha1_manifesto TEXT CHECK (sha1_manifesto IS NULL OR (length(sha1_manifesto) = 40 AND sha1_manifesto NOT GLOB '*[^0-9a-f]*')),
     dono_pc_id INTEGER REFERENCES pcs(id),
     atualizado_em INTEGER NOT NULL DEFAULT 0 CHECK (typeof(atualizado_em) = 'integer' AND atualizado_em >= 0)
   );
   INSERT INTO config_grupo (id) VALUES (1);
   CREATE TRIGGER config_grupo_nao_recria BEFORE INSERT ON config_grupo
   BEGIN SELECT RAISE(ABORT, 'A configuração do grupo é uma linha só e não se recria.'); END;
   CREATE TRIGGER config_grupo_nao_apaga BEFORE DELETE ON config_grupo
   BEGIN SELECT RAISE(ABORT, 'A configuração do grupo não se apaga.'); END;`,
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
  entrada?: EntradaProvisoria,
): string {
  const convite = gerarSegredo();
  banco
    .prepare(
      `INSERT INTO convites (hash, nome_pc, criado_em, expira_em, ip_prov, chave_pub_prov, para_dono)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      hashSegredo(convite),
      nomePc,
      agora,
      agora + validadeMs,
      entrada?.ipProv ?? null,
      entrada?.chavePubProv ?? null,
      entrada?.paraDono ? 1 : 0,
    );
  return convite;
}

function novoToken(banco: Banco, pcId: number | bigint, agora: number): string {
  const token = gerarSegredo();
  banco
    .prepare("INSERT INTO tokens (hash, pc_id, criado_em) VALUES (?, ?, ?)")
    .run(hashSegredo(token), pcId, agora);
  return token;
}

/** Cria o PC do convite; convite de dono passa a marca (o dono anterior, se houver, deixa de ser). */
function registrarPc(banco: Banco, hash: string, agora: number): number {
  const { nome_pc, para_dono } = banco
    .prepare("SELECT nome_pc, para_dono FROM convites WHERE hash = ?")
    .get(hash) as { nome_pc: string; para_dono: number };
  if (para_dono) banco.prepare("UPDATE pcs SET dono = 0 WHERE dono = 1").run();
  const pc = banco
    .prepare("INSERT INTO pcs (nome, criado_em, dono) VALUES (?, ?, ?)")
    .run(nome_pc, agora, para_dono);
  banco.prepare("UPDATE convites SET pc_id = ? WHERE hash = ?").run(pc.lastInsertRowid, hash);
  return Number(pc.lastInsertRowid);
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
    return novoToken(banco, registrarPc(banco, hash, agora), agora);
  });
}

export function lerConvite(banco: Banco, convite: string): LinhaConvite | undefined {
  return banco
    .prepare(
      `SELECT nome_pc, expira_em, usado_em, pc_id, para_dono, ip_prov, ip_def, prov_removido_em
       FROM convites WHERE hash = ?`,
    )
    .get(hashSegredo(convite)) as LinhaConvite | undefined;
}

/**
 * Entrada pela sala provisória, em duas fases. 1º uso: marca o convite, cria o PC e o token. Repetição (resposta
 * perdida) com a MESMA chave definitiva, antes do prazo e da confirmação: revoga o token anterior e devolve outro.
 * Chave diferente, convite vencido, confirmado ou sem sala → `undefined`.
 */
export function entrarPeloConvite(
  banco: Banco,
  convite: string,
  chavePub: string,
  agora: number,
): { token: string; pcId: number; nome: string; ipProv: string } | undefined {
  const hash = hashSegredo(convite);
  return emTransacao(banco, () => {
    const c = banco
      .prepare(
        `SELECT nome_pc, usado_em, pc_id, ip_prov, chave_pub_def FROM convites
         WHERE hash = ? AND ip_prov IS NOT NULL AND expira_em > ?
           AND confirmado_em IS NULL AND prov_removido_em IS NULL`,
      )
      .get(hash, agora) as
      | {
          nome_pc: string;
          usado_em: number | null;
          pc_id: number | null;
          ip_prov: string;
          chave_pub_def: string | null;
        }
      | undefined;
    if (!c) return undefined;
    let pcId: number;
    if (c.usado_em === null) {
      banco
        .prepare("UPDATE convites SET usado_em = ?, chave_pub_def = ? WHERE hash = ?")
        .run(agora, chavePub, hash);
      pcId = registrarPc(banco, hash, agora);
    } else {
      if (c.pc_id === null || c.chave_pub_def !== chavePub) return undefined;
      pcId = c.pc_id;
      banco
        .prepare("UPDATE tokens SET revogado_em = ? WHERE pc_id = ? AND revogado_em IS NULL")
        .run(agora, pcId);
    }
    return { token: novoToken(banco, pcId, agora), pcId, nome: c.nome_pc, ipProv: c.ip_prov };
  });
}

/** Nome já usado por PC com token ativo ou por convite ainda pendente. */
export function nomeOcupado(banco: Banco, nome: string, agora: number): boolean {
  return (
    banco
      .prepare(
        `SELECT 1 FROM pcs WHERE nome = ?
           AND EXISTS (SELECT 1 FROM tokens WHERE pc_id = pcs.id AND revogado_em IS NULL)
         UNION ALL
         SELECT 1 FROM convites WHERE nome_pc = ? AND usado_em IS NULL AND expira_em > ?`,
      )
      .get(nome, nome, agora) !== undefined
  );
}

/**
 * Tira o acesso do PC ao cartório: revoga os tokens ativos dele (o filtro de `pcDoToken` faz o resto).
 * A conferência de dono e de existência fica dentro da transação: o `trocar-dono` roda em outro processo e não
 * pode passar no meio entre olhar e revogar.
 */
export function revogarPc(
  banco: Banco,
  pcId: number,
  agora: number,
): "revogado" | "dono" | "inexistente" {
  return emTransacao(banco, () => {
    const pc = banco.prepare("SELECT dono FROM pcs WHERE id = ?").get(pcId) as
      { dono: number } | undefined;
    if (!pc) return "inexistente";
    if (pc.dono === 1) return "dono";
    banco
      .prepare("UPDATE tokens SET revogado_em = ? WHERE pc_id = ? AND revogado_em IS NULL")
      .run(agora, pcId);
    return "revogado";
  });
}

export function donoAtual(banco: Banco): Pc | undefined {
  return banco.prepare("SELECT id, nome FROM pcs WHERE dono = 1").get() as Pc | undefined;
}

export function ehDono(banco: Banco, pcId: number): boolean {
  return donoAtual(banco)?.id === pcId;
}

/** Os PCs do grupo: só os que têm token ativo; nunca devolve token, hash ou IP (o IP só sai em `quemTem`, para PC autenticado). */
export function listarPcsAtivos(banco: Banco): Array<Pc & { dono: boolean }> {
  const linhas = banco
    .prepare(
      `SELECT id, nome, dono FROM pcs
       WHERE EXISTS (SELECT 1 FROM tokens WHERE pc_id = pcs.id AND revogado_em IS NULL)
       ORDER BY id`,
    )
    .all() as Array<{ id: number; nome: string; dono: number }>;
  return linhas.map((l) => ({ id: l.id, nome: l.nome, dono: l.dono === 1 }));
}

export function pcDoToken(banco: Banco, token: string): Pc | undefined {
  return banco
    .prepare(
      `SELECT pcs.id, pcs.nome FROM tokens JOIN pcs ON pcs.id = tokens.pc_id
       WHERE tokens.hash = ? AND tokens.revogado_em IS NULL`,
    )
    .get(hashSegredo(token)) as Pc | undefined;
}

/**
 * Apaga convites nunca usados vencidos há mais de `dias`; o usado fica (o `pc_id` dele é o registro de quem entrou).
 * Linha cujo peer provisório ainda não saiu fica: é ela que diz à limpeza o que remover.
 */
export function apagarConvitesVencidos(banco: Banco, agora: number, dias = 7): number {
  const limite = agora - dias * 86_400_000;
  return Number(
    banco
      .prepare(
        `DELETE FROM convites WHERE usado_em IS NULL AND expira_em < ?
           AND (ip_prov IS NULL OR prov_removido_em IS NOT NULL)`,
      )
      .run(limite).changes,
  );
}
