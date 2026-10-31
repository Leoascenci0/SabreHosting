/**
 * Restaurar um backup no lugar do mundo, com troca atômica.
 *
 * Regras de ouro 1, 3 e 4: só com a trava e com o servidor parado; o pacote é aberto numa pasta temporária irmã do
 * mundo (mesmo disco) e só então trocada por `rename`; o estado atual vira backup ANTES de qualquer mudança. Qualquer
 * falha antes ou durante a troca deixa o mundo como estava. Avisar o cartório com a versão nova é outro item.
 */
import { existsSync } from "node:fs";
import { rename, rm } from "node:fs/promises";
import { travaConfirmada } from "../servidor/processo.js";
import { nomeDoBackup } from "./agendador.js";
import type { Manifesto } from "./manifesto.js";
import { abrirPacote, criarPacote, type PacoteCriado } from "./pacote.js";
import { join } from "node:path";

const PRAZO_TRAVA_PADRAO_MS = 10_000;

export interface OpcoesRestaurar {
  /** O backup a restaurar e o hash que o catálogo diz ser dele. */
  pacote: string;
  sha256: string;
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
  /** Só para os testes (injetar falha entre os dois renames). */
  renomear?: (de: string, para: string) => Promise<void>;
}

export interface Restaurado {
  backupDoAtual: PacoteCriado;
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

export async function restaurarBackup(o: OpcoesRestaurar): Promise<Restaurado> {
  const renomear = o.renomear ?? rename;
  const data = (o.agora ?? (() => new Date()))();
  const nome = nomeDoBackup(data, o.versao);
  const sufixo = nome.slice(0, nome.indexOf("-v"));
  const temp = `${o.pastaDoMundo}.restaurando-${sufixo}`;
  const antigo = `${o.pastaDoMundo}.antigo-${sufixo}`;
  const destinoBackup = join(o.pastaBackups, nome);

  await exigirPodeTrocar(o);
  // Regra 4: o rename do pacote trocaria um backup bom de mesmo nome.
  if (existsSync(destinoBackup) || existsSync(antigo)) {
    throw new Error("Já existe um backup (ou mundo antigo) com esse nome; não escrevi por cima.");
  }

  // O mundo está parado, então o pacote é consistente. Falhou: o mundo nem foi tocado.
  const backupDoAtual = await criarPacote(o.pastaDoMundo, destinoBackup, {
    versao: o.versao,
    epoca: o.epoca,
  });

  const restaurado = await abrirPacote(o.pacote, o.sha256, temp); // já se limpa se falhar

  try {
    await exigirPodeTrocar(o); // a trava pode ter se perdido durante a extração
  } catch (erro) {
    await rm(temp, { recursive: true, force: true });
    throw erro;
  }

  await renomear(o.pastaDoMundo, antigo).catch(async (erro: unknown) => {
    await rm(temp, { recursive: true, force: true });
    throw new Error("Não consegui tirar o mundo atual do lugar; o mundo continua como estava.", {
      cause: erro,
    });
  });
  try {
    await renomear(temp, o.pastaDoMundo);
  } catch (erro) {
    await renomear(antigo, o.pastaDoMundo); // desfaz; se isto falhar, o erro sobe e o .antigo continua guardado
    await rm(temp, { recursive: true, force: true });
    throw new Error("Não consegui colocar o backup no lugar; o mundo continua como estava.", {
      cause: erro,
    });
  }

  if (o.manterAntigo === true) return { backupDoAtual, restaurado, mundoAntigo: antigo };
  // Já restaurado e conferido; se o .antigo não sair, sobra lixo, nunca perda.
  await rm(antigo, { recursive: true, force: true }).catch(() => undefined);
  return { backupDoAtual, restaurado };
}
