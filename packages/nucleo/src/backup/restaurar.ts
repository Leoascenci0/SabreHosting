/**
 * Restaurar um backup no lugar do mundo, com troca atômica.
 *
 * Regras de ouro 1, 3 e 4: só com a trava e com o servidor parado; o pacote é aberto numa pasta temporária irmã do
 * mundo (mesmo disco) e só então trocada por `rename`; o estado atual vira backup (reaberto e conferido) ANTES de
 * qualquer mudança. Qualquer falha antes ou durante a troca deixa o mundo como estava. Se nem o desfazer funcionar,
 * deixa um marcador que impede o servidor de subir com o mundo ausente. Avisar o cartório é outro item.
 */
import { existsSync } from "node:fs";
import { lstat, readFile, rename, rm, writeFile } from "node:fs/promises";
import { basename, dirname, isAbsolute, join, relative, resolve } from "node:path";
import { MARCADOR_RESTAURACAO, MARCADOR_TROCA, gravarAtomico } from "../servidor/configurar.js";
import { travaConfirmada } from "../servidor/processo.js";
import { nomeDoBackup } from "./agendador.js";
import type { Manifesto } from "./manifesto.js";
import { abrirPacote, criarPacote, type PacoteCriado } from "./pacote.js";

const PRAZO_TRAVA_PADRAO_MS = 10_000;

export interface OpcoesRestaurar {
  /** O backup a restaurar e o hash que o catálogo diz ser dele. */
  pacote: string;
  sha256: string;
  /** Pode não existir (mundo perdido): aí não há o que guardar e restaura direto. */
  pastaDoMundo: string;
  pastaBackups: string;
  /** Dono da trava do cartório agora? Erro, demora e `false` valem como sem trava. */
  temTrava: () => Promise<boolean>;
  servidorParado: () => boolean;
  /** Versão e época do estado ATUAL, para nomear e marcar o backup dele. */
  versao: number;
  epoca: number;
  /** Fica com o mundo de antes ao lado (`<mundo>.antigo-<data>`) em vez de apagar. */
  manterAntigo?: boolean;
  agora?: () => Date;
  /** Pasta do servidor, onde `podeSubir` procura o marcador da troca: o mundo tem de ser filho direto dela. */
  pastaDoServidor?: string;
  prazoTravaMs?: number;
  /** Só para os testes (injetar falha nos `rename`). */
  renomear?: (de: string, para: string) => Promise<void>;
  /** Só para os testes: roda entre os dois `rename`; o que ele lançar simula o app morrendo ali (sem limpeza). */
  aposPrimeiroRename?: () => void | Promise<void>;
}

export interface Restaurado {
  /** Ausente quando não havia mundo para guardar. */
  backupDoAtual?: PacoteCriado;
  restaurado: Manifesto;
  /** Onde ficou o mundo de antes, se `manterAntigo`. */
  mundoAntigo?: string;
}

async function exigirPodeTrocar(o: OpcoesRestaurar): Promise<void> {
  if (!o.servidorParado()) {
    throw new Error("O servidor está rodando; pare o servidor antes de restaurar um backup.");
  }
  const trava = await travaConfirmada(o.temTrava, o.prazoTravaMs ?? PRAZO_TRAVA_PADRAO_MS);
  if (trava !== "sim") {
    throw new Error(
      "Este PC não tem a trava de host confirmada pelo cartório; não dá para restaurar o mundo.",
    );
  }
}

const apagar = (p: string) => rm(p, { recursive: true, force: true });

/** Existe? Recusa o que não é pasta, inclusive link simbólico (quebrado ou não): o app nunca cria o mundo assim. */
export async function haMundo(pasta: string): Promise<boolean> {
  const info = await lstat(pasta).catch((erro: NodeJS.ErrnoException) => {
    if (erro.code === "ENOENT") return undefined;
    throw erro;
  });
  if (info !== undefined && (info.isSymbolicLink() || !info.isDirectory())) {
    throw new Error("O caminho do mundo não é uma pasta; nada foi alterado.");
  }
  return info !== undefined;
}

