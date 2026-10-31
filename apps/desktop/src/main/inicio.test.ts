import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { criarInicio, erroSemGrupo, mensagemFalhaSair, type DepsInicio } from "./inicio.js";

const RAPIDO = { passoMs: 1, tentativas: 5 };
const ORFAO = { orfaoPassoMs: 5, orfaoPrazoMs: 30, orfaoTetoMs: 150 };
const encerrando = { tipo: "eu", endereco: "10.0.0.5:25565", parando: true };

function servidorFalso() {
  const e = new EventEmitter();
  const pararServidor = vi.fn(async () => {
    e.emit("estado", { estado: "parado" });
  });
  return Object.assign(e, { pararServidor });
}

function deps(extra: Partial<DepsInicio> = {}): DepsInicio {
  return {
    lerTrava: async () => ({ dono: null }),
    hospedar: async () => ({ servidor: servidorFalso() }),
    eu: async () => ({ id: 1 }),
    servidorOrfao: async () => false,
    endereco: "10.0.0.5:25565",
    copiar: vi.fn(),
    ...extra,
  };
}

describe("hospedar durante a troca de versão do Minecraft", () => {
  it("é recusado enquanto o backup antes da troca roda, e volta a valer depois", async () => {
    let trocando = true;
    const hospedar = vi.fn(async () => ({ servidor: servidorFalso() }));
    const inicio = criarInicio(deps({ hospedar, trocandoVersao: () => trocando }));
    const r = await inicio.hospedar();
    expect(r).toMatchObject({ ok: false });
    expect(r.ok ? "" : r.mensagem).toMatch(/versão do Minecraft está sendo trocada/);
    expect(hospedar).not.toHaveBeenCalled();
    trocando = false;
    expect(await inicio.hospedar()).toEqual({ ok: true });
  });
});

describe("hospedar durante uma restauração de backup", () => {
  it("é recusado enquanto o mundo está sendo trocado, e volta a valer depois", async () => {
    let restaurando = true;
    const hospedar = vi.fn(async () => ({ servidor: servidorFalso() }));
    const inicio = criarInicio(deps({ hospedar, restaurando: () => restaurando }));
    const r = await inicio.hospedar();
    expect(r).toMatchObject({ ok: false });
    expect(r.ok ? "" : r.mensagem).toMatch(/backup está sendo restaurado/);
    expect(hospedar).not.toHaveBeenCalled();
    restaurando = false;
    expect(await inicio.hospedar()).toEqual({ ok: true });
  });
});

describe("aviso da atualização do mundo (syncmel-1.14)", () => {
  it("mostra o aviso no estado enquanto existir e some quando o app o limpa", async () => {
    let aviso: string | undefined = "Não consegui atualizar o mundo: sem resposta da nuvem.";
    const inicio = criarInicio(deps({ avisoAtualizacao: () => aviso }));
    expect(await inicio.estado()).toEqual({
      tipo: "ninguem",
      aviso: "Não consegui atualizar o mundo: sem resposta da nuvem.",
    });
    aviso = undefined;
    expect(await inicio.estado()).toEqual({ tipo: "ninguem" });
  });
});

describe("hospedar durante a atualização do mundo (sync-2.2)", () => {
  it("Hospedar é recusado com o percentual no estado; Jogar segue liberado; volta ao acabar", async () => {
    let pct: number | undefined = 40;
    const hospedar = vi.fn(async () => ({ servidor: servidorFalso() }));
    const inicio = criarInicio(deps({ hospedar, atualizando: () => pct }));
    expect(await inicio.estado()).toEqual({ tipo: "ninguem", atualizando: 40 });
    const r = await inicio.hospedar();
    expect(r.ok ? "" : r.mensagem).toMatch(/mundo está sendo atualizado/);
    expect(hospedar).not.toHaveBeenCalled();
    await expect(inicio.jogar()).resolves.toMatchObject({ copiado: true });
    pct = undefined;
    expect(await inicio.estado()).toEqual({ tipo: "ninguem" });
    expect(await inicio.hospedar()).toEqual({ ok: true });
  });
});

