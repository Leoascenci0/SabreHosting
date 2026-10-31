import type { EstadoInicio, MotivoSemCartorio, Resultado } from "../ui/ponte.js";

// Só tipos do núcleo aqui: a cola não carrega o núcleo em tempo de execução (os testes rodam sem build).
interface TravaLida {
  dono: { id: number; nome: string } | null;
}

/** Só o que a tela precisa do servidor; `ServidorMinecraft` do núcleo cumpre. */
export interface ServidorAtivo {
  pararServidor(): Promise<void>;
  on(evento: "estado", ouvinte: (e: { estado: string }) => void): unknown;
}

export interface DepsInicio {
  /** `estadoTrava` do cartório. Erro com `tipo` (ErroCartorio) vira o motivo da tela. */
  lerTrava(): Promise<TravaLida>;
  /** `hospedar` do núcleo: pega a trava, sobe o servidor e devolve a trava ao parar. Nunca outro caminho. */
  hospedar(aoPerder: (motivo: string) => void): Promise<{ servidor: ServidorAtivo }>;
  /** Endereço para os amigos entrarem. Vazio: ainda não configurado. */
  endereco: string;
  copiar(texto: string): void;
}

export const SEM_GRUPO = "Este PC ainda não entrou no grupo.";

/** Erro de acesso sem cartório configurado (mesma forma do `ErroCartorio`). */
export function erroSemGrupo(): Error {
  return Object.assign(new Error(SEM_GRUPO), { tipo: "acesso" });
}

function motivoDe(e: unknown): MotivoSemCartorio {
  const tipo = (e as { tipo?: unknown } | null)?.tipo;
  return tipo === "rede" || tipo === "acesso" ? tipo : "servidor";
}

const GENERICA = "Não consegui fazer isso agora. Tente de novo em instantes.";

export function criarInicio(deps: DepsInicio) {
  let ativo: ServidorAtivo | undefined;
  let ocupado = false;
  const ouvintes = new Set<() => void>();
  const avisar = (): void => ouvintes.forEach((cb) => cb());

  return {
    async estado(): Promise<EstadoInicio> {
      if (ativo) return { tipo: "eu", endereco: deps.endereco };
      try {
        const { dono } = await deps.lerTrava();
        if (!dono) return { tipo: "ninguem" };
        return { tipo: "outro", nomePc: dono.nome, endereco: deps.endereco };
      } catch (e) {
        return { tipo: "sem-cartorio", motivo: motivoDe(e) };
      }
    },

    async jogar(): Promise<{ copiado: boolean; endereco: string }> {
      if (!deps.endereco) throw new Error("O endereço do servidor ainda não foi configurado.");
      deps.copiar(deps.endereco);
      return { copiado: true, endereco: deps.endereco };
    },

    async hospedar(): Promise<Resultado> {
      if (ativo || ocupado)
        return { ok: false, mensagem: "O servidor já está subindo ou rodando." };
      ocupado = true;
      try {
        const { servidor } = await deps.hospedar(() => avisar());
        ativo = servidor;
        servidor.on("estado", ({ estado }) => {
          if (estado === "parado" || estado === "caiu") {
            if (ativo === servidor) ativo = undefined;
            avisar();
          }
        });
        return { ok: true };
      } catch (e) {
        return { ok: false, mensagem: e instanceof Error && e.message ? e.message : GENERICA };
      } finally {
        ocupado = false;
      }
    },

    async parar(): Promise<Resultado> {
      const servidor = ativo;
      if (!servidor) return { ok: false, mensagem: "O servidor deste PC não está rodando." };
      try {
        await servidor.pararServidor();
        if (ativo === servidor) ativo = undefined;
        return { ok: true };
      } catch (e) {
        return { ok: false, mensagem: e instanceof Error && e.message ? e.message : GENERICA };
      }
    },

    aoMudar(cb: () => void): () => void {
      ouvintes.add(cb);
      return () => void ouvintes.delete(cb);
    },
  };
}

export type Inicio = ReturnType<typeof criarInicio>;
