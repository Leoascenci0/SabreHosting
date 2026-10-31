import type { ClienteCartorio } from "@sabrehosting/nucleo/cartorio/cliente";
import {
  espalhar,
  fontesDeCopias,
  type Espalhado,
  type Fonte,
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
  return async (versao: VersaoNova, fontes: readonly Fonte[]): Promise<Espalhado> => {
    const { pastaDoMundo, pastaDoServidor } = o;
    if (!pastaDoMundo || !pastaDoServidor) throw new Error(SEM_PASTA);
    if (o.servidorRodando()) {
      throw new Error("O servidor deste PC está no ar; a atualização do mundo fica para depois.");
    }
    if (emCurso) throw new Error(JA_ATUALIZANDO);
    emCurso = true; // antes de qualquer await (S-06)
    try {
      // Um Java de sessão anterior ainda de pé usa o mundo mesmo sem `servidorRodando`: na dúvida, não troca.
      if (await o.servidorOrfao?.().catch(() => true)) {
        throw new Error(
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
  cliente: Pick<ClienteCartorio, "maisNova" | "quemTem" | "eu">;
  espalhar: ReturnType<typeof criarEspalhador>;
  /** Versão do pacote que este PC tem agora; só pergunta ao cartório pelas fontes se a mais nova for maior. */
  versaoLocal: () => Promise<number>;
  aoAvisar?: (texto: string) => void;
}

/**
 * Dispara a atualização em segundo plano: pergunta ao cartório a versão mais nova e quem a tem, e chama o espalhador.
 * Nunca lança (quem chama não espera): erro vira aviso. Sem versão nova ou sem fonte com IP, não faz nada. Fontes só de
 * PCs (a nuvem não serve arquivo por hash) e sem este PC; o IP vem do cartório e é validado de novo em `espalhar`.
 */
export function criarGatilhoEspalhar(o: OpcoesGatilho): () => Promise<void> {
  return async () => {
    try {
      const nova = await o.cliente.maisNova();
      if (!nova || nova.numero <= (await o.versaoLocal())) return;
      const [eu, copias] = await Promise.all([o.cliente.eu(), o.cliente.quemTem(nova.numero)]);
      const fontes = fontesDeCopias(copias, eu.id);
      if (fontes.length === 0) return; // ninguém com IP ainda: tenta na próxima rodada
      await o.espalhar({ numero: nova.numero, manifestoSha256: nova.manifestoSha256 }, fontes);
    } catch (erro) {
      o.aoAvisar?.(`Atualização do mundo: ${erro instanceof Error ? erro.message : String(erro)}`);
    }
  };
}
