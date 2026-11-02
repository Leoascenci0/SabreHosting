import { lstat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { lerSpawnDoLevelDat } from "../nbt.js";
import { listarRegioes, type Dimensao, type TipoDeRegiao } from "./regioes.js";

/** Limites do mundo do Minecraft: chunk ±1874999 (blocos ±29999984). */
export const LIMITE_CHUNK = 1_874_999;
export const LIMITE_BLOCO = 29_999_984;
/** Acima disto (uma região inteira) o plano exige `confirmado: true`. A tela do app (1.6) lê estes valores. */
export const MAX_CHUNKS_SEM_CONFIRMAR = 1024;
export const MAX_RAIO_SEM_CONFIRMAR = 1000;
const MAX_LEVEL_DAT = 16 * 1024 * 1024;

export type AreaDoReset =
  /** Retângulo em coordenadas de chunk; os dois cantos valem, em qualquer ordem. */
  | { tipo: "retangulo"; x1: number; z1: number; x2: number; z2: number }
  /** Ponto (em blocos) + raio (em blocos): entram os chunks que encostam no círculo. */
  | { tipo: "raio"; x: number; z: number; raio: number };

export interface ArquivoDoPlano {
  tipo: TipoDeRegiao;
  arquivo: string;
  x: number;
  z: number;
  chunksAfetados: number;
  chunksRestantes: number;
  /** Ficou sem chunk nenhum: o arquivo será apagado (e só aí o tamanho em disco é liberado de verdade). */
  apagarArquivo: boolean;
  /** Tamanho do arquivo em bytes; só informado quando ele será apagado. */
  bytesLiberados: number | null;
  /** Setores de 4 KiB que o Minecraft pode reaproveitar (arquivo que fica; zerar o cabeçalho não encolhe o .mca). */
  setoresReaproveitaveis: number;
}

export interface PlanoDeReset {
  dimensao: Dimensao;
  area: AreaDoReset;
  /** Quantos chunks a área cobre (existam ou não). */
  chunksNaArea: number;
  /** Chunks do terreno (pasta region) que existem na área e serão apagados. */
  chunksExistentes: number;
  regioesTocadas: number;
  regioesApagadasInteiras: number;
  arquivos: ArquivoDoPlano[];
  setoresReaproveitaveis: number;
  bytesLiberados: number;
  avisos: string[];
}

export type CodigoDoErroDoPlano = "area-invalida" | "dimensao-invalida" | "confirmacao-necessaria";

const TEXTOS: Record<CodigoDoErroDoPlano, string> = {
  "area-invalida": "Área inválida: confira os números e os limites do mundo.",
  "dimensao-invalida": "Dimensão inválida.",
  "confirmacao-necessaria": "Área grande: é preciso confirmar antes de planejar o reset.",
};

/** Erro de entrada recusada; o texto é fixo (nunca repete o valor recebido). */
export class ErroDoPlanoDeReset extends Error {
  constructor(
    readonly codigo: CodigoDoErroDoPlano,
    /** Só em `confirmacao-necessaria`: quantos chunks a área cobre, para a tela perguntar. */
    readonly chunksNaArea?: number,
  ) {
    super(TEXTOS[codigo]);
    this.name = "ErroDoPlanoDeReset";
  }
}

export interface OpcoesPlanejarReset {
  /** O usuário já viu que a área é grande e quer seguir. */
  confirmado?: boolean;
}

const DIMENSOES: readonly string[] = ["overworld", "nether", "end"];

function inteiro(v: unknown, limite: number): number {
  if (typeof v !== "number" || !Number.isInteger(v) || Math.abs(v) > limite)
    throw new ErroDoPlanoDeReset("area-invalida");
  return v + 0; // normaliza -0 (que JSON e toEqual distinguem de 0)
}

/** Valida a área (entrada não confiável) e devolve uma cópia limpa; retângulo sai com x1≤x2 e z1≤z2. */
function validarArea(bruta: unknown): AreaDoReset {
  if (typeof bruta !== "object" || bruta === null) throw new ErroDoPlanoDeReset("area-invalida");
  const a = bruta as Record<string, unknown>;
  if (a.tipo === "retangulo") {
    const [x1, x2] = [inteiro(a.x1, LIMITE_CHUNK), inteiro(a.x2, LIMITE_CHUNK)];
    const [z1, z2] = [inteiro(a.z1, LIMITE_CHUNK), inteiro(a.z2, LIMITE_CHUNK)];
    return {
      tipo: "retangulo",
      x1: Math.min(x1, x2),
      z1: Math.min(z1, z2),
      x2: Math.max(x1, x2),
      z2: Math.max(z1, z2),
    };
  }
  if (a.tipo === "raio") {
    const raio = inteiro(a.raio, LIMITE_BLOCO);
    if (raio < 1) throw new ErroDoPlanoDeReset("area-invalida");
    return { tipo: "raio", x: inteiro(a.x, LIMITE_BLOCO), z: inteiro(a.z, LIMITE_BLOCO), raio };
  }
  throw new ErroDoPlanoDeReset("area-invalida");
}

const distancia = (ponto: number, chunk: number): number =>
  Math.max(0, chunk * 16 - ponto, ponto - (chunk * 16 + 15));

function raizInteira(n: number): number {
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
}

const clamp = (v: number): number => Math.max(-LIMITE_CHUNK, Math.min(LIMITE_CHUNK, v));

export function chunkNaArea(area: AreaDoReset, cx: number, cz: number): boolean {
  if (area.tipo === "retangulo")
    return cx >= area.x1 && cx <= area.x2 && cz >= area.z1 && cz <= area.z2;
  return distancia(area.x, cx) ** 2 + distancia(area.z, cz) ** 2 <= area.raio ** 2;
}

/** Conta os chunks da área por fórmula (uma conta por coluna), sem olhar o disco. */
function contarChunksNaArea(area: AreaDoReset): number {
  if (area.tipo === "retangulo") return (area.x2 - area.x1 + 1) * (area.z2 - area.z1 + 1);
  let total = 0;
  const r2 = area.raio ** 2;
  for (
    let cx = clamp(Math.floor((area.x - area.raio) / 16));
    cx <= clamp(Math.floor((area.x + area.raio) / 16));
    cx++
  ) {
    const dz = raizInteira(r2 - distancia(area.x, cx) ** 2);
    const baixo = clamp(Math.floor((area.z - dz) / 16));
    const alto = clamp(Math.floor((area.z + dz) / 16));
    if (alto >= baixo) total += alto - baixo + 1;
  }
  return total;
}

async function lerSpawn(pastaDoMundo: string): Promise<{ x: number; z: number } | null> {
  try {
    const caminho = join(pastaDoMundo, "level.dat");
    const st = await lstat(caminho);
    if (!st.isFile() || st.size > MAX_LEVEL_DAT) return null;
    return lerSpawnDoLevelDat(await readFile(caminho), { maxBytes: MAX_LEVEL_DAT });
  } catch {
    return null;
  }
}

/**
 * Prévia do reset: diz o que seria apagado numa dimensão e área, SEM escrever nada. Lê só os cabeçalhos dos `.mca`
 * (via `listarRegioes`) e o `level.dat` (ponto de nascimento); testa cada chunk existente contra a área, sem
 * percorrer a área inteira. Recusa valor torto e área grande sem `confirmado`.
 */
export async function planejarReset(
  pastaDoMundo: string,
  dimensao: Dimensao,
  areaBruta: unknown,
  { confirmado = false }: OpcoesPlanejarReset = {},
): Promise<PlanoDeReset> {
  if (typeof dimensao !== "string" || !DIMENSOES.includes(dimensao))
    throw new ErroDoPlanoDeReset("dimensao-invalida");
  const area = validarArea(areaBruta);
  const chunksNaArea = contarChunksNaArea(area);
  const grande =
    chunksNaArea > MAX_CHUNKS_SEM_CONFIRMAR ||
    (area.tipo === "raio" && area.raio > MAX_RAIO_SEM_CONFIRMAR);
  if (grande && !confirmado) throw new ErroDoPlanoDeReset("confirmacao-necessaria", chunksNaArea);

  const avisos: string[] = [];
  const regioes = await listarRegioes(pastaDoMundo, dimensao, { aviso: (t) => avisos.push(t) });
  const arquivos: ArquivoDoPlano[] = [];
  const tocadas = new Set<string>();
  let chunksExistentes = 0;
  for (const r of regioes) {
    let afetados = 0;
    let setores = 0;
    r.chunks.forEach((indice, i) => {
      if (!chunkNaArea(area, r.x * 32 + (indice & 31), r.z * 32 + (indice >> 5))) return;
      afetados++;
      setores += r.setoresDosChunks[i] as number;
    });
    if (afetados === 0) continue;
    if (r.tipo === "region") chunksExistentes += afetados;
    tocadas.add(`${r.x},${r.z}`);
    const apagar = afetados === r.chunks.length;
    arquivos.push({
      tipo: r.tipo,
      arquivo: r.arquivo,
      x: r.x,
      z: r.z,
      chunksAfetados: afetados,
      chunksRestantes: r.chunks.length - afetados,
      apagarArquivo: apagar,
      bytesLiberados: apagar ? r.tamanho : null,
      setoresReaproveitaveis: apagar ? 0 : setores,
    });
  }

  const apagados = arquivos.filter((a) => a.apagarArquivo);
  const regioesApagadasInteiras = new Set(apagados.map((a) => `${a.x},${a.z}`)).size;
  if (chunksExistentes === 0 && arquivos.length === 0)
    avisos.push("Nenhum chunk existe nessa área: nada mudaria.");
  if (apagados.length > 0)
    avisos.push(
      `${apagados.length} arquivo(s) de região ficariam vazios e seriam apagados por inteiro.`,
    );
  if (dimensao === "overworld") {
    const spawn = await lerSpawn(pastaDoMundo);
    if (spawn === null)
      avisos.push(
        "Não deu para conferir o ponto de nascimento (level.dat ilegível); confira antes de resetar.",
      );
    else if (chunkNaArea(area, Math.floor(spawn.x / 16), Math.floor(spawn.z / 16)))
      avisos.push("A área inclui o ponto de nascimento do mundo.");
  }

  return {
    dimensao,
    area,
    chunksNaArea,
    chunksExistentes,
    regioesTocadas: tocadas.size,
    regioesApagadasInteiras,
    arquivos,
    setoresReaproveitaveis: arquivos.reduce((s, a) => s + a.setoresReaproveitaveis, 0),
    bytesLiberados: apagados.reduce((s, a) => s + (a.bytesLiberados as number), 0),
    avisos,
  };
}
