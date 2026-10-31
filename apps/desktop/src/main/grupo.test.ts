import { describe, expect, it } from "vitest";
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
