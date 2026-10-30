/**
 * Manifesto do mundo: lista de cada arquivo (caminho, tamanho, SHA-256) para comparar versões.
 *
 * Este módulo SÓ LÊ a pasta do mundo (regra de ouro 2). Quem chama é responsável por garantir que o servidor não
 * está escrevendo (`save-off` + `save-all flush`, feito no bkp-1.3). Os arquivos são lidos em fluxo, um por vez.
 */
import { lstat, opendir } from "node:fs/promises";
import { join } from "node:path";
import { hashDoArquivo } from "../integridade/hash.js";

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
    } else if (entrada.isFile() && !IGNORADOS.has(entrada.name)) {
      yield caminho;
    }
  }
}

export async function gerarManifesto(
  pastaDoMundo: string,
  { versao, epoca, agora = new Date(), aviso = () => undefined }: OpcoesManifesto,
): Promise<Manifesto> {
  const arquivos: ArquivoDoManifesto[] = [];
  for await (const caminho of percorrer(pastaDoMundo, "", aviso)) {
    const completo = join(pastaDoMundo, caminho);
    const { size } = await lstat(completo);
    arquivos.push({ caminho, tamanho: size, sha256: await hashDoArquivo(completo) });
  }
  arquivos.sort((a, b) => (a.caminho < b.caminho ? -1 : a.caminho > b.caminho ? 1 : 0));
  return { formato: 1, versao, epoca, criadoEm: agora.toISOString(), arquivos };
}

function caminhoSeguro(caminho: unknown): caminho is string {
  if (typeof caminho !== "string" || caminho === "") return false;
  if (caminho.includes("\\") || caminho.includes("\0")) return false;
  if (caminho.startsWith("/") || /^[a-zA-Z]:/.test(caminho)) return false;
  return caminho.split("/").every((parte) => parte !== "" && parte !== "." && parte !== "..");
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
  const vistos = new Set<string>();
  for (const a of m.arquivos as Partial<ArquivoDoManifesto>[]) {
    if (!caminhoSeguro(a?.caminho)) {
      throw new Error(`Manifesto recusado: caminho inseguro (${JSON.stringify(a?.caminho)}).`);
    }
    if (vistos.has(a.caminho))
      throw new Error(`Manifesto recusado: caminho repetido (${a.caminho}).`);
    vistos.add(a.caminho);
    if (!Number.isInteger(a.tamanho) || (a.tamanho as number) < 0 || !SHA256.test(a.sha256 ?? "")) {
      throw new Error(`Manifesto recusado: tamanho ou hash inválido em ${a.caminho}.`);
    }
  }
  return m as Manifesto;
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
