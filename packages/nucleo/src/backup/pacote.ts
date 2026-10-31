/**
 * Pacote fechado do mundo: um `.tar.gz` com `manifesto.json` como PRIMEIRA entrada e depois os arquivos, na ordem do
 * manifesto. É o que viaja entre os PCs e a nuvem (bkp-1.3 e sync).
 *
 * Só LÊ a pasta do mundo (regra de ouro 2: quem chama faz o `salvarSeguro` antes) e nunca escreve nela (regra 3):
 * `criarPacote` escreve em `<destino>.parcial` + rename; `abrirPacote` escreve só na pasta temporária e a apaga inteira
 * se qualquer conferência falhar. Quem troca a pasta do mundo pela extraída é outro item (bkp-2.2).
 */
import { createHash } from "node:crypto";
import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { Worker } from "node:worker_threads";
import { Parser, type ReadEntry } from "tar";
import { hashComTamanho } from "../integridade/hash.js";
import { MUDOU, gerarManifesto, validarManifesto, type Manifesto } from "./manifesto.js";

export interface PacoteCriado {
  caminho: string;
  sha256: string;
  tamanho: number;
}

const NOME_MANIFESTO = "manifesto.json";
/** Um manifesto de 200 mil arquivos cabe folgado; mais que isso é pacote hostil. */
const MAX_MANIFESTO = 64 * 1024 * 1024;

/**
 * Roda no worker (CJS, por isso em texto): baixa a prioridade da thread e compacta. O manifesto entra em memória como
 * primeira entrada (não existe na pasta do mundo); não segue link simbólico nem desce em pasta: só a lista exata entra.
 * No Windows `setPriority` valeria para o processo todo (derrubaria o app), então lá só o worker já tira o peso da tela.
 */
const CODIGO_DO_WORKER = `
const { workerData, parentPort } = require("node:worker_threads");
const os = require("node:os");
const fs = require("node:fs");
if (process.platform !== "win32") {
  try { os.setPriority(19); } catch {}
}
const tar = require(workerData.tar);
const falhar = (e) => parentPort.postMessage({ erro: String(e && e.message) });
const manifesto = Buffer.from(workerData.manifesto);
const cabecalho = new tar.Header({ path: "${NOME_MANIFESTO}", type: "File", size: manifesto.length, mode: 0o644, mtime: new Date(0) });
cabecalho.encode();
const entrada = new tar.ReadEntry(cabecalho);
entrada.end(manifesto);
const pacote = new tar.Pack({ cwd: workerData.mundo, gzip: { level: 6 }, portable: true, noDirRecurse: true, follow: false });
const saida = fs.createWriteStream(workerData.saida);
saida.on("finish", () => parentPort.postMessage({ ok: true }));
saida.on("error", falhar);
pacote.on("error", falhar);
pacote.pipe(saida);
pacote.write(entrada);
for (const arquivo of workerData.arquivos) pacote.write(arquivo);
pacote.end();
`;

/** O pacote foi desfeito antes de ganhar o nome final (`confirmar` disse não, ou o sinal abortou). */
export class PacoteDescartado extends Error {}

function compactarEmWorker(
  mundo: string,
  manifesto: string,
  arquivos: string[],
  saida: string,
  sinal?: AbortSignal,
): Promise<void> {
  const tar = createRequire(import.meta.url).resolve("tar");
  return new Promise((resolver, rejeitar) => {
    const worker = new Worker(CODIGO_DO_WORKER, {
      eval: true,
      workerData: { tar, mundo, manifesto, arquivos, saida },
    });
    // Abortado: derruba o worker; o "exit" abaixo só rejeita depois que ele saiu, para o `.parcial` poder ser apagado.
    sinal?.addEventListener("abort", () => void worker.terminate(), { once: true });
    worker.once("message", (m: { ok?: true; erro?: string }) =>
      m.ok ? resolver() : rejeitar(new Error(m.erro)),
    );
    worker.once("error", rejeitar);
    worker.once("exit", (codigo) =>
      rejeitar(
        sinal?.aborted
          ? new PacoteDescartado("cancelado durante a compactação")
          : new Error(`compactação encerrou (código ${codigo})`),
      ),
    );
  });
}

