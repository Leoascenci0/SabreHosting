/**
 * Aplicar o delta: leva o mundo local da versão N para a versão M baixando só o que mudou, com troca atômica.
 *
 * Regras de ouro 1, 2, 3 e 5: só com a trava de ATUALIZAÇÃO confirmada antes de cada rename (syncmel-1.8b: outro
 * PC pode hospedar enquanto este atualiza a própria cópia), com este PC fora do host e o servidor dele parado; o
 * mundo atual nunca é escrito: monta-se uma pasta temporária irmã (arquivos iguais por hard link, com cópia de fallback; novos e mudados baixados com o hash de
 * M para um caminho NOVO), confere-se o manifesto de M INTEIRO e só então se troca por `rename`, no mesmo padrão de
 * `restaurar.ts`. Arquivo ligado a N nunca é aberto para escrita: "mudado" é arquivo novo, não edição. Falha em
 * qualquer ponto antes da troca deixa N intacto. Falha ao avisar o cartório NÃO desfaz a troca (a cópia é válida).
 */
import { constants } from "node:fs";
import { copyFile, link, lstat, mkdir, realpath, rename, rm } from "node:fs/promises";
import { dirname, join, resolve, sep } from "node:path";
import {
  compararManifestos,
  gerarManifesto,
  validarManifesto,
  type ArquivoDoManifesto,
  type Diferenca,
  type Manifesto,
} from "../backup/manifesto.js";
import {
  apagarMarcadorTroca,
  desfazer,
  exigirMundoNaPastaDoServidor,
  gravarMarcadorTroca,
  haMundo,
} from "../backup/restaurar.js";
import { travaConfirmada } from "../servidor/processo.js";
import { pedirArquivo, type OpcoesPedido } from "./transferencia.js";

const PRAZO_TRAVA_PADRAO_MS = 10_000;

export interface OpcoesAplicar {
  pastaDoMundo: string;
  /** Manifesto de M (a versão que o cartório diz ser a mais nova); é validado aqui. */
  alvo: Manifesto;
  /** Manifesto de N, do pacote fechado. Ausente: gera-se da pasta (parada). */
  local?: Manifesto;
  /** Entrega o arquivo de M (já conferido pelo hash) em `destino`, que não existe ainda. */
  baixar: (arquivo: ArquivoDoManifesto, destino: string) => Promise<unknown>;
  /** A trava de atualização deste PC vale agora (renovada na hora). Pedida antes de cada passo da troca. */
  temAtualizacao: () => Promise<boolean>;
  /** Este PC tem a trava de host? Erro ou demora contam como "sim": o mundo vivo nunca é tocado. */
  hospedaAgora: () => Promise<boolean>;
  servidorParado: () => boolean;
  /**
   * Só a conta LOCAL do prazo da trava de atualização (sem rede). Usada entre os dois `rename`: ali cada segundo de
   * espera de rede é um segundo sem mundo no lugar. Ausente: usa `temAtualizacao`.
   */
  temAtualizacaoLocal?: () => Promise<boolean>;
  /** Depois de cada arquivo entregue: quantos dos que precisam vir já vieram. Só para a tela; nada depende disto. */
  aoProgresso?: (feitos: number, total: number) => void;
  /** Diz ao cartório que este PC tem a versão M (cliente.informarCopia). */
  avisarCopia: (versao: number) => Promise<void>;
  /** Pasta do servidor, onde `podeSubir` procura o marcador da troca: o mundo tem de ser filho direto dela. */
  pastaDoServidor?: string;
  prazoTravaMs?: number;
  /** Só para os testes. */
  renomear?: (de: string, para: string) => Promise<void>;
  ligar?: (de: string, para: string) => Promise<void>;
  /** Só para os testes: roda entre os dois `rename`; o que lançar simula o app morrendo ali (sem limpeza). */
  aposPrimeiroRename?: () => void | Promise<void>;
}

export interface Aplicado {
  diferenca: Diferenca;
  arquivosBaixados: number;
  bytesBaixados: number;
  /** O aviso ao cartório falhou; a troca valeu. Quem chama tenta de novo depois. */
  avisoCartorio?: Error;
  /** Sobra do `.antigo` que não pôde ser apagado (compartilha dados com o mundo: apague com o servidor desligado). */
  mundoAntigoRestante?: string;
}

const apagar = (p: string) => rm(p, { recursive: true, force: true });

