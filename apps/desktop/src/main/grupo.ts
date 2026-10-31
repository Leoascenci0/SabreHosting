import type { Resultado } from "../ui/ponte.js";

export interface PcDaTela {
  id: number;
  nome: string;
  dono: boolean;
}

/** O que a tela mostra: `dono: false` esconde a área Grupo inteira. */
export type EstadoGrupo = (
  | { dono: false }
  | { dono: true; pcs: PcDaTela[]; erro?: undefined }
  | { dono: true; pcs: []; erro: string }
) & {
  /** "Endereço do servidor" (só leitura): o que os amigos digitam no Minecraft; vem do cartório. Ausente: não deu. */
  endereco?: string;
};

export interface DepsGrupo {
  /** `cliente.eu()`: o cartório diz se este PC é o dono; a tela não decide isso. */
  eu(): Promise<{ id: number; dono: boolean }>;
  listarPcs(): Promise<PcDaTela[]>;
  revogarPc(id: number): Promise<void>;
  /** `GET /grupo`: endereço do Jogar. Qualquer PC do grupo vê; falha só some com o campo. */
  lerEndereco?(): Promise<string>;
  /** `cliente.criarConvite`: só o dono; o cartório recusa os outros com 403. `expiraEm` em milissegundos. */
  criarConvite?(
    nomePc: string,
    validadeHoras: number,
  ): Promise<{ convite: string; expiraEm: number }>;
}

/** Validades que a tela oferece (horas). O cartório aceita até 72 h; a primeira é o padrão (curto). */
export const VALIDADES_CONVITE_H = [1, 24, 72] as const;

export type ResultadoConvite =
  | { ok: true; convite: string; venceEm: number; nomeNaRede: string }
  | { ok: false; mensagem: string };

const GENERICA = "Não consegui falar com o cartório agora. Nada foi alterado.";
/** Revogar pode ter chegado ao cartório e a resposta se perdido: não dá para garantir "nada foi alterado". */
const REVOGAR_SEM_RESPOSTA =
  "Não consegui falar com o cartório agora. Atualize a lista para conferir.";
const POR_STATUS: Record<number, string> = {
  403: "Só o dono do grupo pode tirar um PC do grupo.",
  409: "O PC do dono não pode ser tirado do grupo.",
  404: "Esse PC já não está no grupo. Atualize a lista.",
};

const CONVITE_POR_STATUS: Record<number, string> = {
  403: "Só o dono do grupo cria convites.",
  409: "Já existe um PC ou um convite pendente com esse nome. Escolha outro.",
  503: "O cartório não conseguiu preparar o convite agora. Tente de novo em instantes; se repetir, avise quem cuida da nuvem.",
};
const CONVITE_GENERICA = "Não consegui falar com o cartório agora. Nenhum convite foi criado.";
const CONVITE_DADOS = "Escolha um nome para o PC (letras ou números) e uma validade da lista.";
const CONVITE_OCUPADO = "Já tem um convite sendo criado.";

/** Nome digitado -> formato da rede do cartório (`^[a-z0-9][a-z0-9-]{0,31}$`): sem acento, minúsculas, hífen. */
export function nomeNaRede(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+/, "")
    .slice(0, 32)
    .replace(/-+$/, "");
}

function mensagemDe(e: unknown, generica = GENERICA): string {
  const status = (e as { status?: unknown } | null)?.status;
  if (typeof status === "number" && POR_STATUS[status]) return POR_STATUS[status];
  if ((e as { tipo?: unknown } | null)?.tipo === "acesso" && e instanceof Error) return e.message;
  return generica;
}

export function criarGrupo(deps: DepsGrupo) {
  let tirando = false;
  let criando = false;
  return {
    async estado(): Promise<EstadoGrupo> {
      const lido = await deps.lerEndereco?.().catch(() => undefined);
      const endereco = lido ? { endereco: lido } : {};
      try {
        if (!(await deps.eu()).dono) return { dono: false, ...endereco };
      } catch {
        // Sem cartório não dá para saber: na dúvida, não mostra a área (o Início já avisa do cartório).
        return { dono: false, ...endereco };
      }
      try {
        return { dono: true, pcs: await deps.listarPcs(), ...endereco };
      } catch (e) {
        return { dono: true, pcs: [], erro: mensagemDe(e), ...endereco };
      }
    },

    /** Revalida no cartório (dono, PC na lista, não é o dono) antes de revogar: o id vem da janela. */
    async tirar(id: unknown): Promise<Resultado> {
      if (tirando) return { ok: false, mensagem: "Já tem um PC sendo tirado." };
      tirando = true;
      try {
        if (!(await deps.eu()).dono) return { ok: false, mensagem: POR_STATUS[403] ?? GENERICA };
        const alvo = (await deps.listarPcs()).find((p) => p.id === id);
        if (!alvo) return { ok: false, mensagem: POR_STATUS[404] ?? GENERICA };
        if (alvo.dono) return { ok: false, mensagem: POR_STATUS[409] ?? GENERICA };
        await deps.revogarPc(alvo.id);
        return { ok: true };
      } catch (e) {
        return { ok: false, mensagem: mensagemDe(e, REVOGAR_SEM_RESPOSTA) };
      } finally {
        tirando = false;
      }
    },

    /**
     * Cria o convite (só o dono). Tudo que vem da janela é entrada não confiável: o main revalida o dono no cartório,
     * a validade só vale se estiver na lista e o nome vira o formato da rede. O texto do convite é credencial: só
     * passa pelo retorno (nunca gravado, nunca em log) e nenhuma mensagem de erro o repete nem mostra erro bruto.
     */
    async criarConvite(entrada: unknown): Promise<ResultadoConvite> {
      const o =
        typeof entrada === "object" && entrada !== null ? (entrada as Record<string, unknown>) : {};
      const nome = typeof o["nome"] === "string" ? nomeNaRede(o["nome"]) : "";
      const horas = VALIDADES_CONVITE_H.find((h) => h === o["horas"]);
      if (!nome || horas === undefined || !deps.criarConvite)
        return { ok: false, mensagem: CONVITE_DADOS };
      if (criando) return { ok: false, mensagem: CONVITE_OCUPADO };
      criando = true;
      try {
        if (!(await deps.eu().catch(() => ({ dono: false }))).dono)
          return { ok: false, mensagem: CONVITE_POR_STATUS[403] ?? CONVITE_GENERICA };
        const criado = await deps.criarConvite(nome, horas);
        if (!criado.convite.startsWith("sabre://convite/") || !Number.isFinite(criado.expiraEm))
          return { ok: false, mensagem: CONVITE_GENERICA };
        return { ok: true, convite: criado.convite, venceEm: criado.expiraEm, nomeNaRede: nome };
      } catch (e) {
        const status = (e as { status?: unknown } | null)?.status;
        return {
          ok: false,
          mensagem: (typeof status === "number" && CONVITE_POR_STATUS[status]) || CONVITE_GENERICA,
        };
      } finally {
        criando = false;
      }
    },
  };
}

export type Grupo = ReturnType<typeof criarGrupo>;
