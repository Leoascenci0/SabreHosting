/**
 * Espalhar a versão nova: este PC leva o mundo da versão N para a M (a que o cartório diz ser a mais nova) puxando
 * só o que mudou de quem já tem (outro PC ou o host), pela rede privada, em segundo plano.
 *
 * Regras de ouro 1, 2, 3 e 5: nenhuma escrita aqui; quem troca o mundo é `aplicarDelta` (servidor parado, trava
 * confirmada, pasta temporária, manifesto de M inteiro conferido, `rename`). Falha em qualquer ponto antes da troca
 * deixa N intacto. As fontes e o manifesto vêm da rede: são entrada não confiável (endereço validado; manifesto
 * conferido pelo hash que o cartório registrou e pela versão). Sem relógio próprio: quem chama decide quando.
 */
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { join, resolve } from "node:path";
import { validarManifesto, type ArquivoDoManifesto } from "../backup/manifesto.js";
import { exigirMundoNaPastaDoServidor } from "../backup/restaurar.js";
import { aplicarDelta, type Aplicado, type OpcoesAplicar } from "./aplicar.js";
import { conferirEnderecoPrivado, pedirArquivo } from "./transferencia.js";

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

export interface OpcoesEspalhar extends Pick<
  OpcoesAplicar,
  "temTrava" | "servidorParado" | "avisarCopia" | "prazoTravaMs" | "renomear" | "ligar"
> {
  pastaDoMundo: string;
  /** Obrigatória aqui: sem ela o marcador da troca não seria visto por `podeSubir`. */
  pastaDoServidor: string;
  /** Prefixo de uma pasta nova (criada e apagada aqui) para o manifesto; a pasta-mãe tem de existir. */
  pastaTemporaria: string;
  versao: VersaoNova;
  /** Versão do pacote que este PC tem agora. */
  versaoLocal: number;
  fontes: readonly Fonte[];
  /** Token deste PC (nunca vai para log nem para mensagem). */
  token: string;
  tentativas?: number;
  permitirLoopbackParaTeste?: boolean;
  /** Só para os testes: roda antes de cada arquivo; o que lançar simula a rede caindo ali. */
  aoBaixar?: (arquivo: ArquivoDoManifesto) => void | Promise<void>;
}

export type Espalhado =
  | { estado: "ja-tinha"; arquivosBaixados: 0; bytesBaixados: 0 }
  | ({ estado: "atualizado" } & Aplicado);

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
  // Barreiras baratas antes de qualquer rede; `aplicarDelta` confere tudo de novo antes de trocar.
  exigirMundoNaPastaDoServidor(resolve(o.pastaDoMundo), o.pastaDoServidor);
  if (!o.servidorParado()) {
    throw new Error("O servidor está rodando; pare o servidor antes de atualizar o mundo.");
  }
  const fontes = escolherFontes(o.fontes, o.permitirLoopbackParaTeste);

  const pedir = async (sha256: string, destino: string, tamanhoMaximo: number) => {
    let ultimo: unknown;
    for (const f of fontes) {
      try {
        return await pedirArquivo({
          endereco: f.endereco,
          porta: f.porta,
          sha256,
          destino,
          token: o.token,
          tamanhoMaximo,
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

  // Pasta própria e nova; só ela é apagada no fim.
  const dir = await mkdtemp(`${resolve(o.pastaTemporaria)}-`);
  try {
    const arquivo = join(dir, "manifesto.json");
    await pedir(o.versao.manifestoSha256, arquivo, TETO_MANIFESTO);
    const alvo = validarManifesto(JSON.parse(await readFile(arquivo, "utf8")));
    if (alvo.versao !== o.versao.numero) {
      throw new Error(
        `O manifesto recebido é da versão ${alvo.versao}, mas o cartório diz que a mais nova é a ${o.versao.numero}; nada foi trocado.`,
      );
    }
    const aplicado = await aplicarDelta({
      pastaDoMundo: o.pastaDoMundo,
      pastaDoServidor: o.pastaDoServidor,
      alvo,
      temTrava: o.temTrava,
      servidorParado: o.servidorParado,
      avisarCopia: o.avisarCopia,
      ...(o.prazoTravaMs !== undefined ? { prazoTravaMs: o.prazoTravaMs } : {}),
      ...(o.renomear ? { renomear: o.renomear } : {}),
      ...(o.ligar ? { ligar: o.ligar } : {}),
      baixar: async (a, destino) => {
        await o.aoBaixar?.(a);
        await pedir(a.sha256, destino, a.tamanho);
      },
    });
    return { estado: "atualizado", ...aplicado };
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
