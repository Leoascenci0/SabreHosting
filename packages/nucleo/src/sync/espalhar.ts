/**
 * Espalhar a versão nova: este PC leva o mundo da versão N para a M (a que o cartório diz ser a mais nova) puxando
 * só o que mudou de quem já tem (outro PC ou o host), pela rede privada, em segundo plano.
 *
 * Regras de ouro 1, 2, 3 e 5: nenhuma escrita aqui; quem troca o mundo é `aplicarDelta` (servidor parado, fora do
 * host, trava de atualização confirmada, pasta temporária, manifesto de M inteiro conferido, `rename`). Falha em
 * qualquer ponto antes da troca deixa N intacto. As fontes e o manifesto vêm da rede: são entrada não confiável
 * (endereço validado; manifesto conferido pelo hash que o cartório registrou e pela versão). Quem chama decide quando.
 *
 * Trava de atualização (syncmel-1.8b): separada da de host, deixa este PC atualizar a PRÓPRIA cópia com outro PC
 * hospedando, e enquanto vale o cartório não lhe dá o host. Pega só com o servidor parado e fora do host; um
 * `Renovador` por chamada (um só relógio, parado no `finally`); renovada antes de cada passo da troca; perdida, o
 * próximo arquivo não baixa e a troca não começa; sempre solta no fim (também em erro).
 */
import { createHash } from "node:crypto";
import { constants } from "node:fs";
import { copyFile, mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validarManifesto, type ArquivoDoManifesto, type Manifesto } from "../backup/manifesto.js";
import { abrirPacote } from "../backup/pacote.js";
import { exigirMundoNaPastaDoServidor } from "../backup/restaurar.js";
import { Renovador, type ClienteDeTrava, type OpcoesRenovador } from "../cartorio/renovador.js";
import { aplicarDelta, exigirForaDoHost, type Aplicado, type OpcoesAplicar } from "./aplicar.js";
import type { Copias } from "../cartorio/tipos.js";
import {
  conferirEnderecoPrivado,
  ehEnderecoPrivado,
  pedirArquivo,
  PORTA_ESPALHAR,
} from "./transferencia.js";

/** Quem já tem a versão e serve os arquivos (`servirArquivos`) na rede privada. */
export interface Fonte {
  tipo: "host" | "pc";
  endereco: string;
  porta: number;
}

/** A versão nova segundo o cartório: o número e o hash do manifesto (o manifesto em si viaja de PC a PC). */
export interface VersaoNova {
  numero: number;
  manifestoSha256: string;
}

const TETO_MANIFESTO = 32 * 1024 * 1024;
const HASH_SHA256 = /^[0-9a-f]{64}$/;

/**
 * Fontes a partir de `quemTem`: os PCs com a versão, menos este (`euId`) e menos quem ainda não tem IP na rede privada
 * (`ip === null`: PC recém-chegado) e quem tem IP fora da rede privada (sem estes filtros um só deles derrubaria a
 * lista toda em `escolherFontes`). A nuvem
 * não entra: ela serve só o pacote fechado, não arquivo por hash. Vazia é possível; quem chama decide.
 */
export function fontesDeCopias(copias: Copias, euId: number): Fonte[] {
  return copias.pcs.flatMap((p) =>
    p.id === euId || p.ip === null || !ehEnderecoPrivado(p.ip)
      ? []
      : [{ tipo: "pc" as const, endereco: p.ip, porta: PORTA_ESPALHAR }],
  );
}

/** Fontes válidas, sem repetida, PCs antes do host (o host é quem está jogando: poupá-lo). Vazia é erro. */
export function escolherFontes(
  fontes: readonly Fonte[],
  permitirLoopbackParaTeste = false,
): Fonte[] {
  const vistas = new Set<string>();
  const validas: Fonte[] = [];
  for (const f of fontes) {
    conferirEnderecoPrivado(f.endereco, permitirLoopbackParaTeste);
    if (!Number.isInteger(f.porta) || f.porta < 1 || f.porta > 65535) {
      throw new Error(`Porta "${f.porta}" recusada: a transferência usa uma porta de 1 a 65535.`);
    }
    const chave = `${f.endereco}:${f.porta}`;
    if (vistas.has(chave)) continue;
    vistas.add(chave);
    validas.push(f);
  }
  if (validas.length === 0) throw new Error("Nenhum PC tem a versão nova para puxar agora.");
  return [...validas.filter((f) => f.tipo === "pc"), ...validas.filter((f) => f.tipo === "host")];
}

