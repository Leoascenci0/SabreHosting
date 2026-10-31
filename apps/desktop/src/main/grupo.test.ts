import { describe, expect, it, vi } from "vitest";
import { criarGrupo, type DepsGrupo } from "./grupo.js";

const PCS = [
  { id: 1, nome: "PC do Eliel", dono: true },
  { id: 2, nome: "PC do Lucas", dono: false },
];

function montar(dono: boolean, extra: Partial<DepsGrupo> = {}) {
  const revogados: number[] = [];
  const grupo = criarGrupo({
    eu: async () => ({ id: dono ? 1 : 2, dono }),
    listarPcs: async () => PCS,
    revogarPc: async (id) => void revogados.push(id),
    ...extra,
  });
  return { grupo, revogados };
}

describe("grupo (main)", () => {
  it("não-dono: nada de lista e nenhuma chamada de revogar", async () => {
    let listou = false;
    const { grupo, revogados } = montar(false, {
      listarPcs: async () => ((listou = true), PCS),
    });
    expect(await grupo.estado()).toEqual({ dono: false });
    expect(listou).toBe(false);
    expect((await grupo.tirar(2)).ok).toBe(false);
    expect(revogados).toEqual([]);
  });

  it("dono: lista os PCs e revoga um PC comum", async () => {
    const { grupo, revogados } = montar(true);
    expect(await grupo.estado()).toEqual({ dono: true, pcs: PCS });
    expect(await grupo.tirar(2)).toEqual({ ok: true });
    expect(revogados).toEqual([2]);
  });

  it("o PC do dono, id desconhecido e id de fora da janela não chegam ao cartório", async () => {
    const { grupo, revogados } = montar(true);
    expect(await grupo.tirar(1)).toMatchObject({
      ok: false,
      mensagem: expect.stringMatching(/dono/),
    });
    expect(await grupo.tirar(99)).toMatchObject({
      ok: false,
      mensagem: expect.stringMatching(/já não está/),
    });
    expect((await grupo.tirar("2")).ok).toBe(false);
    expect(revogados).toEqual([]);
  });

  it.each([
    [403, /Só o dono/],
    [409, /dono não pode/],
    [404, /já não está/],
  ])("recusa %i do cartório vira mensagem em pt-BR", async (status, texto) => {
    const { grupo } = montar(true, {
      revogarPc: async () => {
        throw Object.assign(new Error("O cartório recusou o pedido"), { status });
      },
    });
    const r = await grupo.tirar(2);
    expect(r).toMatchObject({ ok: false });
    expect(r.ok ? "" : r.mensagem).toMatch(texto);
  });

  it("falha de rede ao revogar não promete que nada foi alterado: manda atualizar a lista", async () => {
    const { grupo } = montar(true, {
      revogarPc: async () => Promise.reject(new Error("rede caiu")),
    });
    const r = await grupo.tirar(2);
    expect(r).toEqual({
      ok: false,
      mensagem: "Não consegui falar com o cartório agora. Atualize a lista para conferir.",
    });
  });

  it("falha de rede na lista mostra o erro dentro da área; sem cartório esconde a área", async () => {
    const a = montar(true, { listarPcs: async () => Promise.reject(new Error("x")) });
    expect(await a.grupo.estado()).toMatchObject({ dono: true, pcs: [], erro: expect.any(String) });
    const b = montar(true, { eu: async () => Promise.reject(new Error("x")) });
    expect(await b.grupo.estado()).toEqual({ dono: false });
  });

  describe("Endereço do servidor (só leitura)", () => {
    it("dono e não-dono recebem o endereço que o cartório deu", async () => {
      const lerEndereco = async () => "jogar.exemplo.org:25565";
      expect(await montar(false, { lerEndereco }).grupo.estado()).toEqual({
        dono: false,
        endereco: "jogar.exemplo.org:25565",
      });
      expect(await montar(true, { lerEndereco }).grupo.estado()).toMatchObject({
        dono: true,
        endereco: "jogar.exemplo.org:25565",
      });
    });

    it("cartório não respondeu o /grupo: sem o campo, sem derrubar a lista nem vazar o erro", async () => {
      const r = await montar(true, {
        lerEndereco: async () => Promise.reject(new Error("http://10.66.0.1:7710 caiu")),
      }).grupo.estado();
      expect(r).toMatchObject({ dono: true, pcs: PCS });
      expect(r.endereco).toBeUndefined();
      expect(JSON.stringify(r)).not.toContain("10.66");
    });
  });
});

