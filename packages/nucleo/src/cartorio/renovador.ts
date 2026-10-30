import type { ClienteCartorio } from "./cliente.js";

export interface OpcoesRenovador {
  cliente: Pick<ClienteCartorio, "pegar" | "renovar" | "soltar">;
  /** Chamado uma vez só quando a trava se perde (recusa ou prazo local vencido). Quem para o servidor é o chamador. */
  aoPerder: (motivo: string) => void;
  /** Quanto antes do prazo do cartório este PC já se considera sem trava. Padrão: metade da renovação. */
  margemMs?: number;
  /** Relógio próprio, monotônico (não pula com hibernação nem ajuste de hora). Padrão: `performance.now`. */
  agora?: () => number;
  /** Repete `fn` a cada `ms` e devolve quem cancela. Padrão: `setInterval`. */
  relogio?: { repetir: (fn: () => void, ms: number) => () => void };
}

const RENOVAR_MIN_MS = 50;
const RENOVAR_MAX_MS = 10 * 60_000;

/**
 * Mantém a trava de host deste PC. A época guardada é a que ESTE PC ganhou no `pegar`; uma recusa nunca a troca
 * (senão um processo zumbi do mesmo PC renovaria). O prazo é contado pelo relógio daqui, a partir do ENVIO do
 * pedido, e nunca pelo `expiraEm` do cartório.
 */
export class Renovador {
  private epoca?: number;
  private validoAte = -Infinity;
  private perdida = false;
  private solta = false;
  private emCurso = false;
  private cancelar: () => void = () => {};
  private readonly agora: () => number;

  constructor(private readonly opcoes: OpcoesRenovador) {
    this.agora = opcoes.agora ?? (() => performance.now());
  }

  /** Regra de ouro 1: só `true` com a última renovação aceita e o prazo local valendo. */
  async temTrava(): Promise<boolean> {
    return !this.perdida && !this.solta && this.agora() < this.validoAte;
  }

  /** Pega a trava e começa a renovar. Recusa vira erro com o texto do cartório. */
  async pegar(): Promise<void> {
    if (this.epoca !== undefined) throw new Error("Este PC já pegou a trava com este renovador.");
    const inicio = this.agora();
    const r = await this.opcoes.cliente.pegar();
    if (!r.ok) throw new Error(r.erro);
    this.epoca = r.epoca;
    const { renovarMs } = r;
    if (!Number.isInteger(renovarMs) || renovarMs < RENOVAR_MIN_MS || renovarMs > RENOVAR_MAX_MS) {
      await this.soltar().catch(() => {});
      throw new Error("O cartório mandou um intervalo de renovação inválido; não vou hospedar.");
    }
    // O cartório garante prazo ≥ 3 × renovação (`conferirTempos`): contar 3 × renovação nunca passa do prazo real.
    const prazoMs = 3 * renovarMs - (this.opcoes.margemMs ?? renovarMs / 2);
    this.validoAte = inicio + prazoMs;
    const relogio = this.opcoes.relogio ?? {
      repetir: (fn, ms) => {
        const id = setInterval(fn, ms);
        id.unref();
        return () => clearInterval(id);
      },
    };
    this.cancelar = relogio.repetir(() => void this.renovar(prazoMs), renovarMs);
  }

  private async renovar(prazoMs: number): Promise<void> {
    if (this.perdida || this.solta || this.epoca === undefined) return;
    if (this.agora() >= this.validoAte) {
      return this.perder(
        "O cartório não respondeu a tempo e este PC perdeu a trava de host; parando o servidor.",
      );
    }
    if (this.emCurso) return; // renovação anterior pendurada: não sobrepõe
    this.emCurso = true;
    const inicio = this.agora();
    try {
      const r = await this.opcoes.cliente.renovar(this.epoca);
      if (this.perdida || this.solta) return;
      if (r.ok) this.validoAte = Math.max(this.validoAte, inicio + prazoMs);
      else this.perder(r.erro);
    } catch {
      // Rede ou cartório fora: o prazo local decide no próximo tique.
    } finally {
      this.emCurso = false;
    }
  }

  private perder(motivo: string): void {
    if (this.perdida) return;
    this.perdida = true;
    this.cancelar();
    this.opcoes.aoPerder(motivo);
  }

  /** Para de renovar e devolve a trava (com a época deste PC). Uma vez só. */
  async soltar(): Promise<void> {
    this.cancelar();
    if (this.solta || this.epoca === undefined) return;
    this.solta = true;
    await this.opcoes.cliente.soltar(this.epoca);
  }
}
