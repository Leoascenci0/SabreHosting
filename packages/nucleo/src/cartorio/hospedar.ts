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
  /**
   * Aviso e gravação são melhor esforço e passam pela fila de comandos (pode haver backup na frente); a parada
   * NÃO: sai no máximo `prazoSalvarMs` depois da perda, salvou ou não.
   */
  const encerrar = async (s: ServidorMinecraft) => {
    const salvar = (async () => {
      await say(
        s,
        "Este PC perdeu a vez de hospedar; salvando o mundo e parando o servidor.",
      ).catch(() => {});
      await salvarSeguro(s, async () => {}, prazoSalvarMs).catch(() => {});
    })();
    let prazo: NodeJS.Timeout | undefined;
    await Promise.race([salvar, new Promise((ok) => (prazo = setTimeout(ok, prazoSalvarMs)))]);
    clearTimeout(prazo);
    await s.pararSemTrava();
  };
  const renovador = new Renovador({
    ...tempos,
    cliente,
    aoPerder: (motivo) => {
      perdeu = true;
      if (servidor) void encerrar(servidor); // parar vem antes de avisar a tela: o aviso pode falhar
      try {
        aoPerder?.(motivo);
      } catch (e) {
        servidor?.emit("log", {
          nivel: "aviso",
          texto: `Não consegui avisar a tela da perda da trava: ${e instanceof Error ? e.message : String(e)}`,
        });
      }
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