describe("grupo (main): criar convite", () => {
  const TEXTO = "sabre://convite/1.eyJ0ZXN0ZSI6MX0";
  function comConvite(dono: boolean, extra: Partial<DepsGrupo> = {}) {
    const pedidos: Array<{ nomePc: string; horas: number }> = [];
    const { grupo } = montar(dono, {
      criarConvite: async (nomePc, horas) => {
        pedidos.push({ nomePc, horas });
        return { convite: TEXTO, expiraEm: 1_900_000_000_000 };
      },
      ...extra,
    });
    return { grupo, pedidos };
  }

  it("dono: cria com o nome no formato da rede e devolve o texto e o prazo", async () => {
    const { grupo, pedidos } = comConvite(true);
    const r = await grupo.criarConvite({ nome: "  PC do João 2 ", horas: 24 });
    expect(r).toEqual({
      ok: true,
      convite: TEXTO,
      venceEm: 1_900_000_000_000,
      nomeNaRede: "pc-do-joao-2",
    });
    expect(pedidos).toEqual([{ nomePc: "pc-do-joao-2", horas: 24 }]);
  });

  it("não-dono: recusa e nem chega ao cartório", async () => {
    const { grupo, pedidos } = comConvite(false);
    const r = await grupo.criarConvite({ nome: "ana", horas: 1 });
    expect(r).toEqual({ ok: false, mensagem: "Só o dono do grupo cria convites." });
    expect(pedidos).toEqual([]);
  });

  it("sem saber se é dono (cartório fora): recusa", async () => {
    const { grupo, pedidos } = comConvite(true, {
      eu: async () => {
        throw new Error("rede");
      },
    });
    expect((await grupo.criarConvite({ nome: "ana", horas: 1 })).ok).toBe(false);
    expect(pedidos).toEqual([]);
  });

  it("validade fora da lista fechada e nome sem letra ou número não chegam ao cartório", async () => {
    const { grupo, pedidos } = comConvite(true);
    for (const horas of [0, 2, 168, "24", undefined, Number.NaN]) {
      expect((await grupo.criarConvite({ nome: "ana", horas })).ok).toBe(false);
    }
    for (const nome of ["", "   ", "---", 7, undefined, { x: 1 }]) {
      expect((await grupo.criarConvite({ nome, horas: 1 })).ok).toBe(false);
    }
    expect((await grupo.criarConvite(null)).ok).toBe(false);
    expect(pedidos).toEqual([]);
  });

  it("nome gigante é cortado em 32 e não começa nem termina em hífen", async () => {
    const { grupo, pedidos } = comConvite(true);
    await grupo.criarConvite({ nome: `-${"a".repeat(40)}`, horas: 1 });
    expect(pedidos[0]?.nomePc).toBe("a".repeat(32));
  });

  it("erros viram texto fixo em pt-BR, sem caminho, IP ou token", async () => {
    const bruto = new Error("ECONNREFUSED 10.66.0.1:7710 token=SEGREDO /home/x/y");
    const casos: Array<[unknown, string]> = [
      [
        Object.assign(new Error("recusou 403"), { status: 403 }),
        "Só o dono do grupo cria convites.",
      ],
      [
        Object.assign(new Error("recusou 409"), { status: 409 }),
        "Já existe um PC ou um convite pendente com esse nome. Escolha outro.",
      ],
      [
        Object.assign(new Error("recusou 503"), { status: 503 }),
        "O cartório não conseguiu preparar o convite agora. Tente de novo em instantes; se repetir, avise quem cuida da nuvem.",
      ],
      [bruto, "Não consegui falar com o cartório agora. Nenhum convite foi criado."],
    ];
    for (const [erro, esperado] of casos) {
      const { grupo } = comConvite(true, {
        criarConvite: async () => {
          throw erro;
        },
      });
      const r = await grupo.criarConvite({ nome: "ana", horas: 1 });
      expect(r).toEqual({ ok: false, mensagem: esperado });
    }
  });

  it("resposta torta do cartório (sem o formato sabre://) vira erro fixo, sem repetir o texto", async () => {
    const { grupo } = comConvite(true, {
      criarConvite: async () => ({ convite: "qualquer-coisa-SEGREDO", expiraEm: 1 }),
    });
    const r = await grupo.criarConvite({ nome: "ana", horas: 1 });
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toContain("SEGREDO");
  });

  it("uma criação por vez", async () => {
    let solta!: () => void;
    const { grupo, pedidos } = comConvite(true, {
      criarConvite: (nomePc, horas) =>
        new Promise((r) => {
          pedidos2.push({ nomePc, horas });
          solta = () => r({ convite: TEXTO, expiraEm: 1 });
        }),
    });
    const pedidos2: Array<{ nomePc: string; horas: number }> = [];
    const primeira = grupo.criarConvite({ nome: "ana", horas: 1 });
    await new Promise((r) => setImmediate(r));
    const segunda = await grupo.criarConvite({ nome: "bia", horas: 1 });
    expect(segunda.ok).toBe(false);
    solta();
    expect((await primeira).ok).toBe(true);
    expect(pedidos2).toHaveLength(1);
    expect(pedidos).toEqual([]);
  });

  it("o texto do convite não vai para console nem para o estado da área", async () => {
    const gravado: string[] = [];
    const espioes = (["log", "info", "warn", "error", "debug"] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation((...a: unknown[]) => void gravado.push(a.join(" "))),
    );
    const { grupo } = comConvite(true);
    await grupo.criarConvite({ nome: "ana", horas: 1 });
    expect(JSON.stringify(await grupo.estado())).not.toContain(TEXTO);
    expect(gravado.join("\n")).not.toContain(TEXTO);
    for (const e of espioes) e.mockRestore();
  });
});
