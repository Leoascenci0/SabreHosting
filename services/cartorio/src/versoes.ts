import { type Banco, type Pc, emTransacao } from "./banco.js";
import { type ResultadoTrava, recusaNaTrava } from "./trava.js";

/** O manifesto fica no PC; o cartório guarda só o hash dele e os totais. */
export interface DadosVersao {
  manifestoSha256: string;
  arquivos: number;
  bytes: number;
}
export interface Versao extends DadosVersao {
  numero: number;
  epoca: number;
  pcId: number;
  criadaEm: number;
}
export type ResultadoVersao = { ok: true; numero: number } | Extract<ResultadoTrava, { ok: false }>;

/**
 * Só o dono da trava, com a época atual e a trava valendo, registra; tudo num INSERT … SELECT FROM trava
 * (a regra e o "max + 1" na mesma instrução). Aceita → o PC que enviou passa a ter essa cópia.
 */
export function registrarVersao(
  banco: Banco,
  pc: number,
  epoca: number,
  agora: number,
  { manifestoSha256, arquivos, bytes }: DadosVersao,
): ResultadoVersao {
  return emTransacao(banco, () => {
    const feito = banco
      .prepare(
        `INSERT INTO versoes (numero, epoca, pc_id, manifesto_sha256, arquivos, bytes, criada_em)
         SELECT (SELECT coalesce(max(numero), 0) + 1 FROM versoes), epoca, dono_pc_id, ?, ?, ?, ?
         FROM trava WHERE dono_pc_id = ? AND epoca = ? AND expira_em > ?
         RETURNING numero`,
      )
      .get(manifestoSha256, arquivos, bytes, agora, pc, epoca, agora) as
      { numero: number } | undefined;
    if (!feito) return recusaNaTrava(banco, pc, epoca, agora);
    informarCopia(banco, pc, feito.numero, agora);
    return { ok: true, numero: feito.numero };
  });
}

/** O PC diz a versão que tem agora (substitui a anterior). `false` se a versão não existe. */
export function informarCopia(banco: Banco, pc: number, versao: number, agora: number): boolean {
  return (
    banco
      .prepare(
        `INSERT INTO copias (pc_id, versao, informada_em) SELECT ?, numero, ? FROM versoes WHERE numero = ?
         ON CONFLICT (pc_id) DO UPDATE SET versao = excluded.versao, informada_em = excluded.informada_em`,
      )
      .run(pc, agora, versao).changes === 1
  );
}

export function maisNova(banco: Banco): Versao | null {
  return (
    (banco
      .prepare(
        `SELECT numero, epoca, pc_id AS pcId, manifesto_sha256 AS manifestoSha256, arquivos, bytes,
                criada_em AS criadaEm
         FROM versoes ORDER BY numero DESC LIMIT 1`,
      )
      .get() as Versao | undefined) ?? null
  );
}

/** PC que tem a versão e o IP dele na rede privada (`null` até confirmar a entrada). Só para PC autenticado. */
export interface PcComCopia extends Pc {
  ip: string | null;
}

/**
 * PCs que têm exatamente a versão N agora. Diferente de `listarPcs` (que nunca devolve IP), aqui o IP vai junto:
 * é o endereço da fonte do espalhar. Só convite confirmado conta; a faixa é conferida por quem usa (`escolherFontes`).
 */
export function quemTem(banco: Banco, versao: number): PcComCopia[] {
  return banco
    .prepare(
      `SELECT pcs.id, pcs.nome,
              (SELECT c.ip_def FROM convites c WHERE c.pc_id = pcs.id AND c.confirmado_em IS NOT NULL
               ORDER BY c.confirmado_em DESC LIMIT 1) AS ip
       FROM copias JOIN pcs ON pcs.id = copias.pc_id
       WHERE copias.versao = ? ORDER BY pcs.id`,
    )
    .all(versao) as unknown as PcComCopia[];
}

/** A nuvem guarda a cópia da versão N. */
export function nuvemTem(banco: Banco, versao: number): boolean {
  return (
    banco.prepare("SELECT EXISTS (SELECT 1 FROM copias_nuvem WHERE versao = ?) AS e").get(versao)
      ?.e === 1
  );
}
