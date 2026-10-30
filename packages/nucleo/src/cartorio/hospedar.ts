import { salvarSeguro, say } from "../servidor/comandos.js";
import {
  type OpcoesIniciar,
  type ServidorMinecraft,
  iniciarServidor,
} from "../servidor/processo.js";
import { type OpcoesRenovador, Renovador } from "./renovador.js";

export interface OpcoesHospedar extends Omit<OpcoesIniciar, "temTrava"> {
  cliente: OpcoesRenovador["cliente"];
  /** Margem e relógios do renovador (testes). */
  renovador?: Omit<OpcoesRenovador, "cliente" | "aoPerder">;
  /** Avisa a tela que a trava se perdeu; o servidor já está sendo salvo e parado. */
  aoPerder?: (motivo: string) => void;
  /**
   * Ao perder a trava: quanto esperar o `save-all flush`. Padrão: 10 s; com o `stop` (`prazoParadaSemTravaMs`, 10 s)
   * somam 20 s, que cabem na margem do renovador (25 s) antes de o cartório liberar a trava para outro PC.
   */
  prazoSalvarMs?: number;
}

/**
 * Pega a trava → sobe o servidor com `temTrava` do renovador → ao perder a trava, avisa no chat, salva
 * (`salvarSeguro` sem cópia) e para. Servidor parado ou caído devolve a trava.
 */
export async function hospedar(
  opcoes: OpcoesHospedar,
): Promise<{ servidor: ServidorMinecraft; renovador: Renovador }> {
  const { cliente, aoPerder, prazoSalvarMs = 10_000, renovador: tempos, ...iniciar } = opcoes;
  let servidor: ServidorMinecraft | undefined;
  let perdeu = false;
  const encerrar = async (s: ServidorMinecraft) => {
    await say(s, "Este PC perdeu a vez de hospedar; salvando o mundo e parando o servidor.").catch(
      () => {},
    );
    await salvarSeguro(s, async () => {}, prazoSalvarMs).catch(() => {});
    await s.pararSemTrava();
  };
  const renovador = new Renovador({
    ...tempos,
    cliente,
    aoPerder: (motivo) => {
      perdeu = true;
      aoPerder?.(motivo);
      if (servidor) void encerrar(servidor);
    },
  });
  await renovador.pegar();
  try {
    servidor = await iniciarServidor({ ...iniciar, temTrava: () => renovador.temTrava() });
  } catch (e) {
    await renovador.soltar().catch(() => {});
    throw e;
  }
  const s = servidor;
  s.on("estado", ({ estado }: { estado: string }) => {
    if (estado === "parado" || estado === "caiu") void renovador.soltar().catch(() => {});
  });
  if (perdeu) void encerrar(s); // perdeu entre o `pegar` e o spawn
  return { servidor: s, renovador };
}
