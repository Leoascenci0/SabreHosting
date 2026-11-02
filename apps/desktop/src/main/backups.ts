import type { Resultado } from "../ui/ponte.js";

export interface BackupItem {
  nome: string;
  criadoEm: string;
  tamanho: number;
  /** Quem fez: relógio, botão ou cópia de segurança antes de restaurar (ausente = automático). */
  origem?: "automatico" | "manual" | "antes-de-restaurar";
}

export interface DepsBackups {
  listar(): Promise<BackupItem[]>;
  /** `restaurarBackup` do núcleo, com trava e hash; lança erro em pt-BR. */
  restaurar(nome: string): Promise<void>;
  servidorRodando(): boolean;
  /** Servidor deste PC no estado "pronto" e agenda de backup ligada: só então dá para fazer backup agora. */
  servidorPronto(): boolean;
  /** O MESMO `fazerBackup` do núcleo (save-off + save-all flush + save-on); lança se algo falhar. */
  fazerBackup(): Promise<void>;
  /** Último problema da cópia para o histórico longo (texto pronto para a tela). */
  avisoHistorico?(): string | undefined;
}

export interface EstadoBackups {
  itens: (BackupItem & { dePc: string })[];
  /** Servidor rodando: restaurar fica desligado. */
  bloqueado: boolean;
  /** O botão "Fazer backup agora" pode ligar (a recusa de verdade fica no `fazer`). */
  prontoParaBackup: boolean;
  erro?: string;
  /** A cópia para a pasta do histórico longo falhou: a tela mostra, em pt-BR, que o backup deste PC está salvo. */
  avisoHistorico?: string;
}

const GENERICA = "Não consegui restaurar agora. O mundo continua como estava.";
// O manifesto não guarda autor; backup recebido de outro PC (sync) entra depois.
const ESTE_PC = "Este PC";
const GENERICA_BACKUP = "Não consegui fazer o backup agora. O mundo continua como estava.";

export function criarBackups(deps: DepsBackups) {
  let restaurando = false;
  let fazendo = false;
  return {
    /** Restauração em andamento: o Hospedar espera (corrida entre trocar o mundo e subir o servidor). */
    restaurando: (): boolean => restaurando,
    async estado(): Promise<EstadoBackups> {
      const bloqueado = deps.servidorRodando();
      const aviso = deps.avisoHistorico?.();
      const comAviso = aviso === undefined ? {} : { avisoHistorico: aviso };
      try {
        return {
          itens: (await deps.listar()).map((b) => ({ ...b, dePc: ESTE_PC })),
          bloqueado,
          prontoParaBackup: deps.servidorPronto(),
          ...comAviso,
        };
      } catch {
        return {
          itens: [],
          bloqueado,
          prontoParaBackup: deps.servidorPronto(),
          erro: "Não consegui ler a lista de backups. Confira a pasta de backups.",
          ...comAviso,
        };
      }
    },

    /** Botão "Fazer backup agora": recusa aqui (não só na tela). Texto de erro sempre fixo: nada de caminho cru. */
    async fazer(): Promise<Resultado> {
      if (restaurando) {
        return { ok: false, mensagem: "Espere a restauração terminar para fazer um backup." };
      }
      if (fazendo) return { ok: false, mensagem: "Já tem um backup em andamento." };
      if (!deps.servidorPronto()) {
        return {
          ok: false,
          mensagem: "O servidor precisa estar ligado e pronto para fazer um backup.",
        };
      }
      fazendo = true; // antes de qualquer await
      try {
        await deps.fazerBackup();
        return { ok: true };
      } catch {
        return { ok: false, mensagem: GENERICA_BACKUP };
      } finally {
        fazendo = false;
      }
    },

    async restaurar(nome: unknown): Promise<Resultado> {
      if (restaurando) return { ok: false, mensagem: "Já tem uma restauração em andamento." };
      if (fazendo) return { ok: false, mensagem: "Espere o backup terminar para restaurar." };
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
