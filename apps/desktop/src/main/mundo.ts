import { existsSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { listarBackups } from "@sabrehosting/nucleo/backup/listar";
import {
  ErroDoPlanoDeReset,
  planejarReset,
  type PlanoDeReset,
} from "@sabrehosting/nucleo/mundo/planejar-reset";
import { resetarMundo } from "@sabrehosting/nucleo/mundo/resetar";
import type { Desfeito, Publicacao } from "@sabrehosting/nucleo/mundo/versao-reset";
import { MARCADOR_VERSAO_PENDENTE } from "@sabrehosting/nucleo/servidor/configurar";
import type { Dimensao } from "@sabrehosting/nucleo/mundo/regioes";
import { TEXTO_DEMONSTRACAO } from "./demonstracao.js";
import { comVez, SemVez } from "./deps-backups.js";
import { depsMundoVersao, type OpcoesMundoVersao } from "./mundo-versao.js";

export interface OpcoesMundo extends OpcoesMundoVersao {
  demo: { ativa(): boolean };
  /** `cliente.eu()`: o cartório diz se este PC é o dono; a janela não decide isso. */
  eu(): Promise<{ dono: boolean }>;
  /** Backup (agendado ou manual), restauração ou troca de versão em andamento neste app. */
  ocupado(): boolean;
}

type Recusa = { ok: false; mensagem: string; chunksNaArea?: number };

export type ResultadoPlano = { ok: true; plano: PlanoDeReset } | Recusa;
export type ResultadoReset =
  { ok: true; publicacao: Publicacao; arquivosTrocados: number; chunksApagados: number } | Recusa;
export type ResultadoDesfazer = ({ ok: true } & Desfeito) | Recusa;
export type ResultadoRetomar = { ok: true; estado: "nada" } | ({ ok: true } & Publicacao) | Recusa;
export type EstadoMundo =
  | { dono: false }
  | { dono: true; pendencia: "nenhuma" | "aguardando" | "conflito"; aviso?: string };

const GENERICA = "Não consegui fazer isso agora. O mundo continua como estava.";
const SO_DONO = "Só o dono do grupo pode resetar parte do mundo.";
const NO_AR = "Pare o servidor deste PC antes de resetar parte do mundo.";
const OCUPADO =
  "Há um backup, uma restauração ou uma troca de versão em andamento. Espere terminar para mexer no mundo.";
const EM_CURSO = "Já tem uma operação do mundo em andamento. Espere terminar.";
const PENDENTE =
  "A versão do mundo ainda está pendente de espalhar. Conclua isso (ou descarte o aviso, se for conflito) antes de resetar.";
const VAZIA = "Nenhum chunk existe nessa área; nada foi alterado.";
const SEM_CONFIRMAR = "Para descartar o aviso é preciso confirmar.";
const SEM_PASTA = "Este PC ainda não tem a pasta do mundo e a pasta de backups configuradas.";

/**
 * Texto que pode ir para a tela (S-14): só o que o próprio app escreveu em pt-BR. Erro do sistema (tem `code`),
 * mensagem com cara de caminho ou comprida demais vira o texto genérico; o detalhe fica no log do main.
 */
function textoSeguro(erro: unknown): string {
  if (erro instanceof ErroDoPlanoDeReset || erro instanceof SemVez) return erro.message;
  const e = erro as {
    message?: unknown;
    code?: unknown;
    errno?: unknown;
    syscall?: unknown;
  } | null;
  if (
    erro instanceof Error &&
    typeof e?.message === "string" &&
    e.code === undefined &&
    e.errno === undefined &&
    e.syscall === undefined &&
    e.message.length > 0 &&
    e.message.length <= 400 &&
    !/[\\/]|\b[A-Za-z]:|\bE[A-Z]{3,}\b/.test(e.message)
  )
    return e.message;
  return GENERICA;
}

const recusar = (erro: unknown): Recusa => {
  const chunksNaArea = erro instanceof ErroDoPlanoDeReset ? erro.chunksNaArea : undefined;
  if (!(erro instanceof ErroDoPlanoDeReset)) console.error("[mundo]", erro);
  return {
    ok: false,
    mensagem: textoSeguro(erro),
    ...(chunksNaArea === undefined ? {} : { chunksNaArea }),
  };
};
const DEMO: Recusa = { ok: false, mensagem: TEXTO_DEMONSTRACAO };

/**
 * `mundo:*` do main (chunk-1.5): planejar, resetar, desfazer, descartar o aviso e retomar. TODAS as recusas moram
 * aqui (demonstração, não-dono, servidor no ar, sem vez de hospedar, backup/restauração/troca de versão, outro reset,
 * versão pendente); a tela só mostra a mensagem. O reset roda dentro da troca protegida e da vez de hospedar; a
 * publicação da versão acontece DEPOIS, fora dela (a publicação pega a própria vez: aninhar daria `SemVez`).
 */
export function criarMundo(o: OpcoesMundo) {
  const versao = depsMundoVersao(o);
  let emCurso = false;
  let conflito = false;
  const pastas = async () => {
    const mundo = (await o.mundoAgora?.()) ?? o.pastaDoMundo;
    if (!mundo || !o.pastaBackups) throw new Error(SEM_PASTA);
    return {
      mundo: resolve(mundo),
      servidor: o.pastaDoServidor ?? dirname(resolve(mundo)),
      backups: o.pastaBackups,
    };
  };
  const ehDono = async (): Promise<boolean> => {
    try {
      return (await o.eu()).dono;
    } catch {
      return false; // sem cartório não dá para saber: na dúvida, recusa
    }
  };
  const haAviso = async (): Promise<boolean> =>
    existsSync(join((await pastas()).servidor, MARCADOR_VERSAO_PENDENTE));
  const anotar = (p: { estado: string }): void => void (conflito = p.estado === "conflito");

  /** Recusas comuns, na ordem barata → cara; quem chama já marcou `emCurso`. */
  const exigir = async (comAviso: boolean): Promise<Recusa | undefined> => {
    if (!(await ehDono())) return { ok: false, mensagem: SO_DONO };
    if (o.servidorRodando() || (await o.servidorOrfao?.().catch(() => true)))
      return { ok: false, mensagem: NO_AR };
    if (o.ocupado()) return { ok: false, mensagem: OCUPADO };
    if (comAviso && (await haAviso())) return { ok: false, mensagem: PENDENTE };
    return undefined;
  };
  /** Uma operação por vez; a flag sobe antes de qualquer `await` e desce sempre. */
  const sozinha = async <R>(fazer: () => Promise<R | Recusa>): Promise<R | Recusa> => {
    if (o.demo.ativa()) return DEMO;
    if (emCurso) return { ok: false, mensagem: EM_CURSO };
    emCurso = true;
    try {
      return await fazer();
    } catch (erro) {
      return recusar(erro);
    } finally {
      emCurso = false;
    }
  };

  return {
    /** Reset ou desfazer em curso: Hospedar, backup e restauração esperam. */
    ocupado: (): boolean => emCurso,

    async estado(): Promise<EstadoMundo> {
      if (o.demo.ativa() || !(await ehDono())) return { dono: false };
      try {
        if (!(await haAviso())) return { dono: true, pendencia: "nenhuma" };
        return conflito
          ? { dono: true, pendencia: "conflito" }
          : { dono: true, pendencia: "aguardando" };
      } catch {
        return { dono: true, pendencia: "aguardando" };
      }
    },

    /** Prévia: só lê. */
    async planejar(
      dimensao: unknown,
      area: unknown,
      confirmado?: unknown,
    ): Promise<ResultadoPlano> {
      if (o.demo.ativa()) return DEMO;
      try {
        if (!(await ehDono())) return { ok: false, mensagem: SO_DONO };
        const { mundo } = await pastas();
        return {
          ok: true,
          plano: await planejarReset(mundo, dimensao as Dimensao, area, {
            confirmado: confirmado === true,
          }),
        };
      } catch (erro) {
        return recusar(erro);
      }
    },

    async resetar(dimensao: unknown, area: unknown, confirmado?: unknown): Promise<ResultadoReset> {
      return sozinha(async () => {
        const recusa = await exigir(true);
        if (recusa) return recusa;
        const p = await pastas();
        // Valida a área e vê se há o que apagar ANTES de gravar qualquer aviso.
        const plano = await planejarReset(p.mundo, dimensao as Dimensao, area, {
          confirmado: confirmado === true,
        });
        if (plano.arquivos.length === 0) return { ok: false, mensagem: VAZIA };
        try {
          const { resultado, publicacao } = await versao.protegerTroca(() =>
            comVez(
              o,
              async (vez) =>
                resetarMundo({
                  pastaDoMundo: p.mundo,
                  pastaBackups: p.backups,
                  pastaDoServidor: p.servidor,
                  dimensao: dimensao as Dimensao,
                  area,
                  confirmado: confirmado === true,
                  versao: Math.max(0, ...(await listarBackups(p.backups)).map((b) => b.versao)),
                  epoca: vez.epoca,
                  temTrava: vez.temTrava,
                  servidorParado: () => !o.servidorRodando(),
                  versaoPendenteDoFluxo: true,
                  operacaoEmAndamento: o.ocupado,
                }),
              "resetar o mundo",
            ),
          );
          anotar(publicacao);
          return {
            ok: true,
            publicacao,
            arquivosTrocados: resultado.arquivosTrocados,
            chunksApagados: plano.chunksExistentes,
          };
        } catch (erro) {
          // Sem a vez nada foi tocado: tira o aviso que o fluxo acabou de gravar (não há reset para publicar).
          if (erro instanceof SemVez) await versao.descartar().catch(() => undefined);
          throw erro;
        }
      });
    },

    /** Sem `confirmado` e com coisa jogada depois do reset, só devolve o plano (`feito: false`). */
    async desfazer(confirmado?: unknown): Promise<ResultadoDesfazer> {
      return sozinha(async () => {
        const recusa = await exigir(false);
        if (recusa) return recusa;
        const r = await versao.desfazer(confirmado === true);
        if (r.feito) anotar(r.publicacao);
        return { ok: true, ...r };
      });
    },

    /** Só tira o aviso (nunca mundo nem backup). Exige `confirmado === true`: a tela só repassa o clique do dono. */
    async descartar(confirmado?: unknown): Promise<{ ok: true } | Recusa> {
      return sozinha(async () => {
        const recusa = await exigir(false);
        if (recusa) return recusa;
        if (confirmado !== true) return { ok: false, mensagem: SEM_CONFIRMAR };
        await versao.descartar();
        conflito = false;
        return { ok: true };
      });
    },

    /**
     * Antes de Hospedar: conclui a versão pendente de um reset; `undefined` = pode seguir. Reset em curso ou
     * pendência que não concluiu (cartório fora, conflito) devolve a recusa com texto fixo.
     */
    async antesDeHospedar(): Promise<Recusa | undefined> {
      const r = await this.retomar();
      if (!r.ok) return r;
      if (r.estado === "pendente" || r.estado === "conflito")
        return { ok: false, mensagem: r.aviso };
      return undefined;
    },

    /** Ao abrir o app e antes de Hospedar: termina a publicação de um reset que ficou pendente (qualquer PC). */
    async retomar(): Promise<ResultadoRetomar> {
      if (o.demo.ativa()) return { ok: true, estado: "nada" };
      return sozinha(async () => {
        if (!(await haAviso())) return { ok: true as const, estado: "nada" as const };
        const r = await versao.retomar();
        anotar(r);
        return { ok: true as const, ...r };
      });
    },
  };
}

export type Mundo = ReturnType<typeof criarMundo>;
