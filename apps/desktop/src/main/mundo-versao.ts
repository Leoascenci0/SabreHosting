import { dirname, resolve } from "node:path";
import {
  adiarVersaoDoMundo,
  desfazerUltimoReset,
  publicarVersaoDoMundo,
  retomarVersaoPendente,
  type ClienteVersao,
  type Desfeito,
  type OpcoesVersaoReset,
  type Publicacao,
} from "@sabrehosting/nucleo/mundo/versao-reset";
import {
  SemVez,
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
  return {
    /** Depois do reset: sobe a versão nova (cartório fora = pendente, com aviso). */
    publicar: async (): Promise<Publicacao> => {
      const b = await base();
      try {
        return await comVez(o, (vez) => publicarVersaoDoMundo(completo(b, vez)));
      } catch (erro) {
        // Sem a vez (cartório fora) o reset já feito não se perde: fica o pacote e o aviso para a retomada.
        if (!(erro instanceof SemVez)) throw erro;
        return adiarVersaoDoMundo(b);
      }
    },
    /** Antes de hospedar: termina a publicação pendente de um reset (`nada` se não há). */
    retomar: async (): Promise<{ estado: "nada" } | Publicacao> => {
      const b = await base();
      return comVez(o, (vez) => retomarVersaoPendente(completo(b, vez)));
    },
    /** Desfaz o último reset. Com `jogadoDepois` e sem `confirmado`, só devolve o plano. */
    desfazer: async (confirmado = false): Promise<Desfeito> => {
      const b = await base();
      return comVez(o, (vez) =>
        desfazerUltimoReset({
          ...completo(b, vez),
          confirmado,
          restaurar: (nome) => restaurarNaVez(o, nome, vez),
        }),
      );
    },
  };
}