describe("estado da tela inicial", () => {
  it("ninguém hospedando", async () => {
    expect(await criarInicio(deps()).estado()).toEqual({ tipo: "ninguem" });
  });

  it("outro PC hospeda: nome e endereço", async () => {
    const d = deps({ lerTrava: async () => ({ dono: { id: 2, nome: "Lucas" } }) });
    expect(await criarInicio(d).estado()).toEqual({
      tipo: "outro",
      nomePc: "Lucas",
      endereco: "10.0.0.5:25565",
    });
  });

  it.each([
    ["rede", "rede"],
    ["servidor", "servidor"],
    ["acesso", "acesso"],
    ["resposta", "servidor"],
  ])("erro do cartório %s vira motivo %s", async (tipo, motivo) => {
    const d = deps({
      lerTrava: async () => {
        throw Object.assign(new Error("x"), { tipo });
      },
    });
    expect(await criarInicio(d).estado()).toEqual({ tipo: "sem-cartorio", motivo });
  });

  it("sem grupo configurado: acesso", async () => {
    const d = deps({
      lerTrava: async () => {
        throw erroSemGrupo();
      },
    });
    expect(await criarInicio(d).estado()).toEqual({ tipo: "sem-cartorio", motivo: "acesso" });
  });

  describe("trava livre com servidor órfão vivo na pasta", () => {
    it("segue esperando depois do prazo curto e oferece Hospedar quando o órfão sai", async () => {
      let vivo = true;
      const inicio = criarInicio(deps({ servidorOrfao: async () => vivo }), ORFAO);
      expect(await inicio.estado()).toEqual(encerrando);
      await new Promise((ok) => setTimeout(ok, 60));
      expect(await inicio.estado()).toEqual(encerrando);
      const mudou = new Promise<void>((ok) => inicio.aoMudar(ok));
      vivo = false;
      await mudou; // segue reconferindo até o órfão sair
      expect(await inicio.estado()).toEqual({ tipo: "ninguem" });
    });

    it("órfão que não sai até o teto: diz o que fazer, ainda sem Hospedar; Tentar de novo reconfere", async () => {
      let vivo = true;
      const inicio = criarInicio(deps({ servidorOrfao: async () => vivo }), ORFAO);
      const mudou = new Promise<void>((ok) => inicio.aoMudar(ok));
      expect(await inicio.estado()).toEqual(encerrando);
      await mudou;
      expect(await inicio.estado()).toEqual({ tipo: "orfao" });
      expect(await inicio.estado()).toEqual({ tipo: "orfao" }); // não volta a "encerrando"
      vivo = false;
      expect(await inicio.estado()).toEqual({ tipo: "ninguem" });
    });
  });

  describe("dono da trava sou eu (app reaberto)", () => {
    const minha = async () => ({ dono: { id: 1, nome: "Este PC" } });
    const outro = { tipo: "outro", nomePc: "Este PC", endereco: "10.0.0.5:25565" };

    it("dono sou eu sem servidor vira ninguém (Hospedar de novo)", async () => {
      expect(await criarInicio(deps({ lerTrava: minha })).estado()).toEqual({ tipo: "ninguem" });
    });

    it("dono sou eu com órfão vivo não oferece Hospedar: mostra o servidor anterior encerrando", async () => {
      const d = deps({ lerTrava: minha, servidorOrfao: async () => true });
      expect(await criarInicio(d, ORFAO).estado()).toEqual(encerrando);
    });

    it("falha ao conferir órfão ou quem sou eu: não oferece Hospedar", async () => {
      const falha = async () => {
        throw Object.assign(new Error("x"), { tipo: "rede" });
      };
      expect(
        await criarInicio(deps({ lerTrava: minha, servidorOrfao: falha }), ORFAO).estado(),
      ).toEqual(encerrando);
      expect(await criarInicio(deps({ lerTrava: minha, eu: falha })).estado()).toEqual(outro);
    });

    it("órfão que encerra (o vigia salvou e parou): avisa a tela e oferece Hospedar", async () => {
      let vivo = true;
      const inicio = criarInicio(deps({ lerTrava: minha, servidorOrfao: async () => vivo }), ORFAO);
      const mudou = new Promise<void>((ok) => inicio.aoMudar(ok));
      expect(await inicio.estado()).toEqual(encerrando);
      vivo = false;
      await mudou;
      expect(await inicio.estado()).toEqual({ tipo: "ninguem" });
    });

    it("órfão que não encerra no prazo (sem vigia): volta ao estado de hoje, sem Hospedar", async () => {
      const inicio = criarInicio(deps({ lerTrava: minha, servidorOrfao: async () => true }), ORFAO);
      const mudou = new Promise<void>((ok) => inicio.aoMudar(ok));
      expect(await inicio.estado()).toEqual(encerrando);
      await mudou;
      expect(await inicio.estado()).toEqual(outro);
    });

    it("pergunta quem sou eu ao cartório uma vez só", async () => {
      const eu = vi.fn(async () => ({ id: 1 }));
      const inicio = criarInicio(deps({ lerTrava: minha, eu }));
      await inicio.estado();
      await inicio.estado();
      expect(eu).toHaveBeenCalledTimes(1);
    });

    it("com o Hospedar desta sessão em curso não vira ninguém", async () => {
      let liberar: () => void = () => {};
      const d = deps({
        lerTrava: minha,
        hospedar: () => new Promise((ok) => (liberar = () => ok({ servidor: servidorFalso() }))),
      });
      const inicio = criarInicio(d);
      const subindo = inicio.hospedar();
      expect(await inicio.estado()).toEqual(outro);
      liberar();
      await subindo;
      expect((await inicio.estado()).tipo).toBe("eu");
    });
  });
});

