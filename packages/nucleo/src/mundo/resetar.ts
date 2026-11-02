/**
 * Executa o reset de uma área do mundo (chunk-1.3) com troca atômica.
 *
 * Regras de ouro 1 a 5: só com servidor parado e trava deste PC; backup `antes-de-resetar` feito e REABERTO antes de
 * qualquer escrita (falhou = nada tocado); só os `.mca` tocados são copiados (em fluxo, nunca o mundo na RAM) para uma
 * temporária irmã com as entradas escolhidas zeradas (posição + data, nas 3 pastas); o resto é conferido por hash;
 * a troca é por `rename`, com marcador gravado ANTES do primeiro e desfeito pela lista se qualquer rename falhar.
 * Região que fica vazia só sai. Nunca toca `level.dat` nem `playerdata`. Os erros têm texto fixo (sem caminho cru).
 */
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { lstat, open, rename, writeFile } from "node:fs/promises";
import { createReadStream, createWriteStream } from "node:fs";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import { dirname, join, resolve } from "node:path";
import { nomeDoBackup } from "../backup/agendador.js";
import { abrirPacote, criarPacote, type PacoteCriado } from "../backup/pacote.js";
import {
  apagar,
  exigirMundoNaPastaDoServidor,
  exigirPodeTrocar,
  haMundo,
  type OpcoesRestaurar,
} from "../backup/restaurar.js";
import { MARCADOR_RESTAURACAO, MARCADOR_TROCA } from "../servidor/configurar.js";
import {
  chunkNaArea,
  planejarReset,
  type AreaDoReset,
  type PlanoDeReset,
} from "./planejar-reset.js";
import type { Dimensao } from "./regioes.js";
import {
  apagarMarcadorReset,
  caminhoAntigo,
  caminhoOriginal,
  caminhoTemp,
  desfazerReset,
  gravarMarcadorReset,
  limparReset,
  type ItemDoReset,
  type MarcadorDoReset,
} from "./troca-reset.js";

const SETOR = 4096;
const CABECALHO = 2 * SETOR;
const ACAO = { parar: "resetar o mundo", fazer: "resetar o mundo" };

export interface OpcoesResetar extends Pick<
  OpcoesRestaurar,
  "temTrava" | "servidorParado" | "prazoTravaMs" | "renomear"
> {
  pastaDoMundo: string;
  pastaBackups: string;
  /** Pasta do servidor (pai do mundo), onde o marcador fica. */
  pastaDoServidor?: string;
  dimensao: Dimensao;
  /** Entrada não confiável: quem valida é `planejarReset`. */
  area: unknown;
  /** Já viu que a área é grande e quer seguir. */
  confirmado?: boolean;
  /** Backup ou restauração em andamento no app? (a ligação real é do 1.5). Verdadeiro recusa. */
  operacaoEmAndamento?: () => boolean;
  /** Versão e época do estado ATUAL, para nomear e marcar o backup. */
  versao: number;
  epoca: number;
  agora?: () => Date;
  /** Só para os testes: roda depois de cada rename; o que lançar simula o app morrendo ali (sem limpeza). */
  aposRename?: () => void | Promise<void>;
  /** Só para os testes: roda depois da cópia de uma temporária, antes da conferência. */
  aposCopia?: (temp: string) => void | Promise<void>;
  /** Só para os testes: roda depois do marcador `concluido`; lançar simula morte nesse ponto. */
  aposTroca?: () => void | Promise<void>;
}

export interface Resetado {
  backup: PacoteCriado;
  plano: PlanoDeReset;
  /** Quantos `.mca` foram trocados ou apagados. */
  arquivosTrocados: number;
}

interface Preparado extends ItemDoReset {
  temp?: string;
}

/** Calcula o cabeçalho novo relendo o disco agora (não confia no plano). `null` = nada a fazer neste arquivo. */
function novoCabecalho(
  antigo: Buffer,
  area: AreaDoReset,
  rx: number,
  rz: number,
): { cabecalho: Buffer; restantes: number } | null {
  const cabecalho = Buffer.from(antigo);
  let mudou = 0;
  let restantes = 0;
  for (let i = 0; i < 1024; i++) {
    const tem = antigo.readUInt32BE(i * 4) !== 0;
    if (chunkNaArea(area, rx * 32 + (i & 31), rz * 32 + (i >> 5))) {
      if (tem || antigo.readUInt32BE(SETOR + i * 4) !== 0) mudou++;
      cabecalho.writeUInt32BE(0, i * 4);
      cabecalho.writeUInt32BE(0, SETOR + i * 4);
    } else if (tem) restantes++;
  }
  return mudou === 0 ? null : { cabecalho, restantes };
}

