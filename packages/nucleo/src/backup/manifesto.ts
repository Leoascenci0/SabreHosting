/**
 * Manifesto do mundo: lista de cada arquivo (caminho, tamanho, SHA-256) para comparar versões.
 *
 * Este módulo SÓ LÊ a pasta do mundo (regra de ouro 2). Quem chama é responsável por garantir que o servidor não
 * está escrevendo (`save-off` + `save-all flush`, feito no bkp-1.3). Os arquivos são lidos em fluxo, um por vez.
 * Pastas vazias não entram no manifesto (o Minecraft recria as que precisa).
 */
import { lstat, opendir } from "node:fs/promises";
import { join } from "node:path";
import { hashComTamanho } from "../integridade/hash.js";

export interface ArquivoDoManifesto {
  caminho: string;
  tamanho: number;
  sha256: string;
}

export interface Manifesto {
  formato: 1;
  versao: number;
  epoca: number;
  criadoEm: string;
  arquivos: ArquivoDoManifesto[];
}

export interface OpcoesManifesto {
  versao: number;
  epoca: number;
  agora?: Date;
  /** Recebe os avisos (ex.: link simbólico ignorado). */
  aviso?: (texto: string) => void;
}

export interface Diferenca {
  novos: string[];
  mudados: string[];
  apagados: string[];
}

const IGNORADOS = new Set(["session.lock"]);
const SHA256 = /^[0-9a-f]{64}$/;

/** Limites do manifesto (decididos pela Máxima, reversíveis): o Windows tem teto de caminho e o sync lê tudo na RAM. */
const MAX_ARQUIVOS = 200_000;
const MAX_PROFUNDIDADE = 32;
const MAX_CAMINHO = 240;

const RESERVADO_WINDOWS = /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$)$/i;
const PROIBIDO_WINDOWS = /[<>:"|?*\u0000-\u001f]/;

/** Mesmo tom para o amigo, na hora de gerar e na de conferir: qual arquivo e o que fazer. */
function recusaArquivo(motivo: string): Error {
  return new Error(`${motivo} Renomeie ou apague esse arquivo no mundo e tente de novo.`);
}

async function* percorrer(
  raiz: string,
  relativo: string,
  aviso: (texto: string) => void,
): AsyncGenerator<string> {
  const dir = await opendir(join(raiz, relativo));
  for await (const entrada of dir) {
    const caminho = relativo ? `${relativo}/${entrada.name}` : entrada.name;
    if (entrada.isSymbolicLink()) {
      aviso(`Link simbólico ignorado no mundo: ${caminho}`);
    } else if (entrada.isDirectory()) {
      yield* percorrer(raiz, caminho, aviso);
    } else if (entrada.isFile()) {
      if (!IGNORADOS.has(entrada.name)) yield caminho;
    } else {
      aviso(`Arquivo especial ignorado no mundo (não é arquivo comum): ${caminho}`);
    }
  }
}

const MUDOU = "O mundo mudou durante a leitura; o servidor ainda está gravando?";

/** Tamanho e hash vêm da mesma leitura; se o arquivo sumiu ou cresceu/encolheu no meio, recusa. */
async function lerArquivo(caminho: string, completo: string): Promise<ArquivoDoManifesto> {
  try {
    const { size } = await lstat(completo);
    const { hash, tamanho } = await hashComTamanho(completo);
    if (tamanho !== size) throw new Error(MUDOU);
    return { caminho, tamanho, sha256: hash };
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === "ENOENT") throw new Error(MUDOU, { cause: erro });
    throw erro;
  }
}

export async function gerarManifesto(
  pastaDoMundo: string,
  { versao, epoca, agora = new Date(), aviso = () => undefined }: OpcoesManifesto,
): Promise<Manifesto> {
  const arquivos: ArquivoDoManifesto[] = [];
  for await (const caminho of percorrer(pastaDoMundo, "", aviso)) {
    if (!caminhoSeguro(caminho)) {
      throw recusaArquivo(
        `O arquivo "${caminho}" tem um nome que o Windows não aceita (caminho inseguro).`,
      );
    }
    const completo = join(pastaDoMundo, caminho);
    arquivos.push(await lerArquivo(caminho, completo));
  }
  arquivos.sort((a, b) => (a.caminho < b.caminho ? -1 : a.caminho > b.caminho ? 1 : 0));
  return validarManifesto({ formato: 1, versao, epoca, criadoEm: agora.toISOString(), arquivos });
}

