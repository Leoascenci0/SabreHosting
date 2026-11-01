import type { EstadoInicio, MotivoSemCartorio, Resultado } from "../ui/ponte.js";

// Só tipos do núcleo aqui: a cola não carrega o núcleo em tempo de execução (os testes rodam sem build).
interface TravaLida {
  dono: { id: number; nome: string } | null;
}

/** Só o que a tela precisa do servidor; `ServidorMinecraft` do núcleo cumpre. */
export interface ServidorAtivo {
  pararServidor(): Promise<void>;
  on(evento: "estado", ouvinte: (e: { estado: string }) => void): unknown;
  /** Estado atual do servidor (o `ServidorMinecraft` do núcleo tem). */
  estado?: string;
}

export interface DepsInicio {
  /** `estadoTrava` do cartório. Erro com `tipo` (ErroCartorio) vira o motivo da tela. */
  lerTrava(): Promise<TravaLida>;
  /** `hospedar` do núcleo: pega a trava, sobe o servidor e devolve a trava ao parar. Nunca outro caminho. */
  hospedar(aoPerder: (motivo: string) => void): Promise<{ servidor: ServidorAtivo }>;
  /** `eu` do cartório: quem é este PC. */
  eu(): Promise<{ id: number }>;
  /** Há servidor vivo na pasta deste PC (sobra de app fechado à força)? `true` também quando não dá para saber. */
  servidorOrfao(): Promise<boolean>;
  /** Endereço para os amigos entrarem. Vazio: ainda não configurado. */
  endereco: string;
  /** Pergunta o endereço de novo ao cartório (`GET /grupo`) antes do Jogar; falha silenciosa mantém o último. */
  atualizarEndereco?(): Promise<void>;
  copiar(texto: string): void;
  /** Abre o jogo já no servidor (Prism, lanc-1.3). Ausente: o botão Jogar só copia o endereço. */
  abrirJogo?(endereco: string): Promise<{ ok: true } | { ok: false; mensagem: string }>;
  /** Há um backup sendo restaurado? Hospedar espera (regra de ouro 2: nunca servidor com o mundo sendo trocado). */
  restaurando?(): boolean;
  /** Troca de versão em andamento (backup antes de gravar): o servidor não pode subir no meio. */
  trocandoVersao?(): boolean;
  /** Percentual do mundo sendo atualizado neste PC (sync-2.2); `undefined` = não está atualizando. */
  atualizando?(): number | undefined;
  /** Último aviso de falha da atualização do mundo (syncmel-1.14); `undefined` = nenhum. */
  avisoAtualizacao?(): string | undefined;
  /** Quando foi o último backup deste PC (ISO); `undefined` = nenhum ou sem pasta. Só leitura. */
  ultimoBackup?(): Promise<string | undefined>;
  /** Número da versão do mundo no grupo (cartório); `undefined` = grupo sem mundo ou sem conexão. */
  versaoMundo?(): Promise<number | undefined>;
  /** Nomes de quem está jogando neste servidor; `undefined` = ainda não dá para saber (subindo). */
  jogadores?(servidor: ServidorAtivo): Promise<string[] | undefined>;
  /** Servidor deste PC criado (ainda pode estar subindo): quem agenda o backup passa a ouvir o estado dele. */
  aoServidor?(servidor: ServidorAtivo): void;
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

export const RESTAURANDO =
  "Um backup está sendo restaurado. Espere terminar para hospedar o servidor.";
export const TROCANDO_VERSAO =
  "A versão do Minecraft está sendo trocada (com um backup antes). Espere terminar para hospedar o servidor.";
export const ATUALIZANDO =
  "O seu mundo está sendo atualizado para a versão mais nova. Espere terminar para hospedar o servidor.";
const ORFAO_VIVO =
  "O servidor anterior ainda está rodando neste PC. Espere ele encerrar ou feche o Java no Gerenciador de Tarefas e tente de novo.";
const GENERICA = "Não consegui fazer isso agora. Tente de novo em instantes.";

/** Tempos de espera da liberação da trava e do servidor órfão; só os testes mexem. */
export interface TemposInicio {
  passoMs?: number;
  tentativas?: number;
  /** De quanto em quanto tempo reconferir o órfão. Padrão: 1 s. */
  orfaoPassoMs?: number;
  /** Quanto esperar o órfão encerrar (o vigia salva e para em ≤ ~20 s). Padrão: 30 s. */
  orfaoPrazoMs?: number;
  /** Com a trava livre, quanto esperar o órfão antes de dizer o que fazer. Padrão: 2 min. */
  orfaoTetoMs?: number;
  /** Quanto guardar a versão do mundo antes de perguntar ao cartório de novo. Padrão: 60 s. */
  versaoTtlMs?: number;
}

export function criarInicio(deps: DepsInicio, tempos: TemposInicio = {}) {
  const { passoMs = 300, tentativas = 20 } = tempos;
  const { orfaoPassoMs = 1000, orfaoPrazoMs = 30_000, orfaoTetoMs = 120_000 } = tempos;
  const { versaoTtlMs = 60_000 } = tempos;
  // A versão do mundo vai ao cartório; o estado é pedido a cada evento da tela, então a resposta (ou a falha) vale por um tempo.
  let versaoGuardada: { valor: number | undefined; ate: number } | undefined;
  const lerVersaoMundo = async (): Promise<number | undefined> => {
    if (!deps.versaoMundo) return undefined;
    if (versaoGuardada && performance.now() < versaoGuardada.ate) return versaoGuardada.valor;
    const valor = await deps.versaoMundo().catch(() => undefined);
    versaoGuardada = { valor, ate: performance.now() + versaoTtlMs };
    return valor;
  };
  let ativo: ServidorAtivo | undefined;
  let ocupado = false;
  let parando = false;
  let meuId: number | undefined;
  const ouvintes = new Set<() => void>();
  const avisar = (): void => ouvintes.forEach((cb) => cb());

  /** Depois da parada, espera o cartório mostrar a trava livre (a devolução roda em segundo plano no núcleo). */
  async function esperarTravaLivre(): Promise<void> {
    for (let n = 0; n < tentativas; n++) {
      try {
        if ((await deps.lerTrava()).dono === null) return;
      } catch {
        return; // sem cartório não há como conferir; a trava vence sozinha no prazo
      }
      await new Promise((ok) => setTimeout(ok, passoMs));
    }
  }

  async function souEu(donoId: number): Promise<boolean> {
    try {
      meuId ??= (await deps.eu()).id;
      return donoId === meuId;
    } catch {
      return false;
    }
  }

  /** Servidor órfão vivo na pasta (app fechado à força)? Erro conta como vivo: na dúvida, não oferece Hospedar. */
  const temOrfao = () => deps.servidorOrfao().catch(() => true);
  /** Desde quando (relógio monotônico) há órfão vivo; `undefined` = nenhum. */
  let orfaoDesde: number | undefined;
  let semDono = false;
  let reconferindo = false;
  /** Ainda esperando o órfão encerrar? Com a trava livre, espera mais (até o teto): Hospedar ali duplicaria o mundo. */
  const esperandoOrfao = () =>
    performance.now() - (orfaoDesde ?? performance.now()) < (semDono ? orfaoTetoMs : orfaoPrazoMs);

  /** Reconfere o órfão até ele sair ou o prazo vencer, e então avisa a tela. Um laço por vez. */
  function reconferirOrfao(): void {
    if (reconferindo) return;
    reconferindo = true;
    void (async () => {
      try {
        while (esperandoOrfao() && !ativo && !ocupado) {
          await new Promise((ok) => setTimeout(ok, orfaoPassoMs));
          if (!(await temOrfao())) return void (orfaoDesde = undefined);
        }
      } finally {
        reconferindo = false;
        avisar();
      }
    })();
  }

  let paradaEmCurso: Promise<Resultado> | undefined;

  /** Uma parada por vez: novo pedido (Parar, Sair) enquanto outra roda, mesmo após estourar prazo, reaproveita a promessa. */
  function parar(): Promise<Resultado> {
    if (paradaEmCurso) return paradaEmCurso;
    const servidor = ativo;
    if (!servidor)
      return Promise.resolve({ ok: false, mensagem: "O servidor deste PC não está rodando." });
    parando = true;
    avisar();
    paradaEmCurso = (async (): Promise<Resultado> => {
      try {
        await servidor.pararServidor();
        await esperarTravaLivre();
        if (ativo === servidor) ativo = undefined;
        return { ok: true };
      } catch (e) {
        return { ok: false, mensagem: e instanceof Error && e.message ? e.message : GENERICA };
      } finally {
        parando = false;
        paradaEmCurso = undefined;
        avisar(); // a tela volta ao estado real (ainda hospedando, se a parada falhou)
      }
    })();
    return paradaEmCurso;
  }

  async function estadoBase(): Promise<EstadoInicio> {
    if (ativo) return { tipo: "eu", endereco: deps.endereco, ...(parando ? { parando } : {}) };
    try {
      const { dono } = await deps.lerTrava();
      const outro = dono
        ? { tipo: "outro" as const, nomePc: dono.nome, endereco: deps.endereco }
        : undefined;
      if (ocupado) return outro ?? { tipo: "ninguem" };
      if (dono && outro && !(await souEu(dono.id))) return outro;
      // Trava livre, ou ainda em nome deste PC (app reaberto: o cartório aceita o `pegar` de novo). Hospedar só
      // sem servidor desta sessão e sem órfão na pasta (regra de ouro 1).
      if (!(await temOrfao())) {
        orfaoDesde = undefined;
        return outro && (ocupado || ativo) ? outro : { tipo: "ninguem" };
      }
      semDono = !dono;
      orfaoDesde ??= performance.now();
      // Órfão de app sem vigia (versão antiga) que não sai no prazo: volta ao "servidor neste PC" (trava minha)
      // ou diz o que fazer (trava livre); nunca oferece Hospedar.
      if (!esperandoOrfao()) return outro ?? { tipo: "orfao" };
      reconferirOrfao();
      return { tipo: "eu", endereco: deps.endereco, parando: true };
    } catch (e) {
      return { tipo: "sem-cartorio", motivo: motivoDe(e) };
    }
  }

  /** Dados só de leitura do painel; cada um que falha ou não existe some (a tela não inventa). */
  async function comPainel(e: EstadoInicio): Promise<EstadoInicio> {
    if (e.tipo !== "ninguem" && e.tipo !== "outro" && e.tipo !== "eu") return e;
    const servidor = ativo;
    const [ultimoBackup, versaoMundo, jogadores] = await Promise.all([
      deps.ultimoBackup?.().catch(() => undefined),
      lerVersaoMundo(),
      e.tipo === "eu" && !e.parando && servidor
        ? deps.jogadores?.(servidor).catch(() => undefined)
        : undefined,
    ]);
    const trabalho = deps.restaurando?.()
      ? ("restaurando" as const)
      : deps.trocandoVersao?.()
        ? ("trocando-versao" as const)
        : undefined;
    return {
      ...e,
      ...(trabalho && e.tipo !== "eu" ? { trabalho } : {}),
      ...(ultimoBackup ? { ultimoBackup } : {}),
      ...(versaoMundo !== undefined ? { versaoMundo } : {}),
      ...(jogadores ? { jogadores } : {}),
    };
  }

  return {
    parar,

    /** Servidor de uma sessão anterior ainda vivo na pasta? Erro conta como vivo. */
    temOrfao,

    /** Este PC está com o servidor no ar (ou subindo)? Quem fecha o app precisa saber. */
    ativo: (): boolean => ativo !== undefined || ocupado,

    /**
     * Antes de sair do app: com servidor no ar, confirma, para (salva, para e devolve a trava) e só então libera a
     * saída. `false` = não sair (recusou, ou a parada falhou/estourou o prazo).
     */
    async encerrar(
      confirmar: () => Promise<boolean>,
      prazoMs = 90_000,
    ): Promise<{ sair: true } | { sair: false; falha?: string }> {
      if (!ativo && !ocupado) return { sair: true };
      if (!(await confirmar())) return { sair: false };
      let timer: NodeJS.Timeout | undefined;
      const estouro = new Promise<Resultado>((ok) => {
        timer = setTimeout(
          () => ok({ ok: false, mensagem: "a parada passou do tempo limite" }),
          prazoMs,
        );
      });
      const r = await Promise.race([parar(), estouro]);
      clearTimeout(timer);
      return r.ok ? { sair: true } : { sair: false, falha: r.mensagem };
    },

    async estado(): Promise<EstadoInicio> {
      const base = await estadoBase();
      const e = await comPainel(base);
      if (e.tipo !== "ninguem" && e.tipo !== "outro") return e;
      const pct = deps.atualizando?.();
      const aviso = deps.avisoAtualizacao?.();
      return {
        ...e,
        ...(pct !== undefined ? { atualizando: pct } : {}),
        ...(aviso !== undefined && pct === undefined ? { aviso } : {}),
      };
    },

    /** O app avisa a tela quando o percentual da atualização muda (o estado não tem relógio próprio). */
    mudou: avisar,

    async jogar(): Promise<{
      copiado: boolean;
      endereco: string;
      aberto?: boolean;
      aviso?: string;
    }> {
      await deps.atualizarEndereco?.().catch(() => undefined);
      if (!deps.endereco) throw new Error("O endereço do servidor ainda não foi configurado.");
      deps.copiar(deps.endereco); // sempre copia: serve de reserva se o Prism não abrir
      if (!deps.abrirJogo) return { copiado: true, endereco: deps.endereco };
      const r = await deps.abrirJogo(deps.endereco).catch(() => ({
        ok: false as const,
        mensagem: GENERICA,
      }));
      return r.ok
        ? { copiado: true, endereco: deps.endereco, aberto: true }
        : { copiado: true, endereco: deps.endereco, aberto: false, aviso: r.mensagem };
    },

    async hospedar(): Promise<Resultado> {
      if (deps.restaurando?.()) return { ok: false, mensagem: RESTAURANDO };
      if (deps.trocandoVersao?.()) return { ok: false, mensagem: TROCANDO_VERSAO };
      if (deps.atualizando?.() !== undefined) return { ok: false, mensagem: ATUALIZANDO };
      if (ativo || ocupado)
        return { ok: false, mensagem: "O servidor já está subindo ou rodando." };
      ocupado = true; // antes do primeiro `await`: dois cliques não passam juntos
      try {
        // Servidor de uma sessão anterior vivo na pasta: subir outro duplicaria o mundo (regra de ouro 1).
        if (await temOrfao()) return { ok: false, mensagem: ORFAO_VIVO };
        const { servidor } = await deps.hospedar(() => avisar());
        ativo = servidor;
        deps.aoServidor?.(servidor);
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

    aoMudar(cb: () => void): () => void {
      ouvintes.add(cb);
      return () => void ouvintes.delete(cb);
    },
  };
}

export function mensagemFalhaSair(motivo: string): string {
  return `Não consegui parar o servidor: ${motivo}. Os amigos podem continuar conectados. Tente Sair de novo.`;
}

export type Inicio = ReturnType<typeof criarInicio>;
