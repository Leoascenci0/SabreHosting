import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { criarInicio, erroSemGrupo, type DepsInicio } from "./inicio.js";

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