/** Pacote fechado da versão que a nuvem guarda (último recurso: só quando não há PC para puxar). */
export interface PacoteDaNuvem {
  /** Baixa para `destino` (que não existe) e devolve o hash declarado pela nuvem; quem abre confere. */
  baixar: (destino: string) => Promise<{ sha256: string }>;
}

export interface OpcoesEspalhar extends Pick<
  OpcoesAplicar,
  | "hospedaAgora"
  | "servidorParado"
  | "avisarCopia"
  | "prazoTravaMs"
  | "renomear"
  | "ligar"
  | "aoProgresso"
> {
  /** `/atualizacao/{pegar,renovar,soltar}` do cartório (`pegarAtualizacao`… do cliente). */
  atualizacao: ClienteDeTrava;
  pastaDoMundo: string;
  /** Obrigatória aqui: sem ela o marcador da troca não seria visto por `podeSubir`. */
  pastaDoServidor: string;
  /** Prefixo de uma pasta nova (criada e apagada aqui) para o manifesto; a pasta-mãe tem de existir. */
  pastaTemporaria: string;
  versao: VersaoNova;
  /** Versão do pacote que este PC tem agora. */
  versaoLocal: number;
  fontes: readonly Fonte[];
  /** Usada SÓ com `fontes` vazia (a nuvem nunca é fonte por arquivo); com fontes, é ignorada. */
  nuvem?: PacoteDaNuvem;
  /** Token deste PC (nunca vai para log nem para mensagem). */
  token: string;
  tentativas?: number;
  /** Banda máxima em bytes/s, lida a cada arquivo (mudar em Configurações vale na hora); ausente: sem limite. */
  limiteBytesPorSeg?: () => number | undefined;
  permitirLoopbackParaTeste?: boolean;
  /** Só para os testes: roda antes de cada arquivo; o que lançar simula a rede caindo ali. */
  aoBaixar?: (arquivo: ArquivoDoManifesto) => void | Promise<void>;
  /** Só para os testes: relógios do `Renovador` da trava de atualização. */
  relogioDaTrava?: Pick<OpcoesRenovador, "agora" | "agoraParede">;
}

const SEM_VEZ =
  "Este PC perdeu a trava de atualização do cartório; o mundo continua como estava. Tento de novo depois.";

export type Espalhado =
  | { estado: "ja-tinha"; arquivosBaixados: 0; bytesBaixados: 0 }
  | ({
      estado: "atualizado";
      /** Manifesto de M, conferido inteiro antes da troca (base do delta final da migração). */
      manifesto: Manifesto;
    } & Aplicado);

