import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const TAMANHO_REGIAO = 256 * 1024;
const MB = 1024 * 1024;
const MBS = { "1MB": MB, "20MB": 20 * MB, "200MB": 200 * MB } as const;

export type TamanhoDeMundo = keyof typeof MBS;

function sha256(dados: string | Buffer): Buffer {
  return createHash("sha256").update(dados).digest();
}

/** Bytes falsos, mas sempre os mesmos para a mesma chave: SHA-256 encadeado. */
function bytesDeterministicos(chave: string, tamanho: number): Buffer {
  const saida = Buffer.alloc(tamanho);
  let bloco = sha256(chave);
  for (let i = 0; i < tamanho; i += bloco.length) {
    bloco.copy(saida, i, 0, Math.min(bloco.length, tamanho - i));
    bloco = sha256(bloco);
  }
  return saida;
}

/** Mundo falso de teste. Sem `pasta`, vai para uma pasta temporária do sistema (fora do git). */
export function gerarMundo(opcoes: {
  tamanho: TamanhoDeMundo;
  semente?: string;
  pasta?: string;
}): string {
  const { tamanho, semente = "sabre" } = opcoes;
  if (tamanho === "200MB" && process.env["SABRE_MUNDO_GRANDE"] !== "1") {
    throw new Error("Mundo de 200 MB só sob pedido: defina SABRE_MUNDO_GRANDE=1.");
  }
  const pasta = opcoes.pasta ?? mkdtempSync(join(tmpdir(), "sabre-mundo-"));
  mkdirSync(join(pasta, "region"), { recursive: true });
  writeFileSync(join(pasta, "level.dat"), bytesDeterministicos(`${semente}/level.dat`, 1024));
  const regioes = MBS[tamanho] / TAMANHO_REGIAO;
  for (let i = 0; i < regioes; i++) {
    const nome = `r.${i % 8}.${Math.floor(i / 8)}.mca`;
    writeFileSync(
      join(pasta, "region", nome),
      bytesDeterministicos(`${semente}/${nome}`, TAMANHO_REGIAO),
    );
  }
  return pasta;
}

/** SHA-256 de cada arquivo do mundo, com caminho relativo (ex.: "region/r.0.0.mca"). */
export function hashesDoMundo(pasta: string): Record<string, string> {
  const hashes: Record<string, string> = {};
  for (const entrada of readdirSync(pasta, { recursive: true, withFileTypes: true })) {
    if (!entrada.isFile()) continue;
    const completo = join(entrada.parentPath, entrada.name);
    const relativo = completo.slice(pasta.length + 1).replaceAll("\\", "/");
    hashes[relativo] = sha256(readFileSync(completo)).toString("hex");
  }
  return hashes;
}

function regioesDoMundo(pasta: string): string[] {
  return readdirSync(join(pasta, "region"))
    .filter((nome) => nome.endsWith(".mca"))
    .sort()
    .map((nome) => `region/${nome}`);
}

/** Reescreve as `n` primeiras regiões com outros bytes (mesmo tamanho). Devolve os caminhos mudados. */
export function mudarRegioes(pasta: string, n: number): string[] {
  const mudadas = regioesDoMundo(pasta).slice(0, n);
  for (const arquivo of mudadas) {
    writeFileSync(join(pasta, arquivo), bytesDeterministicos(`mudou/${arquivo}`, TAMANHO_REGIAO));
  }
  return mudadas;
}

/** Estraga 16 bytes do meio de 1 arquivo (padrão: a primeira região), sem mudar o tamanho. */
export function corromperArquivo(pasta: string, arquivo = regioesDoMundo(pasta)[0]): string {
  if (arquivo === undefined) throw new Error("Mundo sem regiões para corromper.");
  const dados = readFileSync(join(pasta, arquivo));
  const meio = Math.floor(dados.length / 2);
  for (let i = meio; i < meio + 16; i++) dados[i] = (dados[i] ?? 0) ^ 0xff;
  writeFileSync(join(pasta, arquivo), dados);
  return arquivo;
}
