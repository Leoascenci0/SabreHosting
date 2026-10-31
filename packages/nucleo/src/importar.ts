/**
 * Importar o mundo de um `.zip` baixado da hospedagem antiga (piloto-1.1a: só o núcleo, sem tela).
 *
 * O zip vem de fora, então é entrada NÃO confiável (S-07): primeiro uma passada só de leitura da lista de entradas
 * recusa tudo que é suspeito, SEM gravar um byte; só depois extrai para uma pasta temporária nova, filha direta da
 * pasta de trabalho, conferindo cada destino. O zip nunca é lido inteiro na memória (yauzl lê entrada a entrada).
 * O pacote sai de `criarPacote` (regras 2 e 3 intactas: só lê a pasta extraída) e a versão 1 é entregue a `enviar`.
 */
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import yauzl, { type Entry, type ZipFile } from "yauzl";
import { caminhoSeguro } from "./backup/manifesto.js";
import { criarPacote, type PacoteCriado } from "./backup/pacote.js";

export interface LimitesDaImportacao {
  /** Teto de bytes descompactados (declarados e, de novo, os realmente lidos). */
  maxBytes: number;
  maxEntradas: number;
}

/** Padrões sensatos para um mundo de amigos; reversíveis (o app poderá oferecer na tela, 1.1c). */
export const LIMITES_PADRAO: LimitesDaImportacao = {
  maxBytes: 8 * 1024 ** 3,
  maxEntradas: 200_000,
};

export interface ImportacaoPronta {
  versao: 1;
  sha256: string;
  tamanho: number;
  arquivos: number;
}

export interface OpcoesDeImportacao {
  /** Pasta onde nasce a temporária (`importar-XXXX`); precisa existir. */
  pastaDeTrabalho: string;
  /** Época da trava de host (o cartório recusa época velha). */
  epoca: number;
  /** Entrega a versão 1 (POST /versoes + PUT /versoes/1/pacote). Se lançar, nada fica em disco. */
  enviar: (pacote: PacoteCriado) => Promise<void>;
  limites?: Partial<LimitesDaImportacao>;
}

const recusa = (motivo: string) =>
  new Error(`Zip do mundo recusado: ${motivo} Nada foi importado nem alterado.`);

const abrir = (zip: string): Promise<ZipFile> =>
  new Promise((ok, falha) =>
    yauzl.open(
      zip,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (erro, z) => (erro ? falha(erro) : ok(z)),
    ),
  );

/** Percorre as entradas uma a uma; `porEntrada` pode lançar para abortar. Sempre fecha o zip. */
async function percorrer(
  zip: string,
  porEntrada: (e: Entry, ler: () => Promise<NodeJS.ReadableStream>) => Promise<void>,
): Promise<void> {
  const z = await abrir(zip).catch((erro: unknown) => {
    throw new Error("Esse arquivo não parece ser um .zip válido.", { cause: erro });
  });
  try {
    await new Promise<void>((fim, falha) => {
      // Erro da própria biblioteca (nome com "..", absoluto, "\\", tamanho que não bate): vira recusa em pt-BR.
      z.once("error", (erro: Error) =>
        falha(
          erro.message.startsWith("Zip do mundo recusado")
            ? erro
            : new Error(
                `Zip do mundo recusado: entrada com caminho inseguro ou tamanho adulterado (${erro.message}). Nada foi importado nem alterado.`,
                { cause: erro },
              ),
        ),
      );
      z.once("end", fim);
      z.on("entry", (e: Entry) => {
        const ler = () =>
          new Promise<NodeJS.ReadableStream>((ok, no) =>
            z.openReadStream(e, (erro, s) => (erro ? no(erro) : ok(s))),
          );
        porEntrada(e, ler).then(() => z.readEntry(), falha);
      });
      z.readEntry();
    });
  } finally {
    z.close();
  }
}

const ehLink = (e: Entry) => ((e.externalFileAttributes >>> 16) & 0o170000) === 0o120000;