const hashDoResto = async (caminho: string): Promise<string> => {
  const h = createHash("sha256");
  await pipeline(createReadStream(caminho, { start: CABECALHO }), h);
  return h.digest("hex");
};

/** Copia o `.mca` com o cabeçalho novo para `temp` e confere tamanho, cabeçalho e hash do resto. */
async function copiarComCabecalho(
  original: string,
  temp: string,
  cabecalho: Buffer,
  tamanho: number,
  aposCopia: OpcoesResetar["aposCopia"],
): Promise<void> {
  await writeFile(temp, cabecalho, { flag: "wx" });
  const origem = createHash("sha256");
  const somar = new Transform({
    transform(pedaco: Buffer, _enc, cb) {
      origem.update(pedaco);
      cb(null, pedaco);
    },
  });
  await pipeline(
    createReadStream(original, { start: CABECALHO }),
    somar,
    createWriteStream(temp, { flags: "r+", start: CABECALHO }),
  );
  await aposCopia?.(temp);
  const info = await lstat(temp);
  const fh = await open(temp, "r");
  const lido = Buffer.alloc(CABECALHO);
  try {
    await fh.read(lido, 0, CABECALHO, 0);
  } finally {
    await fh.close();
  }
  if (
    info.size !== tamanho ||
    !lido.equals(cabecalho) ||
    (await hashDoResto(temp)) !== origem.digest("hex")
  ) {
    throw new Error("conferência");
  }
}

async function prepararArquivo(
  mundo: string,
  a: PlanoDeReset["arquivos"][number],
  area: AreaDoReset,
  sufixo: string,
  aposCopia: OpcoesResetar["aposCopia"],
): Promise<Preparado | null> {
  const original = caminhoOriginal(mundo, a.arquivo);
  const info = await lstat(original);
  if (!info.isFile() || info.isSymbolicLink() || info.size < CABECALHO) return null;
  const fh = await open(original, "r");
  const antigo = Buffer.alloc(CABECALHO);
  try {
    const { bytesRead } = await fh.read(antigo, 0, CABECALHO, 0);
    if (bytesRead < CABECALHO) return null;
  } finally {
    await fh.close();
  }
  const novo = novoCabecalho(antigo, area, a.x, a.z);
  if (novo === null) return null;
  if (novo.restantes === 0) return { rel: a.arquivo, apagar: true };
  const temp = caminhoTemp(mundo, a.arquivo, sufixo);
  await copiarComCabecalho(original, temp, novo.cabecalho, info.size, aposCopia);
  return { rel: a.arquivo, apagar: false, temp };
}

