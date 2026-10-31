import { validarModsGrupo, type ModGrupo } from "@sabrehosting/nucleo/cartorio/tipos";
import type { LadoMods, ResultadoMods } from "@sabrehosting/nucleo/launcher/mods";

export interface DepsModsGrupo {
  /** `cliente.eu()`: o cartório diz se este PC é o dono; a janela não decide isso. */
  eu(): Promise<{ id: number; dono: boolean }>;
  lerLista(): Promise<ModGrupo[]>;
  /** Troca a lista inteira no cartório (só o dono; o cartório recusa os outros com 403). */
  gravarLista(mods: ModGrupo[]): Promise<void>;
  /** Pasta `mods` do servidor neste PC; `undefined` = este PC não está configurado para hospedar. */
  pastaDoServidor(): string | undefined;
  /** Pasta `mods` da instância do Prism; `undefined` até a instância existir (lancmel-2.2). */
  pastaDaInstancia(): string | undefined;
  /** Servidor rodando (ou sobra dele) neste PC: a pasta dele não é mexida (regra de ouro 2). */
  servidorRodando(): boolean;
  sincronizar(o: { lista: ModGrupo[]; pasta: string; lado: LadoMods }): Promise<ResultadoMods>;
}

export type EstadoMods = {
  dono: boolean;
  mods: ModGrupo[];
  /** Verdadeiro enquanto os mods deste PC estão sendo conferidos/baixados ("Atualizando mods…"). */
  atualizando: boolean;
  /** Resultado da última atualização que precisa de atenção do amigo (falhas e pastas puladas). */
  aviso?: string;
  erro?: string;
};
export type ResultadoEdicao = { ok: true; aviso?: string } | { ok: false; mensagem: string };

const GENERICA = "Não consegui falar com o cartório agora. Nada foi alterado.";
const SO_DONO = "Só o dono do grupo pode mudar os mods.";
const DADOS =
  "Confira os dados do mod: o link precisa começar com https://cdn.modrinth.com/, o arquivo termina em .jar (só o nome, sem pasta) e o hash SHA-512 tem 128 letras e números.";
const SEM_INSTANCIA =
  "A instância do Prism ainda não foi criada neste PC; os mods dela serão baixados quando existir.";
const SERVIDOR_LIGADO =
  "O servidor está ligado: os mods dele só são atualizados com o servidor parado (no próximo arranque do app ou na próxima mudança da lista).";

function mensagemDe(e: unknown): string {
  const status = (e as { status?: unknown } | null)?.status;
  // A recusa do cartório (não é o dono) já vem em pt-BR.
  if (status === 403 && e instanceof Error) return e.message;
  if ((e as { tipo?: unknown } | null)?.tipo === "acesso" && e instanceof Error) return e.message;
  return GENERICA;
}

/** Só os campos conhecidos, e só texto: o que vem da janela é entrada não confiável. */
function modDaJanela(v: unknown): ModGrupo | undefined {
  if (typeof v !== "object" || v === null) return undefined;
  const o = v as Record<string, unknown>;
  const t = (k: string): string => (typeof o[k] === "string" ? o[k].trim() : "");
  return {
    nome: t("nome"),
    versao: t("versao"),
    arquivo: t("arquivo"),
    url: t("url"),
    sha512: t("sha512").toLowerCase(),
    lado: t("lado") as ModGrupo["lado"],
  };
}

export function criarModsGrupo(deps: DepsModsGrupo) {
  let rodando: Promise<void> | undefined;
  let refazer = false;
  let gravando = false;
  let aviso: string | undefined;

  const ehDono = async (): Promise<boolean> => {
    try {
      return (await deps.eu()).dono;
    } catch {
      return false; // sem cartório não dá para saber: na dúvida, ninguém edita
    }
  };

  async function rodada(): Promise<void> {
    const avisos: string[] = [];
    const lista = await deps.lerLista();
    const alvos: Array<[LadoMods, string | undefined]> = [
      ["cliente", deps.pastaDaInstancia()],
      ["servidor", deps.pastaDoServidor()],
    ];
    for (const [lado, pasta] of alvos) {
      if (!pasta) {
        if (lado === "cliente") avisos.push(SEM_INSTANCIA);
        continue; // sem pasta de servidor este PC não hospeda: nada a dizer
      }
      if (lado === "servidor" && deps.servidorRodando()) {
        avisos.push(SERVIDOR_LIGADO);
        continue;
      }
      try {
        const r = await deps.sincronizar({ lista, pasta, lado });
        for (const f of r.falhas) avisos.push(f.motivo);
      } catch {
        avisos.push(
          `Não consegui atualizar os mods ${lado === "cliente" ? "do jogo" : "do servidor"} agora.`,
        );
      }
    }
    aviso = avisos.length > 0 ? avisos.join(" ") : undefined;
  }

  /**
   * Uma rodada por vez. Chamado no arranque ou ao mudar a lista; `depoisDaMudanca` garante uma rodada nova
   * depois da que já estava andando (ela pode ter lido a lista antiga).
   */
  function sincronizar(depoisDaMudanca = false): Promise<void> {
    if (rodando) {
      if (depoisDaMudanca) refazer = true;
      return rodando;
    }
    rodando = (async () => {
      try {
        do {
          refazer = false;
          await rodada().catch(() => {
            aviso = "Não consegui conferir os mods agora. Tento de novo no próximo arranque.";
          });
        } while (refazer);
      } finally {
        rodando = undefined;
      }
    })();
    return rodando;
  }

  async function mudar(
    alterar: (atual: ModGrupo[]) => ModGrupo[] | string,
  ): Promise<ResultadoEdicao> {
    if (gravando) return { ok: false, mensagem: "Já tem uma mudança de mods em andamento." };
    gravando = true;
    try {
      if (!(await ehDono())) return { ok: false, mensagem: SO_DONO };
      // A janela pode estar velha: a mudança vale em cima da lista de agora do cartório.
      const nova = alterar(await deps.lerLista());
      if (typeof nova === "string") return { ok: false, mensagem: nova };
      try {
        validarModsGrupo({ mods: nova });
      } catch {
        return { ok: false, mensagem: DADOS };
      }
      await deps.gravarLista(nova);
    } catch (e) {
      return { ok: false, mensagem: mensagemDe(e) };
    } finally {
      gravando = false;
    }
    await sincronizar(true);
    return aviso ? { ok: true, aviso } : { ok: true };
  }

  return {
    sincronizar,

    async estado(): Promise<EstadoMods> {
      const base = { atualizando: rodando !== undefined, ...(aviso ? { aviso } : {}) };
      const dono = await ehDono();
      try {
        return { ...base, dono, mods: await deps.lerLista() };
      } catch (e) {
        return { ...base, dono, mods: [], erro: mensagemDe(e) };
      }
    },

    adicionar: (mod: unknown): Promise<ResultadoEdicao> =>
      mudar((atual) => {
        const novo = modDaJanela(mod);
        if (!novo) return DADOS;
        if (atual.some((m) => m.arquivo === novo.arquivo))
          return `Já existe um mod com o arquivo ${novo.arquivo} na lista.`;
        return [...atual, novo];
      }),

    tirar: (arquivo: unknown): Promise<ResultadoEdicao> =>
      mudar((atual) => {
        if (typeof arquivo !== "string" || !atual.some((m) => m.arquivo === arquivo))
          return "Esse mod já não está na lista. Atualize a lista.";
        return atual.filter((m) => m.arquivo !== arquivo);
      }),
  };
}

export type ModsGrupo = ReturnType<typeof criarModsGrupo>;