/** Recurso de `baixar` em produção: pede o arquivo de M, por hash, ao PC que hospeda (rede privada). */
export const baixarDoHost =
  (origem: Pick<OpcoesPedido, "endereco" | "porta" | "token" | "permitirLoopbackParaTeste">) =>
  (arquivo: ArquivoDoManifesto, destino: string) =>
    pedirArquivo({ ...origem, sha256: arquivo.sha256, destino, tamanhoMaximo: arquivo.tamanho });

/** Este PC não hospeda agora: servidor dele parado e sem a trava de host (confirmado "não" dentro do prazo). */
export async function exigirForaDoHost(
  o: Pick<OpcoesAplicar, "servidorParado" | "hospedaAgora" | "prazoTravaMs">,
): Promise<void> {
  if (!o.servidorParado()) {
    throw new Error("O servidor está rodando; pare o servidor antes de atualizar o mundo.");
  }
  const naoHospeda = async () => (await o.hospedaAgora()) === false;
  if ((await travaConfirmada(naoHospeda, o.prazoTravaMs ?? PRAZO_TRAVA_PADRAO_MS)) !== "sim") {
    throw new Error(
      "Este PC está hospedando (ou o cartório não confirmou que não está); o mundo dele não é atualizado agora.",
    );
  }
}

/** Antes de cada passo da troca: fora do host E trava de atualização confirmada (renovada) no prazo. */
async function exigirPodeTrocar(o: OpcoesAplicar, entreRenames = false): Promise<void> {
  // Entre os renames: sem rede (a consulta ao cartório poderia levar ~20 s com o mundo fora do lugar). O host não
  // muda ali: o cartório não dá o host enquanto a trava de atualização vale, e `temAtualizacaoLocal` é essa conta.
  if (entreRenames) {
    if (!o.servidorParado()) {
      throw new Error("O servidor está rodando; pare o servidor antes de atualizar o mundo.");
    }
  } else await exigirForaDoHost(o);
  const confere = entreRenames && o.temAtualizacaoLocal ? o.temAtualizacaoLocal : o.temAtualizacao;
  const trava = await travaConfirmada(confere, o.prazoTravaMs ?? PRAZO_TRAVA_PADRAO_MS);
  if (trava !== "sim") {
    throw new Error(
      "Este PC perdeu (ou não tem) a trava de atualização do cartório; o mundo continua como estava. Tento de novo depois.",
    );
  }
}

/** Caminho do manifesto (já validado) dentro de `raiz`; confere de novo que não escapa. */
function dentro(raiz: string, caminho: string): string {
  const completo = resolve(raiz, caminho);
  if (!completo.startsWith(raiz + sep))
    throw new Error(`Caminho fora do mundo recusado: ${caminho}`);
  return completo;
}

/** Hard link do arquivo de N; se não der (outro disco, Windows), copia. Nunca escreve no arquivo de origem. */
async function trazerIgual(
  raizReal: string,
  relativo: string,
  de: string,
  para: string,
  ligar: (de: string, para: string) => Promise<void>,
): Promise<void> {
  const info = await lstat(de);
  // lstat só olha o último componente: o realpath pega pasta intermediária que seja link simbólico para fora.
  if (!info.isFile() || (await realpath(de)) !== join(raizReal, relativo)) {
    throw new Error(
      `O arquivo "${relativo}" do mundo atual não é um arquivo comum dentro do mundo (link simbólico?); nada foi alterado.`,
    );
  }
  await mkdir(dirname(para), { recursive: true });
  try {
    await ligar(de, para);
  } catch {
    await copyFile(de, para, constants.COPYFILE_EXCL);
  }
}

