import { Renovador, type OpcoesRenovador } from "@sabrehosting/nucleo/cartorio/renovador";
import {
  espalhar,
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
  cliente: OpcoesRenovador["cliente"] & { informarCopia(versao: number): Promise<void> };
  servidorRodando: () => boolean;
  /** Versão do pacote que este PC tem agora (maior `versao` dos backups). */
  versaoLocal: () => Promise<number>;
  /** Só para teste: aceita 127.0.0.1. Nunca ligado pelo app. */
  permitirLoopbackParaTeste?: boolean;
}

const SEM_PASTA = "Este PC ainda não tem as pastas do mundo e do servidor configuradas.";

/**
 * Liga o núcleo ao app: puxa a versão nova de quem já tem, em segundo plano. Quem chama (a agenda/aviso do
 * cartório, item do cartório) diz a versão e as fontes; aqui não há relógio. A troca exige a trava de host
 * (regra de ouro 1): se ela está com outro PC, o espalhar espera a próxima chamada em vez de contornar.
 */
export function criarEspalhador(o: OpcoesEspalhador) {
  return async (versao: VersaoNova, fontes: readonly Fonte[]): Promise<Espalhado> => {
    const { pastaDoMundo, pastaDoServidor } = o;
    if (!pastaDoMundo || !pastaDoServidor) throw new Error(SEM_PASTA);
    if (o.servidorRodando()) {
      throw new Error("O servidor deste PC está no ar; a atualização do mundo fica para depois.");
    }
    const renovador = new Renovador({ cliente: o.cliente, aoPerder: () => undefined });
    // Só solta a vez que ESTA atualização pegou: se o `pegar` falhar, nada foi pego e nada é solto.
    await renovador.pegar().catch((erro: unknown) => {
      throw new Error(
        "Não consegui pegar a vez para atualizar o mundo (talvez outro PC esteja hospedando). Tento de novo depois.",
        { cause: erro },
      );
    });
    try {
      return await espalhar({
        pastaDoMundo,
        pastaDoServidor,
        pastaTemporaria: o.pastaTemporaria,
        versao,
        versaoLocal: await o.versaoLocal(),
        fontes,
        token: o.token,
        temTrava: () => renovador.temTrava(),
        servidorParado: () => !o.servidorRodando(),
        avisarCopia: (n) => o.cliente.informarCopia(n),
        ...(o.permitirLoopbackParaTeste ? { permitirLoopbackParaTeste: true } : {}),
      });
    } finally {
      await renovador.soltar().catch(() => undefined);
    }
  };
}
