import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { crc32 } from "node:zlib";

/**
 * Instância do grupo para o Prism, como pacote `.mrpack` (formato público do Modrinth: um zip com
 * `modrinth.index.json`). O Prism só precisa importar o arquivo; nada do Prism é copiado.
 */
export interface EntradaInstancia {
  /** Nome do grupo, como o amigo vê. */
  grupo: string;
  versaoMinecraft: string;
  versaoNeoForge: string;
  /** Mods do grupo; o download vem no lanc-1.4, por isso entra vazio. */
  mods: readonly never[];
}

export interface IndiceMrpack {
  formatVersion: 1;
  game: "minecraft";
  versionId: string;
  name: string;
  files: never[];
  dependencies: { minecraft: string; neoforge: string };
}

export interface InstanciaMontada {
  nomeArquivo: string;
  indice: IndiceMrpack;
  bytes: Buffer;
}

const MAX_NOME = 64;
const PROIBIDO_WINDOWS = /[<>:"/\\|?*\u0000-\u001f]/g;
const RESERVADO_WINDOWS = /^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³]|conin\$|conout\$)$/i;
const VERSAO_OK = /^[0-9A-Za-z][0-9A-Za-z.+-]*$/;
const PASTA_SABRE = "SabreHosting";

/** Nome do grupo como nome de arquivo do Windows (mesmas regras do manifesto do mundo). */
export function nomeSeguroDoGrupo(grupo: string): string {
  let nome = grupo.replace(PROIBIDO_WINDOWS, "").replace(/\s+/g, " ").trim();
  nome = nome.slice(0, MAX_NOME).replace(/[. ]+$/, "");
  if (nome === "") {
    throw new Error(
      "O nome do grupo não pode ficar vazio nem ter só caracteres que o Windows não aceita.",
    );
  }
  return RESERVADO_WINDOWS.test(nome.split(".")[0]?.trimEnd() ?? "") ? `${nome}_` : nome;
}

function conferirVersao(rotulo: string, valor: string): void {
  if (!VERSAO_OK.test(valor)) {
    throw new Error(
      `A versão do ${rotulo} ("${valor}") não é válida. Atualize os dados do grupo no cartório.`,
    );
  }
}

/** Zip sem compressão (método 0): suficiente para um índice de poucos KB e não exige dependência. */
function zipSemCompressao(nome: string, conteudo: Buffer): Buffer {
  const n = Buffer.from(nome, "utf8");
  const crc = crc32(conteudo);
  // Data fixa (1980-01-01) para o pacote ser idêntico a cada geração.
  const hora = 0;
  const data = (0 << 9) | (1 << 5) | 1;
  const local = Buffer.alloc(30);
  local.writeUInt32LE(0x04034b50, 0);
  local.writeUInt16LE(20, 4);
  local.writeUInt16LE(0x0800, 6); // nome em UTF-8
  local.writeUInt16LE(hora, 10);
  local.writeUInt16LE(data, 12);
  local.writeUInt32LE(crc, 14);
  local.writeUInt32LE(conteudo.length, 18);
  local.writeUInt32LE(conteudo.length, 22);
  local.writeUInt16LE(n.length, 26);
  const central = Buffer.alloc(46);
  central.writeUInt32LE(0x02014b50, 0);
  central.writeUInt16LE(20, 4);
  local.copy(central, 6, 4, 30); // versão, flags, método, hora, data, crc, tamanhos, nome
  central.writeUInt32LE(0, 42); // posição da entrada local
  const inicioCentral = local.length + n.length + conteudo.length;
  const fim = Buffer.alloc(22);
  fim.writeUInt32LE(0x06054b50, 0);
  fim.writeUInt16LE(1, 8);
  fim.writeUInt16LE(1, 10);
  fim.writeUInt32LE(central.length + n.length, 12);
  fim.writeUInt32LE(inicioCentral, 16);
  return Buffer.concat([local, n, conteudo, central, n, fim]);
}

/** Pura: devolve o conteúdo do pacote da instância "SabreHosting — <grupo>". */
export function montarInstancia(entrada: EntradaInstancia): InstanciaMontada {
  conferirVersao("Minecraft", entrada.versaoMinecraft);
  conferirVersao("NeoForge", entrada.versaoNeoForge);
  const nomeArquivo = `${nomeSeguroDoGrupo(entrada.grupo)}.mrpack`;
  const exibido = entrada.grupo
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const indice: IndiceMrpack = {
    formatVersion: 1,
    game: "minecraft",
    versionId: `${entrada.versaoMinecraft}-${entrada.versaoNeoForge}`,
    name: `SabreHosting — ${exibido}`,
    files: [],
    dependencies: { minecraft: entrada.versaoMinecraft, neoforge: entrada.versaoNeoForge },
  };
  const bytes = zipSemCompressao(
    "modrinth.index.json",
    Buffer.from(JSON.stringify(indice, null, 2), "utf8"),
  );
  return { nomeArquivo, indice, bytes };
}

/**
 * Grava `<pastaDestino>/SabreHosting/<grupo>.mrpack` por arquivo temporário + renomear. Só mexe no arquivo do
 * próprio grupo; conteúdo igual ao que já está lá não é regravado.
 */
export async function gravarInstancia(
  entrada: EntradaInstancia & { pastaDestino: string },
): Promise<{ caminho: string; alterado: boolean }> {
  const { nomeArquivo, bytes } = montarInstancia(entrada);
  const pasta = join(entrada.pastaDestino, PASTA_SABRE);
  const caminho = join(pasta, nomeArquivo);
  const atual = await readFile(caminho).catch(() => null);
  if (atual?.equals(bytes)) return { caminho, alterado: false };
  await mkdir(pasta, { recursive: true });
  const temporario = `${caminho}.${process.pid}.tmp`;
  try {
    await writeFile(temporario, bytes);
    await rename(temporario, caminho);
  } catch (erro) {
    await rm(temporario, { force: true });
    throw erro;
  }
  return { caminho, alterado: true };
}