export async function resetarMundo(o: OpcoesResetar): Promise<Resetado> {
  const renomear = o.renomear ?? rename;
  const mundo = resolve(o.pastaDoMundo);
  const emAndamento = () => {
    if (o.operacaoEmAndamento?.() === true) {
      throw new Error(
        "Há um backup ou uma restauração em andamento; espere terminar antes de resetar.",
      );
    }
  };
  emAndamento();
  exigirMundoNaPastaDoServidor(mundo, o.pastaDoServidor);
  await exigirPodeTrocar(o, ACAO);
  if (!(await haMundo(mundo))) throw new Error("A pasta do mundo não existe; nada foi alterado.");
  if (
    existsSync(join(dirname(mundo), MARCADOR_TROCA)) ||
    existsSync(join(dirname(mundo), MARCADOR_RESTAURACAO))
  ) {
    throw new Error(
      "Há outra troca do mundo em andamento (ou parada no meio); abra o app de novo para recuperar antes de resetar.",
    );
  }

  const plano = await planejarReset(mundo, o.dimensao, o.area, {
    confirmado: o.confirmado === true,
  });
  const nome = nomeDoBackup((o.agora ?? (() => new Date()))(), o.versao);
  const sufixo = nome.slice(0, nome.indexOf("-v"));
  const destinoBackup = join(o.pastaBackups, nome);
  const conferindo = `${mundo}.conferindo-${sufixo}`;
  if (plano.arquivos.length === 0)
    throw new Error("Nenhum chunk existe nessa área; nada foi alterado.");
  if (existsSync(destinoBackup) || existsSync(conferindo)) {
    throw new Error("Já existe um backup com esse nome; não escrevi por cima.");
  }
  for (const a of plano.arquivos) {
    if (
      existsSync(caminhoAntigo(mundo, a.arquivo, sufixo)) ||
      existsSync(caminhoTemp(mundo, a.arquivo, sufixo))
    ) {
      throw new Error("Há sobra de um reset anterior ao lado do mundo; nada foi alterado.");
    }
  }

  // Regra 4/5: backup fechado e REABERTO antes de qualquer escrita. Servidor parado, então o pacote é consistente.
  let backup: PacoteCriado;
  try {
    backup = await criarPacote(mundo, destinoBackup, {
      versao: o.versao,
      epoca: o.epoca,
      origem: "antes-de-resetar",
    });
  } catch (erro) {
    throw new Error("Não consegui fazer o backup antes de resetar; o mundo não foi alterado.", {
      cause: erro,
    });
  }
  try {
    await abrirPacote(backup.caminho, backup.sha256, conferindo);
    await apagar(conferindo);
  } catch (erro) {
    await apagar(backup.caminho);
    throw new Error(
      "O backup antes de resetar não passou na conferência; descartei-o e não mexi no mundo.",
      { cause: erro },
    );
  }

  const itens: Preparado[] = [];
  const limparTemps = () => Promise.all(itens.map((i) => (i.temp ? apagar(i.temp) : undefined)));
  try {
    for (const a of plano.arquivos) {
      // Sempre relê o disco: o plano pode estar velho e o cabeçalho é entrada não confiável.
      const p = await prepararArquivo(mundo, a, plano.area, sufixo, o.aposCopia);
      if (p !== null) itens.push(p);
      else await apagar(caminhoTemp(mundo, a.arquivo, sufixo));
    }
  } catch (erro) {
    for (const a of plano.arquivos) await apagar(caminhoTemp(mundo, a.arquivo, sufixo));
    throw new Error(
      "Não consegui preparar os arquivos do reset (a conferência falhou); o mundo não foi alterado.",
      { cause: erro },
    );
  }
  if (itens.length === 0) return { backup, plano, arquivosTrocados: 0 };

  try {
    emAndamento();
    await exigirPodeTrocar(o, ACAO); // a trava pode ter se perdido durante a cópia
  } catch (erro) {
    await limparTemps();
    throw erro;
  }

  const marcador: MarcadorDoReset = {
    tipo: "reset",
    mundo,
    sufixo,
    fase: "trocando",
    arquivos: itens.map(({ rel, apagar: sai }) => ({ rel, apagar: sai })),
  };
  // Sem marcador gravado a troca não começa.
  await gravarMarcadorReset(marcador).catch(async (erro: unknown) => {
    await limparTemps();
    throw new Error("Não consegui registrar a troca; o mundo não foi alterado.", { cause: erro });
  });

  const desistir = async (erro: unknown): Promise<never> => {
    try {
      await desfazerReset(marcador, renomear);
    } catch (falha) {
      throw new Error(
        "O reset parou no meio e não consegui desfazer. O servidor não sobe até o app recuperar o mundo: " +
          `feche e abra o SabreHosting. O backup antes de resetar está em "${backup.caminho}".`,
        { cause: [erro, falha] },
      );
    }
    await apagarMarcadorReset(marcador);
    throw new Error("Não consegui trocar os arquivos do reset; o mundo continua como estava.", {
      cause: erro,
    });
  };

  for (const i of itens) {
    const original = caminhoOriginal(mundo, i.rel);
    try {
      await renomear(original, caminhoAntigo(mundo, i.rel, sufixo));
    } catch (erro) {
      return desistir(erro);
    }
    await o.aposRename?.(); // fora do try: o que lançar aqui simula o app morrendo (sem limpeza)
    if (i.temp !== undefined) {
      try {
        await renomear(i.temp, original);
      } catch (erro) {
        return desistir(erro);
      }
      await o.aposRename?.();
    }
  }

  // Tudo trocado: a partir daqui NUNCA se desfaz parcial. Se nem o marcador `concluido` gravar, ainda dá para desfazer.
  try {
    await gravarMarcadorReset({ ...marcador, fase: "concluido" });
  } catch (erro) {
    return desistir(erro);
  }
  await o.aposTroca?.();
  // Já trocado e conferido; se o .antigo não sair (ex.: antivírus), sobra lixo, nunca perda.
  await limparReset(marcador).catch(() => undefined);
  await apagarMarcadorReset(marcador).catch(() => undefined);
  return { backup, plano, arquivosTrocados: itens.length };
}