/** Caminho que qualquer PC (Windows incluso) consegue extrair sem escapar da pasta do mundo. */
function caminhoSeguro(caminho: unknown): caminho is string {
  if (typeof caminho !== "string" || caminho === "") return false;
  if (caminho.includes("\\") || caminho.startsWith("/") || /^[a-zA-Z]:/.test(caminho)) return false;
  return caminho
    .split("/")
    .every(
      (parte) =>
        parte !== "" &&
        parte !== "." &&
        parte !== ".." &&
        !PROIBIDO_WINDOWS.test(parte) &&
        !/[. ]$/.test(parte) &&
        !RESERVADO_WINDOWS.test((parte.split(".")[0] ?? "").trimEnd()),
    );
}

/** Confere um manifesto vindo de fora (rede, disco). Lança erro em pt-BR se algo não for seguro. */
export function validarManifesto(bruto: unknown): Manifesto {
  const m = bruto as Partial<Manifesto> | null;
  if (typeof m !== "object" || m === null || m.formato !== 1 || !Array.isArray(m.arquivos)) {
    throw new Error("Manifesto do mundo inválido ou de formato desconhecido.");
  }
  if (!Number.isInteger(m.versao) || !Number.isInteger(m.epoca) || typeof m.criadoEm !== "string") {
    throw new Error("Manifesto do mundo sem versão, época ou data.");
  }
  if (m.arquivos.length > MAX_ARQUIVOS) {
    throw new Error(`Manifesto recusado: arquivos demais (mais de ${MAX_ARQUIVOS}).`);
  }
  const vistos = new Set<string>();
  const vistosMinusculos = new Set<string>();
  const arquivos: ArquivoDoManifesto[] = [];
  for (const a of m.arquivos as Partial<ArquivoDoManifesto>[]) {
    if (!caminhoSeguro(a?.caminho)) {
      throw recusaArquivo(
        `O arquivo ${JSON.stringify(a?.caminho)} tem um nome que o Windows não aceita (caminho inseguro).`,
      );
    }
    if (a.caminho.length > MAX_CAMINHO) {
      throw recusaArquivo(
        `O arquivo "${a.caminho}" tem um caminho longo demais (máximo ${MAX_CAMINHO} caracteres).`,
      );
    }
    if (a.caminho.split("/").length > MAX_PROFUNDIDADE) {
      throw recusaArquivo(
        `O arquivo "${a.caminho}" está fundo demais (profundidade máxima ${MAX_PROFUNDIDADE} pastas).`,
      );
    }
    const minusculo = a.caminho.toLowerCase();
    if (vistos.has(a.caminho)) {
      throw recusaArquivo(`O arquivo "${a.caminho}" aparece duas vezes (caminho repetido).`);
    }
    if (vistosMinusculos.has(minusculo)) {
      throw recusaArquivo(
        `O arquivo "${a.caminho}" só difere de outro na maiúscula; o Windows os trata como o mesmo arquivo.`,
      );
    }
    vistos.add(a.caminho);
    vistosMinusculos.add(minusculo);
    if (
      !Number.isSafeInteger(a.tamanho) ||
      (a.tamanho as number) < 0 ||
      typeof a.sha256 !== "string" ||
      !SHA256.test(a.sha256)
    ) {
      throw new Error(`Manifesto recusado: tamanho ou hash inválido em ${a.caminho}.`);
    }
    arquivos.push({ caminho: a.caminho, tamanho: a.tamanho as number, sha256: a.sha256 });
  }
  return {
    formato: 1,
    versao: m.versao as number,
    epoca: m.epoca as number,
    criadoEm: m.criadoEm as string,
    arquivos,
  };
}

/** O que mudou de `a` (antes) para `b` (depois). Base do delta. */
export function compararManifestos(a: Manifesto, b: Manifesto): Diferenca {
  const antes = new Map(a.arquivos.map((f) => [f.caminho, f.sha256]));
  const depois = new Map(b.arquivos.map((f) => [f.caminho, f.sha256]));
  return {
    novos: [...depois.keys()].filter((c) => !antes.has(c)),
    mudados: [...depois].filter(([c, h]) => antes.has(c) && antes.get(c) !== h).map(([c]) => c),
    apagados: [...antes.keys()].filter((c) => !depois.has(c)),
  };
}
