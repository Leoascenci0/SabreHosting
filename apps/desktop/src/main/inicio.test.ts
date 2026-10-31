import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { criarInicio, erroSemGrupo, mensagemFalhaSair, type DepsInicio } from "./inicio.js";

const RAPIDO = { passoMs: 1, tentativas: 5 };

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
    endereco: "10.0.0.5:25565",
    copiar: vi.fn(),
    ...extra,
  };
}

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