/**
 * `confirmar` é chamado logo antes do rename (sem espera entre os dois): falso descarta o pacote, que nunca chega a
 * ter o nome final. `sinal` abortado para a compactação e também descarta; a leitura do manifesto termina antes de o
 * sinal ser olhado (a regra 2 segue salva: o `salvarSeguro` espera a cópia acabar antes do `save-on`). Se o aborto ou a
 * queda vier durante o próprio rename, o destino recém-criado (só ele) é removido.
 */
export async function criarPacote(
  pastaDoMundo: string,
  destino: string,
  opcoes: {
    versao: number;
    epoca: number;
    confirmar?: () => boolean;
    sinal?: AbortSignal;
  },
): Promise<PacoteCriado> {
  const { confirmar, sinal, ...paraManifesto } = opcoes;
  const manifesto = await gerarManifesto(pastaDoMundo, paraManifesto).catch((erro: unknown) => {
    const mudou = erro instanceof Error && erro.message === MUDOU;
    throw new Error(
      mudou
        ? `${MUDOU} Nada foi guardado; o mundo não foi alterado.`
        : "Não consegui ler o mundo para montar o pacote; o mundo não foi alterado.",
      { cause: erro },
    );
  });
  if (manifesto.arquivos.some((a) => a.caminho === NOME_MANIFESTO)) {
    throw new Error(
      `O mundo tem um arquivo chamado "${NOME_MANIFESTO}", nome reservado do pacote. Renomeie esse arquivo e tente de novo.`,
    );
  }
  const parcial = `${destino}.parcial`;
  const desistiu = (): boolean => sinal?.aborted === true || confirmar?.() === false;
  let renomeado = false;
  try {
    if (sinal?.aborted) throw new PacoteDescartado("cancelado antes de começar");
    await mkdir(dirname(destino), { recursive: true });
    await compactarEmWorker(
      pastaDoMundo,
      JSON.stringify(manifesto),
      manifesto.arquivos.map((a) => a.caminho),
      parcial,
      sinal,
    );
    const { hash, tamanho } = await hashComTamanho(parcial);
    if (desistiu()) throw new PacoteDescartado("descartado antes do rename");
    await rename(parcial, destino);
    renomeado = true;
    if (desistiu()) throw new PacoteDescartado("descartado durante o rename");
    return { caminho: destino, sha256: hash, tamanho };
  } catch (erro) {
    await rm(parcial, { force: true });
    if (renomeado) await rm(destino, { force: true });
    if (erro instanceof PacoteDescartado) throw erro;
    throw new Error("Não consegui montar o pacote do mundo; o mundo não foi alterado.", {
      cause: erro,
    });
  }
}

class PacoteRecusado extends Error {}

function recusa(motivo: string): PacoteRecusado {
  return new PacoteRecusado(`Pacote do mundo recusado: ${motivo}`);
}

/** Lê a entrada inteira (limitada) para a memória; só para o manifesto. */
function lerTexto(entrada: ReadEntry): Promise<string> {
  return new Promise((resolver, rejeitar) => {
    const partes: Buffer[] = [];
    let total = 0;
    entrada.on("data", (p: Buffer) => {
      total += p.length;
      if (total > MAX_MANIFESTO) rejeitar(recusa("manifesto grande demais."));
      else partes.push(p);
    });
    entrada.once("end", () => resolver(Buffer.concat(partes).toString("utf8")));
    entrada.once("error", rejeitar);
  });
}

/** Grava a entrada em fluxo, conferindo tamanho e SHA-256 ao mesmo tempo; nunca grava além do tamanho do manifesto. */
function gravarConferindo(
  entrada: ReadEntry,
  completo: string,
  esperado: { tamanho: number; sha256: string },
  caminho: string,
): Promise<void> {
  return new Promise((resolver, rejeitar) => {
    const hash = createHash("sha256");
    const saida = createWriteStream(completo, { flags: "wx" });
    let total = 0;
    let falhou = false;
    const falhar = (erro: Error): void => {
      if (falhou) return;
      falhou = true;
      saida.destroy();
      rejeitar(erro);
    };
    entrada.on("data", (p: Buffer) => {
      total += p.length;
      if (total > esperado.tamanho) {
        falhar(recusa(`"${caminho}" é maior do que o manifesto diz.`));
        return;
      }
      hash.update(p);
      saida.write(p);
    });
    entrada.once("end", () => {
      if (falhou) return;
      if (total !== esperado.tamanho || hash.digest("hex") !== esperado.sha256) {
        falhar(recusa(`"${caminho}" não bate com o manifesto (tamanho ou hash).`));
        return;
      }
      saida.end(() => resolver());
    });
    entrada.once("error", falhar);
    saida.once("error", falhar);
  });
}