export async function restaurarBackup(o: OpcoesRestaurar): Promise<Restaurado> {
  const renomear = o.renomear ?? rename;
  const mundo = resolve(o.pastaDoMundo); // "mundo/" com barra no fim colocaria a temporária DENTRO do mundo
  const nome = nomeDoBackup((o.agora ?? (() => new Date()))(), o.versao);
  const sufixo = nome.slice(0, nome.indexOf("-v"));
  const temp = `${mundo}.restaurando-${sufixo}`;
  const antigo = `${mundo}.antigo-${sufixo}`;
  const conferindo = `${mundo}.conferindo-${sufixo}`;
  const destinoBackup = join(o.pastaBackups, nome);

  exigirMundoNaPastaDoServidor(mundo, o.pastaDoServidor);
  await exigirPodeTrocar(o);
  const haMundoAtual = await haMundo(mundo);
  // Regra 4: o rename do pacote trocaria um backup bom de mesmo nome.
  if (existsSync(destinoBackup) || existsSync(antigo)) {
    throw new Error("Já existe um backup (ou mundo antigo) com esse nome; não escrevi por cima.");
  }

  // O mundo está parado, então o pacote é consistente. Falhou: o mundo nem foi tocado.
  let backupDoAtual: PacoteCriado | undefined;
  if (haMundoAtual) {
    backupDoAtual = await criarPacote(mundo, destinoBackup, { versao: o.versao, epoca: o.epoca });
    try {
      // Reabre o que acabou de gravar: backup que não abre não protege nada.
      await abrirPacote(backupDoAtual.caminho, backupDoAtual.sha256, conferindo);
      await apagar(conferindo);
    } catch (erro) {
      await apagar(backupDoAtual.caminho);
      throw new Error(
        "O backup do estado atual não passou na conferência; descartei-o e não mexi no mundo.",
        { cause: erro },
      );
    }
  }

  const restaurado = await abrirPacote(o.pacote, o.sha256, temp); // já se limpa se falhar

  try {
    await exigirPodeTrocar(o); // a trava pode ter se perdido durante a extração
  } catch (erro) {
    await apagar(temp);
    throw erro;
  }

  if (haMundoAtual) {
    await gravarMarcadorTroca({ mundo, antigo, temp });
    await renomear(mundo, antigo).catch(async (erro: unknown) => {
      await apagar(temp);
      await apagarMarcadorTroca(mundo);
      throw new Error("Não consegui tirar o mundo atual do lugar; o mundo continua como estava.", {
        cause: erro,
      });
    });
    await o.aposPrimeiroRename?.();
  }
  try {
    await renomear(temp, mundo);
  } catch (erro) {
    if (haMundoAtual) {
      await desfazer(renomear, { mundo, antigo, temp, backup: backupDoAtual }, erro);
      await apagarMarcadorTroca(mundo);
    }
    await apagar(temp);
    throw new Error("Não consegui colocar o backup no lugar; o mundo continua como estava.", {
      cause: erro,
    });
  }

  // O mundo novo já está no lugar: falhar ao apagar o marcador (ex.: antivírus) não pode virar "desfazer". O
  // marcador sobra e a próxima partida (`recuperarTroca`) só o limpa.
  if (haMundoAtual) await apagarMarcadorTroca(mundo).catch(() => undefined);
  if (haMundoAtual && o.manterAntigo === true) {
    return { backupDoAtual, restaurado, mundoAntigo: antigo };
  }
  // Já restaurado e conferido; se o .antigo não sair, sobra lixo, nunca perda.
  if (haMundoAtual) await apagar(antigo).catch(() => undefined);
  return { backupDoAtual, restaurado };
}

export interface CaminhosDaTroca {
  mundo: string;
  antigo: string;
  temp: string;
}

const mesmoLugar = (a: string, b: string) => relative(resolve(a), resolve(b)) === ""; // sem diferença de C:\ e c:\ no Windows

/** O marcador fica em `dirname(mundo)` e `podeSubir` o lê na pasta do servidor: se forem diferentes, não protege. */
export function exigirMundoNaPastaDoServidor(
  mundo: string,
  pastaDoServidor: string | undefined,
): void {
  if (pastaDoServidor === undefined) return;
  if (!mesmoLugar(dirname(resolve(mundo)), pastaDoServidor)) {
    throw new Error(
      "O mundo precisa ficar dentro da pasta do servidor (não numa pasta de dentro dela nem em outro lugar) para a troca ser protegida; nada foi alterado.",
    );
  }
}

/** Grava (atômico) o que a troca vai mexer, ao lado do mundo, ANTES do primeiro `rename`. */
export async function gravarMarcadorTroca(c: CaminhosDaTroca): Promise<void> {
  await gravarAtomico(join(dirname(c.mundo), MARCADOR_TROCA), JSON.stringify(c));
}

/** Só depois do segundo `rename` (ou do desfazer que deu certo). */
export const apagarMarcadorTroca = (mundo: string) => apagar(join(dirname(mundo), MARCADOR_TROCA));

/**
 * No início do app e antes de subir o servidor: se a última troca morreu no meio, devolve o mundo de antes (N).
 * Nunca completa a troca e nunca apaga o `.antigo` (regra 4). Sem poder resolver, lança e MANTÉM o marcador,
 * então o servidor continua sem subir. `pastaDoServidor` é onde o marcador fica (pasta pai do mundo).
 */
