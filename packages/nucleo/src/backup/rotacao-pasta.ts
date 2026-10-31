/**
 * Rotação de uma pasta de backups de verdade (appmel-1.11): junta a lista da pasta com as marcas bom/ruim que o app
 * guarda, planeja (`planejarRotacao`) e apaga (`aplicarRotacao`, que reconfere um bom antes de apagar).
 *
 * As marcas ficam num arquivo AO LADO da pasta (nunca dentro do pacote fechado, regra de ouro 3). Arquivo lido do
 * disco é entrada não confiável (S-07): entrada torta é descartada, e mesmo uma marca adulterada nunca faz apagar além
 * do plano seguro, porque o último bom é conferido de novo na hora e sem marca o backup é "não-conferido" (sempre fica).
 */
import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import { basename, dirname, join } from "node:path";
import {
  NOME_DE_BACKUP,
  RECENTES_PADRAO,
  aplicarRotacao,
  conferirPacote,
  planejarRotacao,
  type BackupDaRotacao,
  type ResultadoDaRotacao,
} from "./rotacao.js";

export type EstadoMarcado = "bom" | "ruim";
export interface Marca {
  estado: EstadoMarcado;
  sha256: string;
}
export type Marcas = Map<string, Marca>;

/** O arquivo de marcas fica ao lado da pasta de backups: `<pasta>.marcas.json`. */
export const arquivoDeMarcas = (pastaBackups: string): string =>
  join(dirname(pastaBackups), `${basename(pastaBackups)}.marcas.json`);

/** Lê as marcas; arquivo ausente, ilegível ou torto vale como "sem marca" (nada é apagado por causa dele). */
export function lerMarcas(arquivo: string): Marcas {
  const marcas: Marcas = new Map();
  let lido: unknown;
  try {
    lido = JSON.parse(readFileSync(arquivo, "utf8"));
  } catch {
    return marcas;
  }
  const bruto = (lido as { marcas?: unknown } | null)?.marcas;
  if (typeof bruto !== "object" || bruto === null || Array.isArray(bruto)) return marcas;
  for (const [nome, m] of Object.entries(bruto)) {
    const { estado, sha256 } = (m ?? {}) as Record<string, unknown>;
    if (!NOME_DE_BACKUP.test(nome)) continue;
    if (estado !== "bom" && estado !== "ruim") continue;
    if (typeof sha256 !== "string" || !/^[0-9a-f]{64}$/.test(sha256)) continue;
    marcas.set(nome, { estado, sha256 });
  }
  return marcas;
}

/** Troca atômica (regra de ouro 3): escreve num temporário e só então renomeia. */
export function gravarMarcas(arquivo: string, marcas: Marcas): void {
  mkdirSync(dirname(arquivo), { recursive: true });
  const temporario = `${arquivo}.tmp`;
  writeFileSync(
    temporario,
    JSON.stringify({ versao: 1, marcas: Object.fromEntries(marcas) }, null, 2),
  );
  renameSync(temporario, arquivo);
}

/** Marca um backup. Só "bom" depois de o pacote já ter sido conferido por hash (`criarPacote` confere). */
export function marcarBackup(
  pastaBackups: string,
  nome: string,
  estado: EstadoMarcado,
  sha256: string,
): void {
  const arquivo = arquivoDeMarcas(pastaBackups);
  const marcas = lerMarcas(arquivo);
  marcas.set(nome, { estado, sha256 });
  gravarMarcas(arquivo, marcas);
}

/** `2026-10-30T14-05-09-123Z-v1.tar.gz` → data. Nome fora do padrão ou data impossível: `undefined`. */
function dataDoNome(nome: string): Date | undefined {
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z-v\d+\.tar\.gz$/.exec(nome);
  if (!m) return undefined;
  const data = new Date(`${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z`);
  return Number.isNaN(data.getTime()) ? undefined : data;
}

export interface OpcoesRotacaoPasta {
  /** Configurações › Backups › Quantos guardar. */
  recentes?: number;
  agora: Date;
  conferir?: (pasta: string, backup: BackupDaRotacao) => Promise<boolean>;
}

/**
 * Uma rotação. Erro (lista torta, nenhum bom passou na conferência de agora) é lançado SEM apagar nada; quem chama
 * transforma em aviso. Backup sem marca é "não-conferido" e nunca sai.
 */
export async function rotacionarPasta(
  pastaBackups: string,
  { recentes = RECENTES_PADRAO, agora, conferir = conferirPacote }: OpcoesRotacaoPasta,
): Promise<ResultadoDaRotacao> {
  const arquivo = arquivoDeMarcas(pastaBackups);
  const marcas = lerMarcas(arquivo);
  const nomes = await readdir(pastaBackups).catch((e: NodeJS.ErrnoException) => {
    if (e.code === "ENOENT") return [];
    throw e;
  });
  const lista: BackupDaRotacao[] = [];
  for (const nome of nomes) {
    const data = dataDoNome(nome);
    if (!data) continue; // fora do padrão do Sabre: não é da rotação
    const m = marcas.get(nome);
    lista.push(
      m
        ? { nome, data, estado: m.estado, sha256: m.sha256 }
        : { nome, data, estado: "nao-conferido" },
    );
  }

  const plano = planejarRotacao(lista, { recentes, agora });
  const vazio: ResultadoDaRotacao = { apagados: [], ignorados: [], falhas: [] };
  if (plano.apagar.length === 0) return vazio;

  // Só vira "ruim" o que falhou na conferência de agora (o pacote não abre mais); o hash da marca segue o mesmo.
  const conferirEMarcar = async (pasta: string, b: BackupDaRotacao): Promise<boolean> => {
    const ok = await conferir(pasta, b);
    if (!ok && b.sha256 !== undefined) marcarBackup(pastaBackups, b.nome, "ruim", b.sha256);
    return ok;
  };
  const resultado = await aplicarRotacao(pastaBackups, plano, { conferir: conferirEMarcar });

  // Poda: marca de arquivo que já não existe não serve para nada.
  const apagados = new Set(resultado.apagados.map((b) => b.nome));
  const atuais = lerMarcas(arquivo);
  let mudou = false;
  for (const nome of apagados) mudou = atuais.delete(nome) || mudou;
  if (mudou) gravarMarcas(arquivo, atuais);
  return resultado;
}
