import type { Resultado } from "../ui/ponte.js";

export interface BackupItem {
  nome: string;
  criadoEm: string;
  tamanho: number;
  versao: number;
}

export interface DepsBackups {
  listar(): Promise<BackupItem[]>;
  /** `restaurarBackup` do núcleo, com trava e hash; lança erro em pt-BR. */
  restaurar(nome: string): Promise<void>;
  servidorRodando(): boolean;
}

export interface EstadoBackups {
  itens: (BackupItem & { dePc: string })[];
  /** Servidor rodando: restaurar fica desligado. */
  bloqueado: boolean;
  erro?: string;
}

const GENERICA = "Não consegui restaurar agora. O mundo continua como estava.";
// O manifesto não guarda autor; backup recebido de outro PC (sync) entra depois.
const ESTE_PC = "Este PC";

export function criarBackups(deps: DepsBackups) {
  let restaurando = false;
  return {
    async estado(): Promise<EstadoBackups> {
      const bloqueado = deps.servidorRodando();
      try {
        return { itens: (await deps.listar()).map((b) => ({ ...b, dePc: ESTE_PC })), bloqueado };
      } catch {
        return {
          itens: [],
          bloqueado,
          erro: "Não consegui ler a lista de backups. Confira a pasta de backups.",
        };
      }
    },

    async restaurar(nome: unknown): Promise<Resultado> {
      if (restaurando) return { ok: false, mensagem: "Já tem uma restauração em andamento." };
      if (deps.servidorRodando()) {
        return { ok: false, mensagem: "Pare o servidor antes de restaurar um backup." };
      }
      restaurando = true;
      try {
        const lista = await deps.listar();
        if (typeof nome !== "string" || !lista.some((b) => b.nome === nome)) {
          return { ok: false, mensagem: "Esse backup não está mais na lista." };
        }
        await deps.restaurar(nome);
        return { ok: true };
      } catch (e) {
        return { ok: false, mensagem: e instanceof Error && e.message ? e.message : GENERICA };
      } finally {
        restaurando = false;
      }
    },
  };
}

export type Backups = ReturnType<typeof criarBackups>;
