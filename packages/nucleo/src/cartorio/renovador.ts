type Resposta = { ok: true; epoca: number; renovarMs: number } | { ok: false; erro: string };

/**
 * O mínimo que o renovador usa de uma trava com prazo: a de host (`pegar`/`renovar`/`soltar` do cliente) ou a de
 * atualização (`pegarAtualizacao`/… , syncmel-1.8b). Mesmo contrato no cartório: época, prazo, renovação.
 */
export interface ClienteDeTrava {
  pegar(): Promise<Resposta>;
  renovar(epoca: number, sinal?: AbortSignal): Promise<Resposta>;
  soltar(epoca: number): Promise<unknown>;
}

export interface OpcoesRenovador {
  cliente: ClienteDeTrava;
  /** Chamado uma vez só quando a trava se perde (recusa ou prazo local vencido). Quem para o servidor é o chamador. */
  aoPerder: (motivo: string) => void;
  /**
   * Quanto antes do prazo do cartório este PC já se considera sem trava: é o tempo que sobra para avisar, salvar e
   * parar o servidor antes de outro PC poder pegar a trava. Padrão: 1,25 × a renovação (25 s com renovação de 20 s).
   */
  margemMs?: number;
  /** Relógio monotônico (não volta com ajuste de hora). Padrão: `performance.now`. */
  agora?: () => number;
  /** Relógio de parede (anda durante a hibernação, quando o monotônico pode parar). Padrão: `Date.now`. */
  agoraParede?: () => number;
  /** `repetir` a cada `ms` e `depois` de `ms`; cada um devolve quem cancela. Padrão: `setInterval`/`setTimeout`. */
  relogio?: {
    repetir: (fn: () => void, ms: number) => () => void;
    depois: (fn: () => void, ms: number) => () => void;
  };
}

const RENOVAR_MIN_MS = 50;
const RENOVAR_MAX_MS = 10 * 60_000;
const PERDEU_PRAZO =
  "O cartório não respondeu a tempo e este PC perdeu a trava de host; parando o servidor.";
const OUTRA_EPOCA =
  "O cartório confirmou a trava com outra época; por segurança este PC deixa de hospedar.";

const RELOGIO_PADRAO: NonNullable<OpcoesRenovador["relogio"]> = {
  repetir: (fn, ms) => {
    const id = setInterval(fn, ms);
    id.unref();
    return () => clearInterval(id);
  },
  depois: (fn, ms) => {
    const id = setTimeout(fn, ms);
    id.unref();
    return () => clearTimeout(id);
  },
};

/** Instante do ENVIO de um pedido aceito, nos dois relógios. */
interface Marca {
  mono: number;
  parede: number;
}

/**
 * Mantém a trava de host deste PC. A época guardada é a que ESTE PC ganhou no `pegar`; uma recusa nunca a troca
 * (senão um processo zumbi do mesmo PC renovaria). O prazo é contado aqui, a partir do ENVIO do último pedido
 * aceito, e nunca pelo `expiraEm` do cartório.
 *
 * A conta, com os tempos padrão do cartório (prazo 60 s, renovação 20 s): prazo local = 3 × 20 − 25 = 35 s depois
 * do envio. O cartório só libera a trava 60 s depois de RECEBER esse pedido, então sobram ≥ 25 s para avisar, salvar
 * (≤ 10 s) e parar (≤ 10 s) em `hospedar`, com 5 s de folga para atraso de rede e diferença de relógio.
 */
export class Renovador {
  private epoca?: number;
  private marca?: Marca;
  private prazoMs = 0;
  private perdida = false;
  private solta = false;
  private emCurso = false;
  /** Abortado ao soltar ou perder: a renovação em curso cai e o cliente não tenta de novo. */
  private readonly parar = new AbortController();
  private cancelarTique: () => void = () => {};
  private cancelarAlarme: () => void = () => {};
  private readonly agora: () => number;
  private readonly agoraParede: () => number;
  private readonly relogio: NonNullable<OpcoesRenovador["relogio"]>;

  constructor(private readonly opcoes: OpcoesRenovador) {
    this.agora = opcoes.agora ?? (() => performance.now());
    this.agoraParede = opcoes.agoraParede ?? Date.now;
    this.relogio = opcoes.relogio ?? RELOGIO_PADRAO;
  }

  private marcar(): Marca {
    return { mono: this.agora(), parede: this.agoraParede() };
  }