describe("hospedar e parar", () => {
  it("hospedar vira 'eu'; parar volta e devolve ao cartório", async () => {
    const s = servidorFalso();
    const i = criarInicio(deps({ hospedar: async () => ({ servidor: s }) }));
    expect(await i.hospedar()).toEqual({ ok: true });
    expect(await i.estado()).toEqual({ tipo: "eu", endereco: "10.0.0.5:25565" });
    expect(await i.parar()).toEqual({ ok: true });
    expect(s.pararServidor).toHaveBeenCalledOnce();
    expect(await i.estado()).toEqual({ tipo: "ninguem" });
  });

  it("recusa do núcleo (sem trava) vira mensagem, sem estado 'eu'", async () => {
    const i = criarInicio(
      deps({
        hospedar: async () => {
          throw new Error(
            "Este PC não tem a trava de host do cartório; o servidor não pode subir.",
          );
        },
      }),
    );
    expect(await i.hospedar()).toEqual({
      ok: false,
      mensagem: "Este PC não tem a trava de host do cartório; o servidor não pode subir.",
    });
    expect(await i.estado()).toEqual({ tipo: "ninguem" });
  });

  it("segundo clique durante a subida não chama o núcleo de novo", async () => {
    let liberar!: () => void;
    const hospedar = vi.fn(
      () =>
        new Promise<{ servidor: ReturnType<typeof servidorFalso> }>((ok) => {
          liberar = () => ok({ servidor: servidorFalso() });
        }),
    );
    const i = criarInicio(deps({ hospedar }));
    const primeiro = i.hospedar();
    expect((await i.hospedar()).ok).toBe(false);
    liberar();
    expect(await primeiro).toEqual({ ok: true });
    expect(hospedar).toHaveBeenCalledOnce();
  });

  it("servidor que cai sozinho ou trava perdida avisa a tela", async () => {
    const s = servidorFalso();
    const i = criarInicio(deps({ hospedar: async () => ({ servidor: s }) }));
    const aviso = vi.fn();
    i.aoMudar(aviso);
    await i.hospedar();
    s.emit("estado", { estado: "caiu" });
    expect(aviso).toHaveBeenCalledOnce();
    expect(await i.estado()).toEqual({ tipo: "ninguem" });
  });

  it("parar sem servidor rodando recusa", async () => {
    expect((await criarInicio(deps()).parar()).ok).toBe(false);
  });
});

describe("jogar", () => {
  it("copia o endereço", async () => {
    const d = deps();
    expect(await criarInicio(d).jogar()).toEqual({ copiado: true, endereco: "10.0.0.5:25565" });
    expect(d.copiar).toHaveBeenCalledWith("10.0.0.5:25565");
  });

  it("com abrirJogo, abre o jogo no endereço e ainda copia", async () => {
    const abrirJogo = vi.fn(async () => ({ ok: true as const }));
    const d = deps({ abrirJogo });
    expect(await criarInicio(d).jogar()).toEqual({
      copiado: true,
      endereco: "10.0.0.5:25565",
      aberto: true,
    });
    expect(abrirJogo).toHaveBeenCalledWith("10.0.0.5:25565");
  });

  it("se o jogo não abre, devolve a mensagem e mantém o endereço copiado", async () => {
    const d = deps({ abrirJogo: async () => ({ ok: false, mensagem: "Prism ausente." }) });
    expect(await criarInicio(d).jogar()).toMatchObject({
      copiado: true,
      aberto: false,
      aviso: "Prism ausente.",
    });
  });

  it("sem endereço configurado, recusa sem copiar nada", async () => {
    const d = deps({ endereco: "" });
    await expect(criarInicio(d).jogar()).rejects.toThrow("endereço");
    expect(d.copiar).not.toHaveBeenCalled();
  });
});

