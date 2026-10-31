import type { Resultado } from "../ui/ponte.js";

export interface OpcoesBrutas {
  neoforge: boolean;
  fabricForge: boolean;
  consultou: boolean;
}

export interface DepsVersao {
  /** `cliente.eu()`: o cartório diz se este PC é o dono; a janela não decide isso. */
  eu(): Promise<{ id: number; dono: boolean }>;
  /** Versão que o grupo usa hoje (GET /grupo/config). */
  lerAtual(): Promise<string>;
  /** Releases da Mojang, da mais nova à mais antiga. */
  listar(): Promise<string[]>;
  opcoes(versao: string): Promise<OpcoesBrutas>;
  /** sha1 do jar oficial da versão (plano da Mojang); o cartório o guarda junto. */
  sha1Do(versao: string): Promise<string>;
  gravar(versao: string, sha1: string): Promise<void>;
  /** Servidor rodando (ou sobra dele) neste PC. */
  servidorRodando(): boolean;
}

export type EstadoVersao =
  | { dono: false }
  | { dono: true; atual: string; versoes: string[]; erro?: undefined }
  | { dono: true; atual: ""; versoes: []; erro: string };

export type OpcoesDaTela =
  | { ok: true; neoforge: boolean; fabricForge: boolean; texto: string }
  | { ok: false; mensagem: string };

const GENERICA = "Não consegui falar com o cartório agora. A versão não foi alterada.";
const SO_DONO = "Só o dono do grupo pode trocar a versão do Minecraft.";
const RODANDO = "Pare o servidor antes de trocar a versão do Minecraft.";
/** O NeoForge da 1.20.1 ainda não tem o hash do instalador conferido pelo grupo (3.1d): só sem mods. */
const SEM_HASH_MODS = new Set(["1.20.1"]);

function textoDasOpcoes(o: OpcoesBrutas): string {
  if (!o.consultou)
    return "Não consegui consultar os mods desta versão agora. Por enquanto só serve sem mods.";
  if (o.fabricForge) return "Roda mods de Fabric e Forge juntos, ou sem mods.";
  if (o.neoforge)
    return "Roda mods de NeoForge, ou sem mods. Não roda mods de Fabric nem de Forge.";
  return "Só roda sem mods.";
}

function mensagemDe(e: unknown): string {
  const status = (e as { status?: unknown } | null)?.status;
  // A recusa do cartório (servidor no ar, alguém atualizando, não é o dono) já vem em pt-BR.
  if ((status === 409 || status === 403) && e instanceof Error) return e.message;
  if ((e as { tipo?: unknown } | null)?.tipo === "acesso" && e instanceof Error) return e.message;
  return GENERICA;
}

export function criarVersao(deps: DepsVersao) {
  let gravando = false;
  const ehDono = async (): Promise<boolean> => {
    try {
      return (await deps.eu()).dono;
    } catch {
      return false; // sem cartório não dá para saber: na dúvida, não mostra a área
    }
  };
  /** O id vem da janela: só vale o que está na lista oficial. */
  const naLista = async (versao: unknown): Promise<string | undefined> =>
    typeof versao === "string" && (await deps.listar()).includes(versao) ? versao : undefined;

  return {
    async estado(): Promise<EstadoVersao> {
      if (!(await ehDono())) return { dono: false };
      try {
        const [atual, versoes] = await Promise.all([deps.lerAtual(), deps.listar()]);
        return { dono: true, atual, versoes };
      } catch (e) {
        return { dono: true, atual: "", versoes: [], erro: mensagemDe(e) };
      }
    },

    /** Só ao selecionar uma versão (cada consulta é uma ida à internet). */
    async opcoes(versao: unknown): Promise<OpcoesDaTela> {
      if (!(await ehDono())) return { ok: false, mensagem: SO_DONO };
      try {
        const v = await naLista(versao);
        if (!v) return { ok: false, mensagem: "Essa versão não está na lista oficial." };
        const o = await deps.opcoes(v);
        const liberada = SEM_HASH_MODS.has(v) ? { ...o, neoforge: false, fabricForge: false } : o;
        const texto = SEM_HASH_MODS.has(v)
          ? "Por enquanto só roda sem mods (o suporte a mods desta versão ainda não foi liberado)."
          : textoDasOpcoes(o);
        return { ok: true, neoforge: liberada.neoforge, fabricForge: liberada.fabricForge, texto };
      } catch {
        return { ok: false, mensagem: "Não consegui consultar esta versão agora." };
      }
    },

    async gravar(versao: unknown): Promise<Resultado> {
      if (gravando) return { ok: false, mensagem: "Já tem uma troca de versão em andamento." };
      gravando = true;
      try {
        if (!(await ehDono())) return { ok: false, mensagem: SO_DONO };
        if (deps.servidorRodando()) return { ok: false, mensagem: RODANDO };
        const v = await naLista(versao);
        if (!v) return { ok: false, mensagem: "Essa versão não está na lista oficial." };
        await deps.gravar(v, await deps.sha1Do(v));
        return { ok: true };
      } catch (e) {
        return { ok: false, mensagem: mensagemDe(e) };
      } finally {
        gravando = false;
      }
    },
  };
}

export type Versao = ReturnType<typeof criarVersao>;
