import { ErroCartorio, type ClienteCartorio } from "@sabrehosting/nucleo/cartorio/cliente";
import { alcancar } from "@sabrehosting/nucleo/sync/alcancar";
import { ErroLocal } from "@sabrehosting/nucleo/sync/aplicar";
import {
  espalhar,
  type Espalhado,
  type Fonte,
  type PacoteDaNuvem,
  type VersaoNova,
} from "@sabrehosting/nucleo/sync/espalhar";

export interface OpcoesEspalhador {
  /** Pasta do mundo (até app-1.3: `SABRE_PASTA_MUNDO`). */
  pastaDoMundo: string | undefined;
  /** Pasta do servidor (até app-1.3: `SABRE_PASTA_SERVIDOR`); o mundo tem de estar direto dentro dela. */
  pastaDoServidor: string | undefined;
  /** Pasta-prefixo para o manifesto baixado (o núcleo cria e apaga uma pasta nova a partir dela). */
  pastaTemporaria: string;
  /** Token deste PC para pedir arquivos aos outros PCs (o mesmo do cartório). */
  token: string;
  cliente: Pick<
    ClienteCartorio,
    | "pegarAtualizacao"
    | "renovarAtualizacao"
    | "soltarAtualizacao"
    | "informarCopia"
    | "eu"
    | "estadoTrava"
  >;
  servidorRodando: () => boolean;
  /** Servidor de sessão anterior ainda vivo na pasta? Erro ou "sim" recusam (o lado seguro). */
  servidorOrfao?: () => Promise<boolean>;
  /** Versão do pacote que este PC tem agora (maior `versao` dos backups). */
  versaoLocal: () => Promise<number>;
  /** Limite de banda em bytes/s, lido a cada rodada (Configurações › Backups › Limite de banda). */
  limiteBytesPorSeg?: () => number | undefined;
  /** Só para teste: aceita 127.0.0.1. Nunca ligado pelo app. */
  permitirLoopbackParaTeste?: boolean;
}

const SEM_PASTA = "Este PC ainda não tem as pastas do mundo e do servidor configuradas.";
const JA_ATUALIZANDO = "Este PC já está atualizando o mundo; espere essa atualização terminar.";

/**
 * Liga o núcleo ao app: puxa a versão nova de quem já tem, em segundo plano. Quem chama (a agenda/aviso do
 * cartório, item do cartório) diz a versão e as fontes; aqui não há relógio. A troca usa a trava de ATUALIZAÇÃO
 * (syncmel-1.8b), não a de host: outro PC pode estar hospedando. Este PC, se hospeda, não atualiza (o mundo vivo não
 * se toca). Uma atualização por vez: duas disputariam a mesma pasta temporária e a mesma trava.
 */
export function criarEspalhador(o: OpcoesEspalhador) {
  const c = o.cliente;
  let emCurso = false;
  /** O cartório diz que a trava de host é deste PC (o dono só aparece com o prazo valendo). */
  const hospedaAgora = async () => {
    const [eu, trava] = await Promise.all([c.eu(), c.estadoTrava()]);
    return trava.dono?.id === eu.id;
  };
  return async (
    versao: VersaoNova,
    fontes: readonly Fonte[],
    nuvem?: PacoteDaNuvem,
    aoProgresso?: (feitos: number, total: number) => void,
  ): Promise<Espalhado> => {
    const { pastaDoMundo, pastaDoServidor } = o;
    if (!pastaDoMundo || !pastaDoServidor) throw new ErroLocal(SEM_PASTA);
    if (o.servidorRodando()) {
      throw new ErroLocal(
        "O servidor deste PC está no ar; a atualização do mundo fica para depois.",
      );
    }
    if (emCurso) throw new ErroLocal(JA_ATUALIZANDO);
    emCurso = true; // antes de qualquer await (S-06)
    try {
      // Um Java de sessão anterior ainda de pé usa o mundo mesmo sem `servidorRodando`: na dúvida, não troca.
      if (await o.servidorOrfao?.().catch(() => true)) {
        throw new ErroLocal(
          "Sobrou um servidor de antes aberto neste PC; feche o Java e a atualização do mundo continua depois.",
        );
      }
      return await espalhar({
        pastaDoMundo,
        pastaDoServidor,
        pastaTemporaria: o.pastaTemporaria,
        versao,
        versaoLocal: await o.versaoLocal(),
        fontes,
        ...(nuvem ? { nuvem } : {}),
        ...(aoProgresso ? { aoProgresso } : {}),
        token: o.token,
        atualizacao: {
          pegar: () => c.pegarAtualizacao(),
          renovar: (epoca, sinal) => c.renovarAtualizacao(epoca, sinal),
          soltar: (epoca) => c.soltarAtualizacao(epoca),
        },
        hospedaAgora,
        servidorParado: () => !o.servidorRodando(),
        avisarCopia: (n) => c.informarCopia(n),
        ...(o.limiteBytesPorSeg ? { limiteBytesPorSeg: o.limiteBytesPorSeg } : {}),
        ...(o.permitirLoopbackParaTeste ? { permitirLoopbackParaTeste: true } : {}),
      });
    } finally {
      emCurso = false;
    }
  };
}

export interface OpcoesGatilho {
  cliente: Pick<ClienteCartorio, "maisNova" | "quemTem" | "eu" | "baixarPacote">;
  espalhar: ReturnType<typeof criarEspalhador>;
  /** Versão do pacote que este PC tem agora. */
  versaoLocal: () => Promise<number>;
  /** Percentual da atualização em curso (a tela mostra); `undefined` = acabou. */
  aoProgresso?: (percentual: number | undefined) => void;
  /** `texto` (com o erro bruto) é só para o console; `paraTela` é seguro de mostrar (sem caminho, IP ou porta). */
  aoAvisar?: (texto: string, paraTela: string) => void;
}

const FALHA_GENERICA = "Não deu para atualizar seu mundo agora. Tento de novo em alguns minutos.";

/** Só mensagens fixas em pt-BR do app (ErroLocal/ErroCartorio) vão à tela; o resto pode ter caminho ou endereço. */
export function textoSeguroParaTela(erro: unknown): string {
  return erro instanceof ErroLocal || erro instanceof ErroCartorio ? erro.message : FALHA_GENERICA;
}

/**
 * Dispara a atualização em segundo plano (sync-2.2, `alcancar`): leva este PC à versão mais nova, de PC online ou, sem
 * PC, do pacote da nuvem. Nunca lança (quem chama não espera): erro vira aviso. Sem versão nova, não faz nada.
 */
export function criarGatilhoEspalhar(o: OpcoesGatilho): () => Promise<void> {
  let emCurso = false;
  return async () => {
    // Uma rodada por vez, marcada ANTES de qualquer await (S-06): a 2ª sai sem tocar no progresso, e só a rodada dona
    // do estado "atualizando" o limpa (senão Hospedar abriria no meio da atualização da 1ª).
    if (emCurso) return;
    emCurso = true;
    try {
      await alcancar({
        cliente: o.cliente,
        espalhar: o.espalhar,
        versaoLocal: o.versaoLocal,
        ...(o.aoProgresso ? { aoProgresso: o.aoProgresso } : {}),
      });
    } catch (erro) {
      o.aoAvisar?.(
        `Atualização do mundo: ${erro instanceof Error ? erro.message : String(erro)}`,
        textoSeguroParaTela(erro),
      );
    } finally {
      emCurso = false;
    }
  };
}
