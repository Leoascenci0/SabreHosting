import { dirname, resolve } from "node:path";
import {
  adiarVersaoDoMundo,
  descartarPendencia,
  desfazerUltimoReset,
  marcarMundoTrocando,
  publicarVersaoDoMundo,
  retomarVersaoPendente,
  type ClienteVersao,
  type Desfeito,
  type OpcoesVersaoReset,
  type Publicacao,
} from "@sabrehosting/nucleo/mundo/versao-reset";
import {
  comVez,
  restaurarNaVez,
  type OpcoesDepsBackups,
  type VezDeHospedar,
} from "./deps-backups.js";

export interface OpcoesMundoVersao extends OpcoesDepsBackups {
  cliente: OpcoesDepsBackups["cliente"] & ClienteVersao;
}

const SEM_PASTA = "Este PC ainda não tem a pasta do mundo e a pasta de backups configuradas.";
const NO_AR =
  "O servidor deste PC ainda está no ar. Pare o servidor (e feche o Java, se sobrou) antes de mexer na versão do mundo.";

/**
 * Liga a versão do mundo e o "Desfazer" do reset ao cartório (chunk-1.4). Cada ação pega a vez de hospedar UMA vez, faz
 * tudo dentro dela (restaurar e publicar não deixam a vez escapar entre os dois) e solta. Não decide quem pode
 * resetar nem recusa por demonstração: isso é do `mundo:*` do 1.5.
 */
export function depsMundoVersao(o: OpcoesMundoVersao) {
  const base = async (): Promise<
    Omit<OpcoesVersaoReset, "epoca" | "temTrava" | "renovarAgora">
  > => {
    const pastaDoMundo = (await o.mundoAgora?.()) ?? o.pastaDoMundo;
    if (!o.pastaBackups || !pastaDoMundo) throw new Error(SEM_PASTA);
    if (o.servidorRodando() || (await o.servidorOrfao?.().catch(() => true)))
      throw new Error(NO_AR);
    return {
      pastaDoMundo,
      pastaBackups: o.pastaBackups,
      pastaDoServidor: o.pastaDoServidor ?? dirname(resolve(pastaDoMundo)),
      cliente: o.cliente,
      servidorParado: () => !o.servidorRodando(),
    };
  };
  const completo = (
    b: Awaited<ReturnType<typeof base>>,
    vez: VezDeHospedar,
  ): OpcoesVersaoReset => ({
    ...b,
    epoca: vez.epoca,
    temTrava: vez.temTrava,
    renovarAgora: vez.renovarAgora,
  });
  /** Publica; qualquer falha depois da troca cai no adiar (pacote + marcador), sem precisar de trava. */
  const publicarOuAdiar = async (b: Awaited<ReturnType<typeof base>>): Promise<Publicacao> => {
    try {
      return await comVez(
        o,
        (vez) => publicarVersaoDoMundo(completo(b, vez)),
        "publicar a versão do mundo",
      );
    } catch (erro) {
      // O reset já feito não se perde: fica o pacote e o aviso para a retomada. Se nem isso der, vale o erro de cima
      // (o marcador de troca já gravado mantém o servidor bloqueado).
      return adiarVersaoDoMundo(b).catch(() => {
        throw erro;
      });
    }
  };
  return {
    /** Depois do reset: sobe a versão nova (cartório fora = pendente, com aviso). */
    publicar: async (): Promise<Publicacao> => publicarOuAdiar(await base()),
    /**
     * Envolve a troca do mundo (o `resetarMundo` do 1.5, com `versaoPendenteDoFluxo: true`): grava o marcador ANTES,
     * roda `fazer` e publica. Se `fazer` falhar, o marcador fica (servidor bloqueado) e a retomada publica o que
     * estiver no mundo; `descartarPendencia` é a saída explícita do dono.
     */
    protegerTroca: async <T>(
      fazer: () => Promise<T>,
    ): Promise<{ resultado: T; publicacao: Publicacao }> => {
      const b = await base();
      await marcarMundoTrocando(b);
      const resultado = await fazer();
      return { resultado, publicacao: await publicarOuAdiar(b) };
    },
    /** Antes de hospedar: termina a publicação pendente de um reset (`nada` se não há). */
    retomar: async (): Promise<{ estado: "nada" } | Publicacao> => {
      const b = await base();
      return comVez(
        o,
        (vez) => retomarVersaoPendente(completo(b, vez)),
        "concluir a versão do mundo",
      );
    },
    /** Só remove o aviso de versão pendente (nunca mundo nem backup). A confirmação do dono é do 1.5/1.6. */
    descartar: async (): Promise<void> => descartarPendencia(await base()),
    /** Desfaz o último reset. Com `jogadoDepois` e sem `confirmado`, só devolve o plano. */
    desfazer: async (confirmado = false): Promise<Desfeito> => {
      const b = await base();
      return comVez(
        o,
        (vez) =>
          desfazerUltimoReset({
            ...completo(b, vez),
            confirmado,
            restaurar: (nome) => restaurarNaVez(o, nome, vez, true),
          }),
        "desfazer o reset",
      );
    },
  };
}