  /** O MAIOR tempo entre os dois relógios: hibernação (monotônico parado) ou hora atrasada nunca estendem a trava. */
  private decorrido(): number {
    if (!this.marca) return Infinity;
    return Math.max(this.agora() - this.marca.mono, this.agoraParede() - this.marca.parede);
  }

  private venceu(): boolean {
    return this.decorrido() >= this.prazoMs;
  }

  /** Regra de ouro 1: só `true` com o último pedido aceito e o prazo local valendo. */
  async temTrava(): Promise<boolean> {
    return !this.perdida && !this.solta && !this.venceu();
  }

  /**
   * Renova na hora (antes de um passo que não pode ser dado sem a trava, como um `rename` da troca) e diz se ela
   * ainda vale. Renovação já em curso não é repetida: vale o prazo local. Perdida ou solta: `false`, sem pedido.
   */
  async renovarAgora(): Promise<boolean> {
    await this.renovar();
    return this.temTrava();
  }

  /** Pega a trava e começa a renovar. Recusa vira erro com o texto do cartório. */
  async pegar(): Promise<void> {
    if (this.epoca !== undefined) throw new Error("Este PC já pegou a trava com este renovador.");
    const envio = this.marcar();
    const r = await this.opcoes.cliente.pegar();
    if (!r.ok) throw new Error(r.erro);
    this.epoca = r.epoca;
    const { renovarMs } = r;
    // O cartório garante prazo ≥ 3 × renovação (`conferirTempos`): contar 3 × renovação nunca passa do prazo real.
    const prazoMs = 3 * renovarMs - (this.opcoes.margemMs ?? 1.25 * renovarMs);
    const valido = Number.isInteger(renovarMs) && renovarMs >= RENOVAR_MIN_MS;
    if (!valido || renovarMs > RENOVAR_MAX_MS || !(prazoMs > renovarMs)) {
      await this.soltar().catch(() => {});
      throw new Error("O cartório mandou um intervalo de renovação inválido; não vou hospedar.");
    }
    this.prazoMs = prazoMs;
    this.marca = envio;
    this.armarAlarme();
    this.cancelarTique = this.relogio.repetir(() => void this.renovar(), renovarMs);
  }

  /** Alarme no próprio fim do prazo: a perda não espera o próximo tique. Rearma se o prazo foi estendido. */
  private armarAlarme(): void {
    this.cancelarAlarme();
    this.cancelarAlarme = this.relogio.depois(
      () => {
        if (this.perdida || this.solta) return;
        if (this.venceu()) this.perder(PERDEU_PRAZO);
        else this.armarAlarme();
      },
      Math.max(0, this.prazoMs - this.decorrido()),
    );
  }

  private async renovar(): Promise<void> {
    if (this.perdida || this.solta || this.epoca === undefined) return;
    if (this.venceu()) return this.perder(PERDEU_PRAZO);
    if (this.emCurso) return; // renovação anterior pendurada: não sobrepõe
    this.emCurso = true;
    const envio = this.marcar();
    try {
      const r = await this.opcoes.cliente.renovar(this.epoca, this.parar.signal);
      if (this.perdida || this.solta) return;
      if (!r.ok) return this.perder(r.erro);
      // Só a época que ESTE PC ganhou vale; outra (cartório torto ou trocado) é perda, nunca adoção.
      if (r.epoca !== this.epoca) return this.perder(OUTRA_EPOCA);
      // Conta do ENVIO, e só avança (uma resposta velha nunca encurta nem estende além do que vale).
      if (!this.marca || envio.mono > this.marca.mono) this.marca = envio;
      this.armarAlarme();
    } catch {
      // Rede ou cartório fora: o alarme do prazo decide.
    } finally {
      this.emCurso = false;
    }
  }

  private perder(motivo: string): void {
    if (this.perdida) return;
    this.perdida = true;
    this.parar.abort();
    this.cancelarTique();
    this.cancelarAlarme();
    this.opcoes.aoPerder(motivo);
  }

  /** Para de renovar e devolve a trava (com a época deste PC). Uma vez só. */
  async soltar(): Promise<void> {
    this.parar.abort();
    this.cancelarTique();
    this.cancelarAlarme();
    if (this.solta || this.epoca === undefined) return;
    this.solta = true;
    await this.opcoes.cliente.soltar(this.epoca);
  }
}