export async function espalhar(o: OpcoesEspalhar): Promise<Espalhado> {
  if (!Number.isInteger(o.versao.numero) || o.versao.numero < 1) {
    throw new Error("Versão inválida recebida do cartório.");
  }
  if (!HASH_SHA256.test(o.versao.manifestoSha256)) {
    throw new Error("Hash do manifesto inválido recebido do cartório.");
  }
  if (o.versaoLocal >= o.versao.numero) {
    return { estado: "ja-tinha", arquivosBaixados: 0, bytesBaixados: 0 };
  }
  // Barreiras antes de qualquer rede; `aplicarDelta` confere tudo de novo antes de trocar. Fora do host ANTES de
  // pegar a atualização (1.8b b): trava de host vencida com o servidor ainda de pé não pode virar atualização.
  exigirMundoNaPastaDoServidor(resolve(o.pastaDoMundo), o.pastaDoServidor);
  const nuvem = o.fontes.length === 0 ? o.nuvem : undefined;
  const daNuvem = nuvem !== undefined;
  const fontes = daNuvem ? [] : escolherFontes(o.fontes, o.permitirLoopbackParaTeste);
  await exigirForaDoHost(o);

  const pedir = async (sha256: string, destino: string, tamanhoMaximo: number) => {
    let ultimo: unknown;
    for (const f of fontes) {
      try {
        const limite = o.limiteBytesPorSeg?.();
        return await pedirArquivo({
          endereco: f.endereco,
          porta: f.porta,
          sha256,
          destino,
          token: o.token,
          tamanhoMaximo,
          ...(limite !== undefined ? { limiteBytesPorSeg: limite } : {}),
          ...(o.tentativas !== undefined ? { tentativas: o.tentativas } : {}),
          ...(o.permitirLoopbackParaTeste ? { permitirLoopbackParaTeste: true } : {}),
        });
      } catch (erro) {
        ultimo = erro;
      }
    }
    throw new Error("Nenhum PC conseguiu entregar o arquivo agora; o mundo continua como estava.", {
      cause: ultimo,
    });
  };

  const renovador = new Renovador({
    cliente: o.atualizacao,
    aoPerder: () => undefined, // `temTrava` passa a dizer não: o próximo arquivo e a troca param
    trava: "atualização",
    ...o.relogioDaTrava,
  });
  // Só solta o que ESTA chamada pegou: recusado ou sem resposta, nada foi pego e nada é solto.
  await renovador.pegar().catch((erro: unknown) => {
    throw new Error(
      "Não consegui pegar a vez de atualizar o mundo deste PC (o cartório recusou ou não respondeu). Tento de novo depois.",
      { cause: erro },
    );
  });
  // Pasta própria e nova; só ela é apagada no fim.
  let dir: string | undefined;
  try {
    dir = await mkdtemp(`${resolve(o.pastaTemporaria)}-`);
    let alvo: Manifesto;
    let entregar = (a: ArquivoDoManifesto, destino: string): Promise<unknown> =>
      pedir(a.sha256, destino, a.tamanho);
    if (daNuvem) {
      // Pacote fechado: hash do pacote e de cada arquivo conferidos por `abrirPacote`; o manifesto de dentro tem de ser
      // o que o cartório registrou (hash do JSON). Os arquivos ficam extraídos ao lado e vão ao `aplicarDelta`.
      const pacote = join(dir, "pacote.tar.gz");
      const { sha256 } = await nuvem.baixar(pacote);
      const extraido = join(dir, "nuvem");
      alvo = await abrirPacote(pacote, sha256, extraido);
      await rm(pacote, { force: true });
      if (
        createHash("sha256").update(JSON.stringify(alvo)).digest("hex") !== o.versao.manifestoSha256
      ) {
        throw new Error(
          "O pacote da nuvem não é o que o cartório registrou para essa versão; nada foi trocado.",
        );
      }
      entregar = (a, destino) =>
        copyFile(join(extraido, ...a.caminho.split("/")), destino, constants.COPYFILE_EXCL);
    } else {
      const arquivo = join(dir, "manifesto.json");
      await pedir(o.versao.manifestoSha256, arquivo, TETO_MANIFESTO);
      alvo = validarManifesto(JSON.parse(await readFile(arquivo, "utf8")));
    }
    if (alvo.versao !== o.versao.numero) {
      throw new Error(
        `O manifesto recebido é da versão ${alvo.versao}, mas o cartório diz que a mais nova é a ${o.versao.numero}; nada foi trocado.`,
      );
    }
    const aplicado = await aplicarDelta({
      pastaDoMundo: o.pastaDoMundo,
      pastaDoServidor: o.pastaDoServidor,
      alvo,
      temAtualizacao: () => renovador.renovarAgora(),
      temAtualizacaoLocal: () => renovador.temTrava(),
      hospedaAgora: o.hospedaAgora,
      servidorParado: o.servidorParado,
      avisarCopia: o.avisarCopia,
      ...(o.prazoTravaMs !== undefined ? { prazoTravaMs: o.prazoTravaMs } : {}),
      ...(o.renomear ? { renomear: o.renomear } : {}),
      ...(o.ligar ? { ligar: o.ligar } : {}),
      baixar: async (a, destino) => {
        if (!(await renovador.temTrava())) throw new Error(SEM_VEZ);
        await o.aoBaixar?.(a);
        await entregar(a, destino);
      },
      ...(o.aoProgresso ? { aoProgresso: o.aoProgresso } : {}),
    });
    return { estado: "atualizado", manifesto: alvo, ...aplicado };
  } finally {
    // Sempre: para o relógio e devolve a vez (falhar ao soltar não esconde o resultado; o prazo vence sozinho).
    await renovador.soltar().catch(() => undefined);
    if (dir) await rm(dir, { recursive: true, force: true });
  }
}
