/**
 * Rotação dos backups: decide o que apagar (`planejarRotacao`, pura) e apaga (`aplicarRotacao`).
 *
 * Regra de ouro 4: nunca apagar o último backup bom. O plano guarda os N mais recentes, TODOS os dos últimos 7 dias
 * (decisão do Eliel, 31/10/2026; a regra única mora aqui, o drive-1.1b reusa), o bom mais recente e tudo o que ainda
 * não foi conferido; a aplicação confere de novo, na hora, que um bom sobrevive ANTES de apagar qualquer arquivo.
 * Quem monta a lista (estado de cada backup) é `rotacao-pasta.ts`; restaurar é o bkp-2.2.
 */
import { lstat, mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { abrirPacote } from "./pacote.js";

export type EstadoDoBackup = "bom" | "ruim" | "nao-conferido";

export interface BackupDaRotacao {
  /** Nome do arquivo dentro da pasta de backups: `<data>-v<versao>.tar.gz` (agendador, bkp-1.3). */
  nome: string;
  data: Date;
  estado: EstadoDoBackup;
  /** Hash do pacote, para a conferência de agora (`conferirPacote`). */
  sha256?: string;
}

/** Padrão de Configurações › Backups › Quantos guardar. */
export const RECENTES_PADRAO = 10;
/** Janela fixa: todo backup destes últimos dias (contando hoje) fica, qualquer que seja "Quantos guardar". */
export const DIAS_PADRAO = 7;

export interface OpcoesPlano {
  /** Configurações › Backups › Quantos guardar (padrão 10). */
  recentes?: number;
  /** Quantos dias, contando hoje, ficam por inteiro (padrão 7). */
  dias?: number;
  agora: Date;
}

export interface PlanoDeRotacao {
  manter: BackupDaRotacao[];
  apagar: BackupDaRotacao[];
}

const maisRecenteDireto = (a: BackupDaRotacao, b: BackupDaRotacao): number =>
  b.data.getTime() - a.data.getTime() || (a.nome < b.nome ? 1 : a.nome > b.nome ? -1 : 0);

const chaveDoDia = (d: Date): string => `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;

/** Sem efeito colateral: devolve o que manter e o que apagar, sem alterar a lista recebida. */
export function planejarRotacao(
  backups: readonly BackupDaRotacao[],
  { recentes = RECENTES_PADRAO, dias = DIAS_PADRAO, agora }: OpcoesPlano,
): PlanoDeRotacao {
  if (!Number.isInteger(recentes) || recentes < 1) {
    throw new Error("A rotação precisa guardar pelo menos 1 backup recente.");
  }
  if (!Number.isInteger(dias) || dias < 0) {
    throw new Error(
      "A quantidade de dias guardados na rotação precisa ser um número inteiro, 0 ou mais.",
    );
  }
  if (new Set(backups.map((b) => b.nome)).size !== backups.length) {
    throw new Error("Há nomes de backup repetido na lista da rotação; não apaguei nada.");
  }
  if (backups.some((b) => Number.isNaN(b.data.getTime()))) {
    throw new Error("Há backup com data inválida na lista da rotação; não apaguei nada.");
  }
  const lista = [...backups].sort(maisRecenteDireto);
  const manter = new Set<BackupDaRotacao>(lista.slice(0, recentes));

  const diasQueValem = new Set<string>();
  // `new Date(a, m, d - i)` anda dias civis no fuso local, certo também na virada do horário de verão.
  for (let i = 0; i < dias; i++) {
    diasQueValem.add(
      chaveDoDia(new Date(agora.getFullYear(), agora.getMonth(), agora.getDate() - i)),
    );
  }
  for (const b of lista) if (diasQueValem.has(chaveDoDia(b.data))) manter.add(b);

  const ultimoBom = lista.find((b) => b.estado === "bom");
  // Sem nenhum bom conhecido não há o que a rotação possa proteger: ela não mexe em nada.
  if (ultimoBom === undefined) return { manter: lista, apagar: [] };
  manter.add(ultimoBom);
  for (const b of lista) if (b.estado === "nao-conferido") manter.add(b);

  return {
    manter: lista.filter((b) => manter.has(b)),
    apagar: lista.filter((b) => !manter.has(b)),
  };
}

/** Só estes nomes são do SabreHosting; qualquer outra coisa na pasta de backups não é da rotação. */
export const NOME_DE_BACKUP = /^\d{4}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-v\d+\.tar\.gz$/;

/** Arquivo comum (nunca link, pasta ou nome estranho) com nome do SabreHosting dentro da pasta. */
async function ehArquivoDoSabre(pasta: string, nome: string): Promise<boolean> {
  if (!NOME_DE_BACKUP.test(nome)) return false;
  // lstat não segue link: um link simbólico nunca passa por `isFile`.
  const info = await lstat(join(pasta, nome)).catch(() => undefined);
  return info?.isFile() === true;
}

/** Conferência padrão: abre o pacote (hash + manifesto + cada arquivo) numa pasta temporária, que é apagada depois. */
export async function conferirPacote(pasta: string, backup: BackupDaRotacao): Promise<boolean> {
  if (backup.sha256 === undefined) return false;
  const base = await mkdtemp(join(tmpdir(), "sabre-conferir-"));
  try {
    await abrirPacote(join(pasta, backup.nome), backup.sha256, join(base, "aberto"));
    return true;
  } catch {
    return false;
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

export interface OpcoesAplicar {
  /** `true`: só mostra o que seria apagado (não confere hash nem apaga). */
  simular?: boolean;
  conferir?: (pasta: string, backup: BackupDaRotacao) => Promise<boolean>;
}

export interface ResultadoDaRotacao {
  apagados: BackupDaRotacao[];
  /** Não é arquivo comum com nome do SabreHosting dentro da pasta (link, pasta, nome estranho): não foi tocado. */
  ignorados: BackupDaRotacao[];
  falhas: { backup: BackupDaRotacao; erro: Error }[];
}

/** Apaga os arquivos do plano, um por um, depois de conferir de novo que um backup bom sobrevive. */
export async function aplicarRotacao(
  pasta: string,
  plano: PlanoDeRotacao,
  { simular = false, conferir = conferirPacote }: OpcoesAplicar = {},
): Promise<ResultadoDaRotacao> {
  const nomesMantidos = new Set(plano.manter.map((b) => b.nome));
  const bonsMantidos = plano.manter.filter((b) => b.estado === "bom").sort(maisRecenteDireto);
  if (
    bonsMantidos.length === 0 ||
    plano.apagar.some((b) => nomesMantidos.has(b.nome) || b.estado === "nao-conferido")
  ) {
    throw new Error(
      "O plano de rotação está incoerente (ele apagaria o que deve ficar); não apaguei nada.",
    );
  }

  const resultado: ResultadoDaRotacao = { apagados: [], ignorados: [], falhas: [] };
  const alvos: BackupDaRotacao[] = [];
  for (const b of plano.apagar) {
    ((await ehArquivoDoSabre(pasta, b.nome)) ? alvos : resultado.ignorados).push(b);
  }
  if (simular) return { ...resultado, apagados: alvos };

  let confirmado = false;
  for (const b of bonsMantidos) {
    // Um link ou arquivo fora do padrão não conta como o bom que fica: `abrirPacote` seguiria o link.
    if (!(await ehArquivoDoSabre(pasta, b.nome))) continue;
    if (await conferir(pasta, b)) {
      confirmado = true;
      break;
    }
  }
  if (!confirmado) {
    throw new Error(
      "Nenhum backup bom passou na conferência de agora; não apaguei nada para não ficar sem backup.",
    );
  }

  for (const b of alvos) {
    try {
      await rm(join(pasta, b.nome));
      resultado.apagados.push(b);
    } catch (erro) {
      resultado.falhas.push({ backup: b, erro: erro as Error });
    }
  }
  return resultado;
}