async function extrair(pacote: string, pasta: string): Promise<Manifesto> {
  const origem = createReadStream(pacote);
  let manifesto: Manifesto | undefined;
  const pendentes = new Map<string, { tamanho: number; sha256: string }>();
  let primeira = true;
  let falha: Error | undefined;
  /** Uma entrada por vez: a seguinte só é lida depois que a anterior foi gravada e conferida. */
  let fila: Promise<void> = Promise.resolve();

  const parser: Parser = new Parser({
    onReadEntry: (entrada) => {
      fila = fila.then(async () => {
        if (falha) {
          entrada.resume();
          return;
        }
        try {
          await tratar(entrada);
        } catch (erro) {
          falha = erro as Error;
          entrada.resume();
          origem.destroy();
          parser.abort(falha);
        }
      });
    },
  });

  async function tratar(entrada: ReadEntry): Promise<void> {
    const caminho = entrada.path;
    if (entrada.type !== "File") {
      throw recusa(`"${caminho}" não é arquivo comum (link, pasta ou dispositivo).`);
    }
    if (primeira) {
      primeira = false;
      if (caminho !== NOME_MANIFESTO) {
        throw recusa(`a primeira entrada deveria ser ${NOME_MANIFESTO}.`);
      }
      manifesto = validarManifesto(JSON.parse(await lerTexto(entrada)));
      for (const a of manifesto.arquivos) pendentes.set(a.caminho, a);
      return;
    }
    const esperado = pendentes.get(caminho);
    if (esperado === undefined) throw recusa(`"${caminho}" está fora do manifesto ou repetido.`);
    pendentes.delete(caminho);
    const completo = join(pasta, ...caminho.split("/"));
    await mkdir(dirname(completo), { recursive: true });
    await gravarConferindo(entrada, completo, esperado, caminho);
  }

  await new Promise<void>((resolver, rejeitar) => {
    parser.once("end", resolver);
    parser.once("error", rejeitar);
    origem.once("error", rejeitar);
    origem.once("close", () => resolver());
    origem.pipe(parser);
  });
  await fila;
  if (falha) throw falha;
  if (manifesto === undefined) throw recusa("sem manifesto.json.");
  if (pendentes.size > 0) {
    throw recusa(`faltam arquivos do manifesto no pacote (ex.: "${[...pendentes.keys()][0]}").`);
  }
  return manifesto;
}

/**
 * Confere o hash do pacote ANTES de abrir; extrai só arquivos comuns do manifesto, conferindo cada um. Qualquer falha
 * apaga a pasta temporária inteira e lança erro em pt-BR. A pasta temporária precisa não existir ou estar vazia.
 */
/** Só aceita pasta que não existe ou está vazia: a limpeza em falha nunca pode apagar o que já era do amigo. */
async function exigirLivre(pasta: string): Promise<void> {
  const info = await stat(pasta).catch((erro: NodeJS.ErrnoException) => {
    if (erro.code === "ENOENT") return undefined;
    throw erro;
  });
  if (info === undefined) return;
  if (!info.isDirectory() || (await readdir(pasta)).length > 0) {
    throw new Error(
      "A pasta temporária para abrir o pacote já existe e não está vazia (ou é um arquivo); nada foi apagado nem aberto.",
    );
  }
}

export async function abrirPacote(
  pacote: string,
  sha256Esperado: string,
  pastaTemporaria: string,
): Promise<Manifesto> {
  await exigirLivre(pastaTemporaria);
  try {
    const { hash } = await hashComTamanho(pacote);
    if (hash !== sha256Esperado) {
      throw recusa("o arquivo foi alterado ou veio corrompido (hash diferente).");
    }
    await mkdir(pastaTemporaria, { recursive: true });
    return await extrair(pacote, pastaTemporaria);
  } catch (erro) {
    await rm(pastaTemporaria, { recursive: true, force: true });
    if (erro instanceof PacoteRecusado) throw erro;
    throw new Error("Não consegui abrir o pacote do mundo; nada foi alterado.", { cause: erro });
  }
}
