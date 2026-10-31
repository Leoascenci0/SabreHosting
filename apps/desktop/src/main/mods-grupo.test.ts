import { describe, expect, it } from "vitest";
import type { ModGrupo } from "@sabrehosting/nucleo/cartorio/tipos";
import type { ResultadoMods } from "@sabrehosting/nucleo/launcher/mods";
import { criarModsGrupo, type DepsModsGrupo } from "./mods-grupo.js";

const hash = (c: string) => c.repeat(128);
const MOD: ModGrupo = {
  nome: "Sodium",
  versao: "0.6.0",
  arquivo: "sodium.jar",
  url: "https://cdn.modrinth.com/data/AANobbMI/versions/x/sodium.jar",
  sha512: hash("a"),
  lado: "cliente",
};
const VAZIO: ResultadoMods = { baixados: [], mantidos: [], removidos: [], falhas: [] };

function montar(dono: boolean, extra: Partial<DepsModsGrupo> = {}) {
  let lista: ModGrupo[] = [MOD];
  const gravacoes: ModGrupo[][] = [];
  const sincronizacoes: Array<{ pasta: string; lado: string; lista: ModGrupo[] }> = [];
  const mods = criarModsGrupo({
    eu: async () => ({ id: dono ? 1 : 2, dono }),
    lerLista: async () => lista,
    gravarLista: async (nova) => void (gravacoes.push(nova), (lista = nova)),
    pastaDoServidor: () => "/srv/mods",
    pastaDaInstancia: () => "/prism/mods",
    servidorRodando: () => false,
    sincronizar: async (o) => (sincronizacoes.push(o), VAZIO),
    ...extra,
  });
  return { mods, gravacoes, sincronizacoes };
}

describe("mods do grupo (main)", () => {
  it("amigo vê a lista mas não edita: nada chega ao cartório", async () => {
    const { mods, gravacoes } = montar(false);
    expect(await mods.estado()).toMatchObject({ dono: false, mods: [MOD] });
    expect((await mods.adicionar({ ...MOD, arquivo: "outro.jar" })).ok).toBe(false);
    expect((await mods.tirar("sodium.jar")).ok).toBe(false);
    expect(gravacoes).toEqual([]);
  });

  it("dono adiciona: grava a lista inteira e sincroniza instância e servidor", async () => {
    const { mods, gravacoes, sincronizacoes } = montar(true);
    const novo = { ...MOD, nome: "Lithium", arquivo: "lithium.jar", lado: "ambos" as const };
    expect(await mods.adicionar(novo)).toMatchObject({ ok: true });
    expect(gravacoes).toEqual([[MOD, novo]]);
    expect(sincronizacoes.map((s) => [s.lado, s.pasta]).sort()).toEqual([
      ["cliente", "/prism/mods"],
      ["servidor", "/srv/mods"],
    ]);
    expect(sincronizacoes[0]?.lista).toEqual([MOD, novo]);
  });

  it("dono tira um mod que existe; o que não existe é recusado", async () => {
    const { mods, gravacoes } = montar(true);
    expect((await mods.tirar("nao-tem.jar")).ok).toBe(false);
    expect(await mods.tirar("sodium.jar")).toMatchObject({ ok: true });
    expect(gravacoes).toEqual([[]]);
  });

  it("recusa dado torto da janela (outro host, nome com caminho, hash curto, repetido) sem gravar", async () => {
    const { mods, gravacoes } = montar(true);
    const ruins: unknown[] = [
      { ...MOD, arquivo: "x.jar", url: "https://evil.example/x.jar" },
      { ...MOD, arquivo: "../x.jar" },
      { ...MOD, arquivo: "x.jar", sha512: "abc" },
      { ...MOD, arquivo: "x.jar", lado: "todos" },
      MOD,
      "texto",
      null,
    ];
    for (const r of ruins) expect((await mods.adicionar(r)).ok).toBe(false);
    expect((await mods.tirar(42)).ok).toBe(false);
    expect(gravacoes).toEqual([]);
  });

  it("servidor rodando: a pasta do servidor não é mexida; a da instância segue", async () => {
    const { mods, sincronizacoes } = montar(true, { servidorRodando: () => true });
    const r = await mods.adicionar({ ...MOD, arquivo: "b.jar" });
    expect(sincronizacoes.map((s) => s.lado)).toEqual(["cliente"]);
    expect(r).toMatchObject({ ok: true, aviso: expect.stringMatching(/servidor.*parado/i) });
  });

  it("sem pasta da instância: pula o lado do cliente e diz", async () => {
    const { mods, sincronizacoes } = montar(true, { pastaDaInstancia: () => undefined });
    const r = await mods.adicionar({ ...MOD, arquivo: "b.jar" });
    expect(sincronizacoes.map((s) => s.lado)).toEqual(["servidor"]);
    expect(r).toMatchObject({ ok: true, aviso: expect.stringMatching(/Prism/) });
  });

  it("falha de um mod vira aviso em pt-BR e a lista continua gravada", async () => {
    const { mods, gravacoes } = montar(true, {
      sincronizar: async () => ({
        ...VAZIO,
        falhas: [{ arquivo: "sodium.jar", motivo: "Hash não confere." }],
      }),
    });
    const r = await mods.adicionar({ ...MOD, arquivo: "b.jar" });
    expect(r).toMatchObject({ ok: true, aviso: expect.stringContaining("Hash não confere.") });
    expect(gravacoes).toHaveLength(1);
  });

  it("cartório fora do ar ao gravar: nada alterado e mensagem simples", async () => {
    const { mods } = montar(true, {
      gravarLista: async () => {
        throw new Error("rede");
      },
    });
    expect(await mods.adicionar({ ...MOD, arquivo: "b.jar" })).toMatchObject({
      ok: false,
      mensagem: expect.stringMatching(/Nada foi alterado/),
    });
  });

  it("sincronizar (arranque) é uma rodada por vez e mostra 'atualizando' enquanto roda", async () => {
    const soltar: Array<() => void> = [];
    let chamadas = 0;
    const { mods } = montar(false, {
      sincronizar: () =>
        new Promise<ResultadoMods>((ok) => {
          chamadas++;
          soltar.push(() => ok(VAZIO));
        }),
    });
    const rodada1 = mods.sincronizar();
    const rodada2 = mods.sincronizar(); // a mesma rodada, não outra
    await new Promise((r) => setTimeout(r, 0));
    expect((await mods.estado()).atualizando).toBe(true);
    expect(chamadas).toBe(1);
    soltar.shift()?.();
    await new Promise((r) => setTimeout(r, 0));
    soltar.shift()?.();
    await Promise.all([rodada1, rodada2]);
    expect(chamadas).toBe(2); // cliente e servidor, uma vez cada
    expect((await mods.estado()).atualizando).toBe(false);
  });
});
