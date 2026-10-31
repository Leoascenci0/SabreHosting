import { basename } from "node:path";
import type { AnaliseDoZip } from "@sabrehosting/nucleo/importar";

/** Tela Backups › "Importar mundo" (piloto-1.1c). O caminho do .zip nunca vem da janela: só o seletor do main o dá. */
export interface DepsImportacao {
  /** Seletor de arquivo do Windows (só `.zip`); `undefined` se o amigo cancelar. */
  escolherArquivo(): Promise<string | undefined>;
  /** `analisarZip` do núcleo: só lê; zip hostil lança com a mensagem em pt-BR. */
  analisar(zip: string): Promise<AnaliseDoZip>;
  /** O grupo já tem versão? Este PC é o dono? (cartório) */
  situacao(): Promise<{ versaoNoGrupo: number | null; dono: boolean }>;
  /** `importarNoCartorio` do núcleo (trava, N+1, envio). Lança com a mensagem em pt-BR. */
  importar(zip: string, aceitarVersaoNova: boolean): Promise<{ versao: number }>;
  servidorRodando(): boolean;
  restaurando(): boolean;
}

export type EscolhaDoZip =
  | {
      ok: true;
      nome: string;
      arquivos: number;
      versaoMinecraft: string;
      plugins: boolean;
      mods: boolean;
      versaoNoGrupo: number | null;
      dono: boolean;
    }
  | { ok: false; cancelado: true }
  | { ok: false; mensagem: string };

export type ResultadoImportacao = { ok: true; versao: number } | { ok: false; mensagem: string };

const EM_CURSO = "Já tem uma importação em andamento.";
const ESCOLHA_DE_NOVO = "Escolha o arquivo .zip de novo.";
const SEM_CARTORIO =
  "Não consegui falar com o cartório do grupo para conferir a versão do mundo. Tente de novo daqui a pouco.";
const GENERICA = "Não consegui importar agora. Nada foi alterado.";
const ZIP_ILEGIVEL = "Não consegui ler esse arquivo .zip. Nada foi alterado.";

const mensagemDe = (e: unknown, generica: string): string =>
  e instanceof Error && e.message ? e.message : generica;

export function criarImportacao(deps: DepsImportacao) {
  let escolhido: { zip: string; versaoNoGrupo: number | null } | undefined;
  let emCurso = false;
  return {
    importando: (): boolean => emCurso,

    async escolher(): Promise<EscolhaDoZip> {
      if (emCurso) return { ok: false, mensagem: EM_CURSO };
      escolhido = undefined;
      const zip = await deps.escolherArquivo();
      if (zip === undefined) return { ok: false, cancelado: true };
      let analise: AnaliseDoZip;
      try {
        analise = await deps.analisar(zip);
      } catch (e) {
        return { ok: false, mensagem: mensagemDe(e, ZIP_ILEGIVEL) };
      }
      let situacao: Awaited<ReturnType<DepsImportacao["situacao"]>>;
      try {
        situacao = await deps.situacao();
      } catch {
        return { ok: false, mensagem: SEM_CARTORIO };
      }
      escolhido = { zip, versaoNoGrupo: situacao.versaoNoGrupo };
      return {
        ok: true,
        nome: basename(zip),
        arquivos: analise.arquivos,
        versaoMinecraft: analise.versaoMinecraft,
        plugins: analise.indicios.plugins,
        mods: analise.indicios.mods,
        ...situacao,
      };
    },

    /**
     * `confirmado` só vale para a situação mostrada: se o grupo não tinha versão quando o amigo escolheu, a
     * confirmação NÃO autoriza virar N+1 (outro PC importou no meio: o núcleo recusa).
     */
    async executar(confirmado: unknown): Promise<ResultadoImportacao> {
      if (emCurso) return { ok: false, mensagem: EM_CURSO };
      if (deps.servidorRodando()) {
        return { ok: false, mensagem: "Pare o servidor antes de importar um mundo." };
      }
      if (deps.restaurando()) {
        return {
          ok: false,
          mensagem: "Espere a restauração do backup terminar antes de importar.",
        };
      }
      const alvo = escolhido;
      if (!alvo) return { ok: false, mensagem: ESCOLHA_DE_NOVO };
      if (confirmado !== true) return { ok: false, mensagem: "Confirme a importação na tela." };
      emCurso = true;
      try {
        const r = await deps.importar(alvo.zip, alvo.versaoNoGrupo !== null);
        escolhido = undefined;
        return { ok: true, versao: r.versao };
      } catch (e) {
        return { ok: false, mensagem: mensagemDe(e, GENERICA) };
      } finally {
        emCurso = false;
      }
    },
  };
}

export type Importacao = ReturnType<typeof criarImportacao>;
