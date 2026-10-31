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
}

const GENERICA = "Não consegui falar com o cartório agora. Nada foi alterado.";
/** Revogar pode ter chegado ao cartório e a resposta se perdido: não dá para garantir "nada foi alterado". */
const REVOGAR_SEM_RESPOSTA =
  "Não consegui falar com o cartório agora. Atualize a lista para conferir.";
const POR_STATUS: Record<number, string> = {
  403: "Só o dono do grupo pode tirar um PC do grupo.",
  409: "O PC do dono não pode ser tirado do grupo.",
  404: "Esse PC já não está no grupo. Atualize a lista.",
};

function mensagemDe(e: unknown, generica = GENERICA): string {
  const status = (e as { status?: unknown } | null)?.status;
  if (typeof status === "number" && POR_STATUS[status]) return POR_STATUS[status];
  if ((e as { tipo?: unknown } | null)?.tipo === "acesso" && e instanceof Error) return e.message;
  return generica;
}

export function criarGrupo(deps: DepsGrupo) {
  let tirando = false;
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
  };
}

export type Grupo = ReturnType<typeof criarGrupo>;
