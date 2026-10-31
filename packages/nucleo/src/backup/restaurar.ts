/**
 * Restaurar um backup no lugar do mundo, com troca atômica.
 *
 * Regras de ouro 1, 3 e 4: só com a trava e com o servidor parado; o pacote é aberto numa pasta temporária irmã do
 * mundo (mesmo disco) e só então trocada por `rename`; o estado atual vira backup (reaberto e conferido) ANTES de
 * qualquer mudança. Qualquer falha antes ou durante a troca deixa o mundo como estava. Se nem o desfazer funcionar,
 * deixa um marcador que impede o servidor de subir com o mundo ausente. Avisar o cartório é outro item.
 */
import { existsSync } from "node:fs";
import { rename, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { MARCADOR_RESTAURACAO } from "../servidor/configurar.js";
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
  prazoTravaMs?: number;
  /** Só para os testes (injetar falha nos `rename`). */
  renomear?: (de: string, para: string) => Promise<void>;
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

/** Existe? `undefined` se não; recusa o que não é pasta (o app nunca cria o mundo como arquivo). */
async function haMundo(pasta: string): Promise<boolean> {
  const info = await stat(pasta).catch((erro: NodeJS.ErrnoException) => {
    if (erro.code === "ENOENT") return undefined;
    throw erro;
  });
  if (info !== undefined && !info.isDirectory()) {
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
    await renomear(mundo, antigo).catch(async (erro: unknown) => {
      await apagar(temp);
      throw new Error("Não consegui tirar o mundo atual do lugar; o mundo continua como estava.", {
        cause: erro,
      });
    });
  }
  try {
    await renomear(temp, mundo);
  } catch (erro) {
    if (haMundoAtual)
      await desfazer(renomear, { mundo, antigo, temp, backup: backupDoAtual }, erro);
    await apagar(temp);
    throw new Error("Não consegui colocar o backup no lugar; o mundo continua como estava.", {
      cause: erro,
    });
  }

  if (haMundoAtual && o.manterAntigo === true) {
    return { backupDoAtual, restaurado, mundoAntigo: antigo };
  }
  // Já restaurado e conferido; se o .antigo não sair, sobra lixo, nunca perda.
  if (haMundoAtual) await apagar(antigo).catch(() => undefined);
  return { backupDoAtual, restaurado };
}

/** Devolve o mundo de antes ao lugar. Se nem isso der, trava o servidor e diz onde está cada coisa. */
async function desfazer(
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
    await writeFile(join(dirname(c.mundo), MARCADOR_RESTAURACAO), texto).catch(() => undefined);
    throw new Error(
      `Não consegui nem desfazer a troca. O mundo de antes está inteiro em "${c.antigo}"; ` +
        `o backup do estado de antes está em "${c.backup?.caminho ?? "(não feito)"}". ` +
        `Renomeie "${c.antigo}" para "${c.mundo}" com o servidor desligado. O servidor não sobe até lá.`,
      { cause: [causa, erro] },
    );
  }
}
