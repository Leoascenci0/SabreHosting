import { createWriteStream } from "node:fs";
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { dirname, join } from "node:path";
import { pipeline } from "node:stream/promises";
import yauzl, { type Entry, type ZipFile } from "yauzl";
import { caminhoSeguro } from "../backup/manifesto.js";

/**
 * Extrai o zip do Java baixado (lanc-2.3 / lancmel-2.6). O zip já veio com hash conferido, mas o conteúdo ainda é
 * entrada não confiável: recusa `..`, caminho absoluto, `\` e link simbólico (zip slip) pela mesma regra do mundo
 * (`caminhoSeguro`). Extrai numa pasta temporária ao lado e só renomeia no fim (regra 3): falha no meio não deixa
 * pasta pela metade, e quem já tem a pasta pronta (`.java.json`) não extrai de novo.
 */
const MAX_ENTRADAS = 20_000;
const MAX_BYTES = 1024 * 1024 ** 2;
const MARCADOR = ".java.json";
const JAVAW = /^[^/]+\/bin\/javaw\.exe$|^bin\/javaw\.exe$/i;

const recusa = (m: string) => new Error(`Zip do Java recusado: ${m} Nada foi extraído.`);
const ehLink = (e: Entry) => ((e.externalFileAttributes >>> 16) & 0o170000) === 0o120000;

export async function extrairJava(zip: string, pasta: string): Promise<{ javaw: string }> {
  try {
    const { javaw } = JSON.parse(await readFile(join(pasta, MARCADOR), "utf8")) as {
      javaw: unknown;
    };
    if (caminhoSeguro(javaw)) return { javaw: join(pasta, ...javaw.split("/")) };
  } catch {
    // ainda não extraído
  }
  const temp = `${pasta}.${process.pid}.${randomBytes(6).toString("hex")}.extraindo`;
  try {
    await mkdir(temp, { recursive: true });
    const relativo = await extrairPara(zip, temp);
    await writeFile(join(temp, MARCADOR), JSON.stringify({ javaw: relativo }));
    await rm(pasta, { recursive: true, force: true }); // restos de uma extração antiga, sem marcador
    await rename(temp, pasta);
    return { javaw: join(pasta, ...relativo.split("/")) };
  } finally {
    await rm(temp, { recursive: true, force: true });
  }
}

async function extrairPara(zip: string, temp: string): Promise<string> {
  const z: ZipFile = await new Promise((ok, falha) =>
    yauzl.open(
      zip,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (e, v) =>
        e ? falha(new Error("Esse arquivo não parece ser um .zip válido.", { cause: e })) : ok(v),
    ),
  );
  let javaw: string | undefined;
  const vistos = new Set<string>();
  let bytes = 0;
  try {
    // O diretório central já diz quantas entradas há: recusa antes de gravar qualquer coisa.
    if (z.entryCount > MAX_ENTRADAS) throw recusa("entradas demais.");
    await new Promise<void>((fim, falha) => {
      // Erro da própria biblioteca (nome com "..", absoluto, "\\", tamanho que não bate) também vira recusa.
      z.once("error", (e: Error) =>
        falha(
          e.message.startsWith("Zip do Java")
            ? e
            : recusa(`entrada insegura ou adulterada (${e.message}).`),
        ),
      );
      z.once("end", fim);
      z.on("entry", (e: Entry) => {
        void (async () => {
          if (ehLink(e)) throw recusa(`"${e.fileName}" é um link simbólico.`);
          const dir = e.fileName.endsWith("/");
          const nome = dir ? e.fileName.slice(0, -1) : e.fileName;
          if (!caminhoSeguro(nome))
            throw recusa(`o caminho ${JSON.stringify(e.fileName)} é inseguro.`);
          // Repetido (inclusive só na caixa: no Windows "A" e "a" são o mesmo arquivo) nunca sobrescreve.
          const chave = nome.normalize("NFC").toLowerCase();
          if (vistos.has(chave)) throw recusa(`"${nome}" aparece duas vezes.`);
          vistos.add(chave);
          const destino = join(temp, ...nome.split("/"));
          if (dir) return void (await mkdir(destino, { recursive: true }));
          bytes += e.uncompressedSize;
          if (bytes > MAX_BYTES) throw recusa("o tamanho total passa do limite.");
          await mkdir(dirname(destino), { recursive: true });
          const leitura = await new Promise<NodeJS.ReadableStream>((ok, no) =>
            z.openReadStream(e, (erro, s) => (erro ? no(erro) : ok(s))),
          );
          await pipeline(leitura, createWriteStream(destino, { flags: "wx" }));
          if (JAVAW.test(nome) && (!javaw || nome.length < javaw.length)) javaw = nome;
        })().then(() => z.readEntry(), falha);
      });
      z.readEntry();
    });
  } finally {
    z.close();
  }
  if (!javaw) throw recusa("não achei bin/javaw.exe dentro do pacote.");
  return javaw;
}
