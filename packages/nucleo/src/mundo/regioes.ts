import { open, lstat, opendir } from "node:fs/promises";
import { join } from "node:path";

export type Dimensao = "overworld" | "nether" | "end";
export type TipoDeRegiao = "region" | "entities" | "poi";

export interface RegiaoLida {
  tipo: TipoDeRegiao;
  /** Caminho relativo à pasta do mundo, com "/" (ex.: "DIM-1/region/r.0.0.mca"). */
  arquivo: string;
  x: number;
  z: number;
  /** Tamanho em disco, em bytes. */
  tamanho: number;
  /** Chunks presentes, como índice 0..1023 da tabela do cabeçalho (índice = (x & 31) + (z & 31) * 32), em ordem. */
  chunks: number[];
  /** Setores de 4 KiB de cada chunk de `chunks` (mesma ordem): o que o Minecraft pode reaproveitar se o chunk sair. */
  setoresDosChunks: number[];
}

export interface OpcoesListarRegioes {
  aviso?: (texto: string) => void;
}

const PASTA_DA_DIMENSAO: Record<Dimensao, string> = { overworld: "", nether: "DIM-1", end: "DIM1" };
const TIPOS: TipoDeRegiao[] = ["region", "entities", "poi"];
const NOME_REGIAO = /^r\.(0|-?[1-9]\d{0,8})\.(0|-?[1-9]\d{0,8})\.mca$/;
const SETOR = 4096;
/** Só a tabela de posições (1024 entradas de 4 bytes); as datas, que vêm depois, não interessam. */
const TAMANHO_TABELA = SETOR;

async function eHPastaReal(caminho: string): Promise<boolean> {
  try {
    return (await lstat(caminho)).isDirectory();
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === "ENOENT") return false;
    throw erro;
  }
}

/** Lê os primeiros 4 KiB e devolve os chunks cujo trecho cabe dentro do arquivo. */
async function lerChunks(
  completo: string,
  tamanho: number,
  rotulo: string,
  aviso: (texto: string) => void,
): Promise<{ chunks: number[]; setoresDosChunks: number[] } | null> {
  if (tamanho < TAMANHO_TABELA) {
    aviso(`Região ignorada (menor que o cabeçalho): ${rotulo}`);
    return null;
  }
  const tabela = Buffer.alloc(TAMANHO_TABELA);
  const arquivo = await open(completo, "r");
  try {
    const { bytesRead } = await arquivo.read(tabela, 0, TAMANHO_TABELA, 0);
    if (bytesRead < TAMANHO_TABELA) {
      aviso(`Região ignorada (cabeçalho incompleto): ${rotulo}`);
      return null;
    }
  } finally {
    await arquivo.close();
  }
  const chunks: number[] = [];
  const setoresDosChunks: number[] = [];
  let fora = 0;
  for (let i = 0; i < 1024; i++) {
    const inicio = tabela.readUIntBE(i * 4, 3);
    const setores = tabela.readUInt8(i * 4 + 3);
    if (inicio === 0 && setores === 0) continue;
    if (inicio >= 2 && setores > 0 && (inicio + setores) * SETOR <= tamanho) {
      chunks.push(i);
      setoresDosChunks.push(setores);
    } else fora++;
  }
  if (fora > 0) aviso(`${fora} chunk(s) com posição inválida ignorado(s) em ${rotulo}`);
  return { chunks, setoresDosChunks };
}

/**
 * Lista as regiões de uma dimensão (region/, entities/, poi/) e, pelo cabeçalho de cada `.mca`, quais
 * chunks existem. Só lê (no máximo 4 KiB por arquivo); ignora link simbólico e nome fora de `r.<x>.<z>.mca`.
 */
export async function listarRegioes(
  pastaDoMundo: string,
  dimensao: Dimensao,
  { aviso = () => undefined }: OpcoesListarRegioes = {},
): Promise<RegiaoLida[]> {
  const base = PASTA_DA_DIMENSAO[dimensao];
  const regioes: RegiaoLida[] = [];
  for (const tipo of TIPOS) {
    const relativoDir = base ? `${base}/${tipo}` : tipo;
    const dirCompleto = join(pastaDoMundo, relativoDir);
    // Cada nível do caminho tem de ser pasta de verdade, nunca link simbólico.
    if (base && !(await eHPastaReal(join(pastaDoMundo, base)))) {
      if (await existeLink(join(pastaDoMundo, base)))
        aviso(`Link simbólico ignorado no mundo: ${base}`);
      break;
    }
    if (!(await eHPastaReal(dirCompleto))) {
      if (await existeLink(dirCompleto)) aviso(`Link simbólico ignorado no mundo: ${relativoDir}`);
      continue;
    }
    const dir = await opendir(dirCompleto);
    const achadas: RegiaoLida[] = [];
    for await (const entrada of dir) {
      const rotulo = `${relativoDir}/${entrada.name}`;
      if (entrada.isSymbolicLink()) {
        aviso(`Link simbólico ignorado no mundo: ${rotulo}`);
        continue;
      }
      const nome = NOME_REGIAO.exec(entrada.name);
      if (!nome || !entrada.isFile()) {
        aviso(`Arquivo fora do padrão r.<x>.<z>.mca ignorado: ${rotulo}`);
        continue;
      }
      const completo = join(dirCompleto, entrada.name);
      // Janela entre este lstat e o open de lerChunks: aceita, porque o servidor está parado (regra de ouro 1)
      // e ninguém troca o arquivo por link simbólico nesse intervalo.
      const { size } = await lstat(completo);
      const lido = await lerChunks(completo, size, rotulo, aviso);
      if (lido === null) continue;
      achadas.push({
        tipo,
        arquivo: rotulo,
        x: Number(nome[1]),
        z: Number(nome[2]),
        tamanho: size,
        chunks: lido.chunks,
        setoresDosChunks: lido.setoresDosChunks,
      });
    }
    achadas.sort((a, b) => a.x - b.x || a.z - b.z);
    regioes.push(...achadas);
  }
  return regioes;
}

async function existeLink(caminho: string): Promise<boolean> {
  try {
    return (await lstat(caminho)).isSymbolicLink();
  } catch {
    return false;
  }
}