export async function recuperarTroca(
  pastaDoServidor: string,
  renomear: (de: string, para: string) => Promise<void> = rename,
): Promise<"nada" | "limpou" | "desfez"> {
  const arquivo = join(pastaDoServidor, MARCADOR_TROCA);
  let texto: string;
  try {
    texto = await readFile(arquivo, "utf8");
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === "ENOENT") return "nada";
    throw erro;
  }
  const c = lerMarcadorTroca(texto, pastaDoServidor);
  if (await haMundo(c.mundo)) {
    // O segundo rename (ou o desfazer) aconteceu; só sobrou o aviso e a temporária.
    await apagar(c.temp);
    await rm(arquivo, { force: true });
    return "limpou";
  }
  if (!(await haMundo(c.antigo))) {
    throw new Error(
      `A troca do mundo parou no meio e não achei nem o mundo nem "${c.antigo}". Nada foi apagado; ` +
        `procure a pasta do mundo de antes, renomeie para "${c.mundo}" e apague ${MARCADOR_TROCA}.`,
    );
  }
  await desfazer(
    renomear,
    { ...c, backup: undefined },
    new Error("app parou entre os dois rename"),
  );
  await apagar(c.temp);
  await rm(arquivo, { force: true });
  return "desfez";
}

/** Marcador ilegível ou apontando para fora da pasta do servidor não é obedecido: trava e pede mão humana. */
function lerMarcadorTroca(texto: string, pasta: string): CaminhosDaTroca {
  const ruim = () =>
    new Error(
      `O arquivo ${MARCADOR_TROCA} está ilegível ou fora do esperado; nada foi alterado. ` +
        `Confira a pasta do mundo e apague o arquivo só depois.`,
    );
  let j: unknown;
  try {
    j = JSON.parse(texto);
  } catch {
    throw ruim();
  }
  const { mundo, antigo, temp } = (j ?? {}) as Record<string, unknown>;
  for (const p of [mundo, antigo, temp]) {
    if (typeof p !== "string" || !isAbsolute(p) || !mesmoLugar(dirname(resolve(p)), pasta))
      throw ruim();
  }
  // Os três distintos e a sobra com o nome do mundo + ".": `temp` forjado como o mundo (ou mods/, libraries/)
  // faria a recuperação apagar o mundo vivo.
  const nome = basename(mundo as string);
  for (const p of [antigo, temp] as string[]) {
    if (!basename(p).startsWith(`${nome}.`)) throw ruim();
  }
  if (antigo === temp) throw ruim();
  return { mundo, antigo, temp } as CaminhosDaTroca;
}

/** Devolve o mundo de antes ao lugar. Se nem isso der, trava o servidor e diz onde está cada coisa. */
export async function desfazer(
  renomear: (de: string, para: string) => Promise<void>,
  c: { mundo: string; antigo: string; temp: string; backup: PacoteCriado | undefined },
  causa: unknown,
): Promise<void> {
  try {
    await renomear(c.antigo, c.mundo);
  } catch (erro) {
    const texto =
      `A restauração parou no meio e o mundo não voltou ao lugar.\n` +
      `Mundo de antes (inteiro): ${c.antigo}\n` +
      `Backup que ia entrar (pode estar incompleto): ${c.temp}\n` +
      `Backup do estado de antes: ${c.backup?.caminho ?? "(não feito)"}\n` +
      `O que fazer: com o servidor desligado, renomeie a pasta do mundo de antes de volta para ${c.mundo} ` +
      `e apague este arquivo.\n`;
    const marcador = join(dirname(c.mundo), MARCADOR_RESTAURACAO);
    const falhaDoMarcador = await writeFile(marcador, texto).then(
      () => undefined,
      (e: unknown) => e,
    );
    const aviso =
      falhaDoMarcador === undefined
        ? "O servidor não sobe até lá."
        : `ATENÇÃO: o marcador que impede o servidor de subir não foi gravado (${marcador}); ` +
          `não ligue o servidor antes de renomear a pasta.`;
    throw new Error(
      `Não consegui nem desfazer a troca. O mundo de antes está inteiro em "${c.antigo}"; ` +
        `o backup do estado de antes está em "${c.backup?.caminho ?? "(não feito)"}". ` +
        `Renomeie "${c.antigo}" para "${c.mundo}" com o servidor desligado. ${aviso}`,
      { cause: [causa, erro, ...(falhaDoMarcador === undefined ? [] : [falhaDoMarcador])] },
    );
  }
}