describe("encerrar (Sair do app)", () => {
  it("sem servidor no ar sai sem perguntar", async () => {
    const confirmar = vi.fn(async () => true);
    expect(await criarInicio(deps()).encerrar(confirmar)).toEqual({ sair: true });
    expect(confirmar).not.toHaveBeenCalled();
  });

  it("com servidor: confirma, para, espera a trava ficar livre e só então libera a saída", async () => {
    const ordem: string[] = [];
    const s = servidorFalso();
    s.pararServidor.mockImplementation(async () => {
      ordem.push("parou");
      s.emit("estado", { estado: "parado" });
    });
    let donoNoCartorio: { id: number; nome: string } | null = { id: 1, nome: "Este PC" };
    const i = criarInicio(
      deps({
        hospedar: async () => ({ servidor: s }),
        lerTrava: async () => {
          ordem.push("leu");
          const atual = donoNoCartorio;
          donoNoCartorio = null; // o cartório solta na 2ª leitura
          return { dono: atual };
        },
      }),
      RAPIDO,
    );
    await i.hospedar();
    expect(await i.encerrar(async () => true)).toEqual({ sair: true });
    expect(ordem).toEqual(["parou", "leu", "leu"]);
  });

  it("se o usuário recusar, o servidor continua no ar e o app não sai", async () => {
    const s = servidorFalso();
    const i = criarInicio(deps({ hospedar: async () => ({ servidor: s }) }), RAPIDO);
    await i.hospedar();
    expect(await i.encerrar(async () => false)).toEqual({ sair: false });
    expect(s.pararServidor).not.toHaveBeenCalled();
    expect(i.ativo()).toBe(true);
  });

  it("parada que falha ou estoura o prazo não libera a saída", async () => {
    const falha = servidorFalso();
    falha.pararServidor.mockRejectedValue(new Error("travou"));
    const i = criarInicio(deps({ hospedar: async () => ({ servidor: falha }) }), RAPIDO);
    await i.hospedar();
    expect(await i.encerrar(async () => true)).toEqual({ sair: false, falha: "travou" });

    const lento = servidorFalso();
    lento.pararServidor.mockImplementation(() => new Promise(() => {}));
    const j = criarInicio(deps({ hospedar: async () => ({ servidor: lento }) }), RAPIDO);
    await j.hospedar();
    expect(await j.encerrar(async () => true, 20)).toEqual({
      sair: false,
      falha: "a parada passou do tempo limite",
    });
  });

  it("durante a parada o estado mostra 'parando'", async () => {
    const s = servidorFalso();
    let liberar!: () => void;
    s.pararServidor.mockImplementation(() => new Promise<void>((ok) => (liberar = ok)));
    const i = criarInicio(deps({ hospedar: async () => ({ servidor: s }) }), RAPIDO);
    await i.hospedar();
    const parada = i.parar();
    expect(await i.estado()).toEqual({ tipo: "eu", endereco: "10.0.0.5:25565", parando: true });
    liberar();
    await parada;
  });

  it("falha na parada: a tela volta ao estado real (ainda hospedando) e a mensagem sai em pt-BR", async () => {
    const s = servidorFalso();
    s.pararServidor.mockRejectedValue(new Error("o Java não respondeu"));
    const i = criarInicio(deps({ hospedar: async () => ({ servidor: s }) }), RAPIDO);
    const aviso = vi.fn();
    i.aoMudar(aviso);
    await i.hospedar();
    const r = await i.encerrar(async () => true);
    expect(r).toEqual({ sair: false, falha: "o Java não respondeu" });
    expect(mensagemFalhaSair("o Java não respondeu")).toBe(
      "Não consegui parar o servidor: o Java não respondeu. Os amigos podem continuar conectados. Tente Sair de novo.",
    );
    expect(await i.estado()).toEqual({ tipo: "eu", endereco: "10.0.0.5:25565" }); // sem "parando"
    expect(aviso).toHaveBeenCalled();
  });

  it("guarda: Sair durante uma parada em andamento (inclusive após estourar o prazo) não para em paralelo", async () => {
    const s = servidorFalso();
    let liberar!: () => void;
    s.pararServidor.mockImplementation(() => new Promise<void>((ok) => (liberar = ok)));
    const i = criarInicio(deps({ hospedar: async () => ({ servidor: s }) }), RAPIDO);
    await i.hospedar();
    const primeira = i.encerrar(async () => true, 10); // estoura o prazo com a parada ainda rodando
    expect(await primeira).toMatchObject({ sair: false });
    const segunda = i.encerrar(async () => true, 10_000);
    const terceira = i.parar();
    liberar();
    expect(await segunda).toEqual({ sair: true });
    expect(await terceira).toEqual({ ok: true });
    expect(s.pararServidor).toHaveBeenCalledOnce();
  });
});