/** Passada 1: só olha a lista. Devolve os caminhos a extrair; lança na primeira entrada suspeita. */
async function conferirLista(zip: string, lim: LimitesDaImportacao): Promise<string[]> {
  const nomes: string[] = [];
  const vistos = new Set<string>();
  const pastas = new Set<string>();
  let total = 0;
  let entradas = 0;
  await percorrer(zip, async (e) => {
    if (++entradas > lim.maxEntradas) {
      throw recusa(`tem entradas demais (mais de ${lim.maxEntradas}).`);
    }
    if (ehLink(e)) throw recusa(`"${e.fileName}" é um link simbólico.`);
    const dir = e.fileName.endsWith("/");
    const nome = dir ? e.fileName.slice(0, -1) : e.fileName;
    if (!caminhoSeguro(nome)) {
      throw recusa(
        `o caminho ${JSON.stringify(e.fileName)} é inseguro (nome ou caminho inválido).`,
      );
    }
    const chave = nome.normalize("NFC").toLowerCase();
    if (dir) {
      pastas.add(chave);
      return;
    }
    if (vistos.has(chave)) {
      throw recusa(`"${nome}" aparece duas vezes (repetido, mesmo ignorando maiúsculas).`);
    }
    vistos.add(chave);
    total += e.uncompressedSize;
    if (total > lim.maxBytes) {
      throw recusa(`o tamanho total passa do limite de ${lim.maxBytes} bytes.`);
    }
    nomes.push(nome);
  });
  // Um nome não pode ser arquivo e pasta ao mesmo tempo (em qualquer ordem).
  for (const chave of vistos) {
    const partes = chave.split("/");
    for (let i = 1; i < partes.length; i++) {
      if (vistos.has(partes.slice(0, i).join("/"))) {
        throw recusa(`"${chave}" está dentro de algo que também é arquivo.`);
      }
    }
    if (pastas.has(chave)) throw recusa(`"${chave}" é arquivo e pasta ao mesmo tempo.`);
  }
  if (nomes.length === 0) throw recusa("o zip está vazio: nenhum arquivo dentro.");
  return nomes;
}

/** Passada 2: extrai conferindo cada destino e contando os bytes REALMENTE lidos (o declarado não vale). */
async function extrair(zip: string, mundo: string, lim: LimitesDaImportacao): Promise<void> {
  let lidos = 0;
  await percorrer(zip, async (e, ler) => {
    if (e.fileName.endsWith("/")) return;
    const destino = resolve(mundo, ...e.fileName.split("/"));
    const rel = relative(mundo, destino);
    if (
      rel === "" ||
      rel.startsWith("..") ||
      resolve(mundo, rel) !== destino ||
      rel.includes(`..${sep}`)
    ) {
      throw recusa(`"${e.fileName}" sairia da pasta de destino.`);
    }
    await mkdir(dirname(destino), { recursive: true });
    const contar = new Transform({
      transform(parte: Buffer, _c, pronto) {
        lidos += parte.length;
        if (lidos > lim.maxBytes) {
          pronto(recusa(`o conteúdo real passa do limite de ${lim.maxBytes} bytes (zip inflado).`));
        } else pronto(null, parte);
      },
    });
    await pipeline(await ler(), contar, createWriteStream(destino, { flags: "wx" }));
  });
}

export async function importarMundoZip(
  zip: string,
  o: OpcoesDeImportacao,
): Promise<ImportacaoPronta> {
  const lim = { ...LIMITES_PADRAO, ...o.limites };
  const nomes = await conferirLista(zip, lim); // nada gravado até aqui
  const base = await mkdtemp(join(o.pastaDeTrabalho, "importar-"));
  try {
    const mundo = join(base, "mundo");
    await mkdir(mundo);
    await extrair(zip, mundo, lim);
    const pacote = await criarPacote(mundo, join(base, "mundo.tar.gz"), {
      versao: 1,
      epoca: o.epoca,
    });
    await o.enviar(pacote);
    return { versao: 1, sha256: pacote.sha256, tamanho: pacote.tamanho, arquivos: nomes.length };
  } finally {
    await rm(base, { recursive: true, force: true }); // só a pasta que esta chamada criou
  }
}
