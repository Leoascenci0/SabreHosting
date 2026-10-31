import { copyFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { gravarSalvo, lerSalvo, pastaPermitida } from "./boas-vindas.js";

/**
 * Pasta do SabreHosting (appmel-1.13): ver e trocar a pasta-base que o assistente gravou. Trocar só muda ONDE o app
 * lê servidor, mundo e backups: nunca move, copia nem apaga o mundo ou os backups da pasta antiga (regras de ouro 3 e 4);
 * quem quiser levar o mundo faz isso de propósito, fora daqui.
 */
export interface DepsPastaBase {
  dados: string;
  /** Servidor rodando (ou sobra dele) neste PC. */
  servidorRodando(): boolean | Promise<boolean>;
}

export type ResultadoPasta = { ok: true; anterior: string } | { ok: false; mensagem: string };

const RODANDO = "Pare o servidor antes de trocar a pasta do SabreHosting.";
const SEM_PASTA = "A pasta ainda não foi escolhida: conclua o assistente de primeira vez.";
const INVALIDA =
  "Escolha uma pasta completa (por exemplo, C:\\Jogos\\SabreHosting), não a raiz do disco.";
const IGUAL = "Essa já é a pasta do SabreHosting.";
const FALHA = "Não consegui preparar a pasta. Escolha outra.";

export function criarPastaBase(deps: DepsPastaBase) {
  const atual = (): string | undefined => {
    const s = lerSalvo(deps.dados);
    // O arquivo do disco é entrada não confiável (S-07): pasta torta vale como ausente.
    return s.concluido && pastaPermitida(s.pastaBase) ? s.pastaBase : undefined;
  };
  let trocada = false;
  return {
    /** Verdadeiro depois de uma troca que deu certo: o app vai reiniciar e não deve aceitar Jogar/Hospedar até lá. */
    trocada: (): boolean => trocada,

    estado(): { pasta?: string } {
      const pasta = atual();
      return pasta ? { pasta } : {};
    },

    async trocar(pasta: unknown): Promise<ResultadoPasta> {
      const anterior = atual();
      if (!anterior) return { ok: false, mensagem: SEM_PASTA };
      if (await deps.servidorRodando()) return { ok: false, mensagem: RODANDO };
      // A pasta vem da janela: validada aqui no main (nunca confiar na tela).
      if (!pastaPermitida(pasta)) return { ok: false, mensagem: INVALIDA };
      if (pasta === anterior) return { ok: false, mensagem: IGUAL };
      try {
        await mkdir(join(pasta, "servidor"), { recursive: true });
        await mkdir(join(pasta, "mundos"), { recursive: true });
        // O aceite do contrato da Mojang já foi dado; o arquivo (pequeno) acompanha, o mundo não.
        await copyFile(
          join(anterior, "servidor", "eula.txt"),
          join(pasta, "servidor", "eula.txt"),
        ).catch(() => undefined);
        // Relê logo antes de gravar: nada é perdido se o arquivo mudou no meio.
        gravarSalvo(deps.dados, { ...lerSalvo(deps.dados), concluido: true, pastaBase: pasta });
        trocada = true;
        return { ok: true, anterior };
      } catch {
        return { ok: false, mensagem: FALHA };
      }
    },
  };
}

export type PastaBase = ReturnType<typeof criarPastaBase>;