export async function aplicarDelta(o: OpcoesAplicar): Promise<Aplicado> {
  const renomear = o.renomear ?? rename;
  const ligar = o.ligar ?? link;
  const alvo = validarManifesto(o.alvo);
  const mundo = resolve(o.pastaDoMundo); // barra no fim colocaria a temporária DENTRO do mundo
  const temp = `${mundo}.atualizando-v${alvo.versao}`;
  const antigo = `${mundo}.antigo-v${alvo.versao}`;

  exigirMundoNaPastaDoServidor(mundo, o.pastaDoServidor);
  await exigirPodeTrocar(o);
  if (!(await haMundo(mundo))) {
    throw new Error("Não há mundo neste PC para atualizar; use a cópia completa do mundo.");
  }
  if ((await lstat(temp).catch(() => undefined)) || (await lstat(antigo).catch(() => undefined))) {
    throw new Error(
      "Já existe uma atualização (ou mundo antigo) pela metade; não escrevi por cima.",
    );
  }

  const local = o.local
    ? validarManifesto(o.local)
    : await gerarManifesto(mundo, { versao: 0, epoca: 0 });
  const diferenca = compararManifestos(local, alvo);
  const baixar = new Set([...diferenca.novos, ...diferenca.mudados]);

  const mundoReal = await realpath(mundo);
  let arquivosBaixados = 0;
  let bytesBaixados = 0;
  try {
    await mkdir(temp);
    for (const a of alvo.arquivos) {
      const destino = dentro(temp, a.caminho);
      if (baixar.has(a.caminho)) {
        await mkdir(dirname(destino), { recursive: true });
        await o.baixar(a, destino);
        arquivosBaixados++;
        bytesBaixados += a.tamanho;
        o.aoProgresso?.(arquivosBaixados, baixar.size);
      } else {
        await trazerIgual(mundoReal, a.caminho, dentro(mundo, a.caminho), destino, ligar);
      }
    }
    // M INTEIRO, inclusive os iguais: o que foi ligado/copiado também tem de bater com o hash de M.
    const montado = await gerarManifesto(temp, { versao: alvo.versao, epoca: alvo.epoca });
    const esperado = new Map(alvo.arquivos.map((a) => [a.caminho, a]));
    const confere =
      montado.arquivos.length === esperado.size &&
      montado.arquivos.every((a) => {
        const e = esperado.get(a.caminho);
        return e?.sha256 === a.sha256 && e.tamanho === a.tamanho;
      });
    if (!confere) {
      throw new Error(
        "O mundo atualizado não confere com a versão do cartório (arquivo faltando, a mais ou diferente); nada foi trocado. Tente de novo; se repetir, avise o grupo.",
      );
    }
    // Renovada depois do download, logo antes do marcador e do 1º rename (1.8b a): a trava pode ter se perdido no
    // download, e o prazo do cartório vencido deixaria este PC pegar o host no meio da troca.
    await exigirPodeTrocar(o);
  } catch (erro) {
    await apagar(temp);
    throw erro;
  }

  // Sem marcador gravado a troca não começa: a temporária não pode ficar órfã.
  await gravarMarcadorTroca({ mundo, antigo, temp }).catch(async (erro: unknown) => {
    await apagar(temp);
    throw erro;
  });
  await renomear(mundo, antigo).catch(async (erro: unknown) => {
    await apagar(temp);
    await apagarMarcadorTroca(mundo);
    throw new Error("Não consegui tirar o mundo atual do lugar; o mundo continua como estava.", {
      cause: erro,
    });
  });
  await o.aposPrimeiroRename?.();
  const voltarN = async (erro: unknown) => {
    await desfazer(renomear, { mundo, antigo, temp, backup: undefined }, erro);
    await apagarMarcadorTroca(mundo);
    await apagar(temp);
  };
  // E antes do 2º: sem a trava (ou com o servidor de pé), M não entra e N volta ao lugar.
  await exigirPodeTrocar(o, true).catch(async (erro: unknown) => {
    await voltarN(erro);
    throw erro;
  });
  try {
    await renomear(temp, mundo);
  } catch (erro) {
    await voltarN(erro);
    throw new Error(
      "Não consegui colocar o mundo atualizado no lugar; o mundo continua como estava.",
      {
        cause: erro,
      },
    );
  }

  // O mundo novo já está no lugar: falhar ao apagar o marcador (ex.: antivírus) não pode virar "desfazer". O
  // marcador sobra e a próxima partida (`recuperarTroca`) só o limpa.
  await apagarMarcadorTroca(mundo).catch(() => undefined);
  const resultado: Aplicado = { diferenca, arquivosBaixados, bytesBaixados };
  try {
    await o.avisarCopia(alvo.versao);
  } catch (erro) {
    resultado.avisoCartorio = erro instanceof Error ? erro : new Error(String(erro));
  }
  // Já trocado e conferido; se o .antigo não sair, sobra lixo (e ele divide dados com o mundo: o aviso diz isso).
  if (
    await apagar(antigo).then(
      () => false,
      () => true,
    )
  )
    resultado.mundoAntigoRestante = antigo;
  return resultado;
}
