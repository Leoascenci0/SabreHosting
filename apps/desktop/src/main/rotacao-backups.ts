import { basename } from "node:path";
import { marcarBackup, rotacionarPasta } from "@sabrehosting/nucleo/backup/rotacao-pasta";
import type { ResultadoDaRotacao } from "@sabrehosting/nucleo/backup/rotacao";

export interface DepsRotacao {
  /** Pasta de backups (`undefined`: ainda não configurada, nada a fazer). */
  pastaBackups(): string | undefined;
  /** Configurações › Backups › Quantos guardar (lido a cada rotação). */
  quantosGuardar(): number;
  /** Restauração em curso: a pasta está sendo usada, a rotação espera a próxima vez. */
  ocupado?(): boolean;
  agora?(): Date;
  aoAvisar?(texto: string): void;
  /** Troca a conferência (testes). */
  rotacionar?: typeof rotacionarPasta;
}

/**
 * Liga a rotação do núcleo ao app: roda depois de cada backup bom e no arranque. Uma por vez (S-06: se já há uma
 * rodando, esta pula; o próximo backup roda de novo). Erro vira aviso e nunca apaga sem conferir (o núcleo lança antes).
 */
export function criarRotacaoBackups(deps: DepsRotacao) {
  let emCurso = false;
  const rotacionar = deps.rotacionar ?? rotacionarPasta;

  async function rodar(): Promise<ResultadoDaRotacao | undefined> {
    const pasta = deps.pastaBackups();
    if (!pasta || emCurso || deps.ocupado?.()) return undefined;
    emCurso = true; // antes de qualquer await
    try {
      return await rotacionar(pasta, {
        recentes: deps.quantosGuardar(),
        agora: (deps.agora ?? (() => new Date()))(),
      });
    } catch (e) {
      deps.aoAvisar?.(`Não apaguei backups antigos: ${e instanceof Error ? e.message : String(e)}`);
      return undefined;
    } finally {
      emCurso = false;
    }
  }

  return {
    rodar,
    /** Backup acabou de ser criado (o pacote já foi conferido por hash): marca "bom" e roda a rotação. */
    async aoBackupBom(feito: { caminho: string; sha256: string }): Promise<void> {
      const pasta = deps.pastaBackups();
      if (!pasta) return;
      try {
        marcarBackup(pasta, basename(feito.caminho), "bom", feito.sha256);
      } catch (e) {
        // Sem marca o backup fica "não-conferido": a rotação nunca o apaga. Só avisa.
        deps.aoAvisar?.(
          `Não consegui marcar o backup como bom: ${e instanceof Error ? e.message : String(e)}`,
        );
        return;
      }
      await rodar();
    },
  };
}

export type RotacaoBackups = ReturnType<typeof criarRotacaoBackups>;
