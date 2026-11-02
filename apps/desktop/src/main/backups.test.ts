import { describe, expect, it, vi } from "vitest";
import { protegerEscrita } from "./demonstracao.js";
import { criarBackups, type BackupItem, type DepsBackups } from "./backups.js";

const item = (nome: string, extra: Partial<BackupItem> = {}): BackupItem => ({
  nome,
  criadoEm: "2026-10-31T10:00:00.000Z",
  tamanho: 2048,
  ...extra,
});

function deps(
  extra: Partial<DepsBackups> = {},
): DepsBackups & { restaurar: ReturnType<typeof vi.fn>; fazerBackup: ReturnType<typeof vi.fn> } {
  return {
    listar: async () => [item("a.tar.gz"), item("b.tar.gz")],
    restaurar: vi.fn(async () => undefined),
    servidorRodando: () => false,
    servidorPronto: () => true,
    fazerBackup: vi.fn(async () => undefined),
    ...extra,
  } as DepsBackups & { restaurar: ReturnType<typeof vi.fn>; fazerBackup: ReturnType<typeof vi.fn> };
}

describe("backups (cola da tela)", () => {
  it("lista com 'Este PC' como autor e trava os botões com o servidor rodando", async () => {
    const livre = await criarBackups(deps()).estado();
    expect(livre.bloqueado).toBe(false);
    expect(livre.itens[0]).toMatchObject({ nome: "a.tar.gz", dePc: "Este PC" });
    const rodando = await criarBackups(deps({ servidorRodando: () => true })).estado();
    expect(rodando.bloqueado).toBe(true);
  });

  it("mostra o aviso do histórico longo quando a cópia para a pasta falhou (ajuste 4)", async () => {
    const texto = "A pasta do histórico não foi encontrada; o backup deste PC está salvo.";
    const r = await criarBackups(deps({ avisoHistorico: () => texto })).estado();
    expect(r.avisoHistorico).toBe(texto);
    expect(r.itens).toHaveLength(2); // a lista local segue normal
    expect((await criarBackups(deps()).estado()).avisoHistorico).toBeUndefined();
  });

  it("lista que não carrega vira mensagem em pt-BR, sem estourar", async () => {
    const r = await criarBackups(
      deps({ listar: async () => Promise.reject(new Error("x")) }),
    ).estado();
    expect(r.itens).toEqual([]);
    expect(r.erro).toMatch(/backups/i);
  });

  it("restaurar chama o núcleo com um nome da lista", async () => {
    const d = deps();
    expect(await criarBackups(d).restaurar("b.tar.gz")).toEqual({ ok: true });
    expect(d.restaurar).toHaveBeenCalledWith("b.tar.gz");
  });

  it("recusa nome fora da lista (caminho vindo da tela) sem chamar o núcleo", async () => {
    const d = deps();
    for (const nome of ["../../mundo", "c.tar.gz", "", 7 as never]) {
      expect((await criarBackups(d).restaurar(nome)).ok).toBe(false);
    }
    expect(d.restaurar).not.toHaveBeenCalled();
  });

  it("recusa restaurar com o servidor rodando", async () => {
    const d = deps({ servidorRodando: () => true });
    const r = await criarBackups(d).restaurar("a.tar.gz");
    expect(r).toMatchObject({ ok: false });
    expect(d.restaurar).not.toHaveBeenCalled();
  });

  it("uma restauração por vez", async () => {
    let liberar: () => void = () => undefined;
    const d = deps({ restaurar: vi.fn(() => new Promise<void>((ok) => (liberar = ok))) });
    const b = criarBackups(d);
    const primeira = b.restaurar("a.tar.gz");
    expect((await b.restaurar("b.tar.gz")).ok).toBe(false);
    liberar();
    expect(await primeira).toEqual({ ok: true });
    expect(d.restaurar).toHaveBeenCalledTimes(1);
  });

  it("sinaliza 'restaurando' durante a troca (o Hospedar espera) e solta no fim, mesmo com erro", async () => {
    let liberar: (erro?: Error) => void = () => undefined;
    const d = deps({
      restaurar: vi.fn(
        () => new Promise<void>((ok, nao) => (liberar = (e) => (e ? nao(e) : ok()))),
      ),
    });
    const b = criarBackups(d);
    expect(b.restaurando()).toBe(false);
    const feita = b.restaurar("a.tar.gz");
    expect(b.restaurando()).toBe(true); // já vale antes de qualquer espera
    await new Promise((ok) => setTimeout(ok, 5));
    liberar(new Error("falhou"));
    await feita;
    expect(b.restaurando()).toBe(false);
  });

  it("erro do núcleo chega à tela com a mensagem em pt-BR", async () => {
    const d = deps({ restaurar: vi.fn(async () => Promise.reject(new Error("Sem a trava."))) });
    expect(await criarBackups(d).restaurar("a.tar.gz")).toEqual({
      ok: false,
      mensagem: "Sem a trava.",
    });
  });
});

describe("backup manual (appuimel-1.1)", () => {
  it("o estado diz se dá para fazer backup agora e leva a origem de cada linha", async () => {
    const pronto = await criarBackups(
      deps({ listar: async () => [item("a.tar.gz", { origem: "manual" })] }),
    ).estado();
    expect(pronto.prontoParaBackup).toBe(true);
    expect(pronto.itens[0]).toMatchObject({ origem: "manual", dePc: "Este PC" });
    expect(
      (await criarBackups(deps({ servidorPronto: () => false })).estado()).prontoParaBackup,
    ).toBe(false);
  });

  it("faz o backup pelo caminho único, uma vez", async () => {
    const d = deps();
    expect(await criarBackups(d).fazer()).toEqual({ ok: true });
    expect(d.fazerBackup).toHaveBeenCalledTimes(1);
  });

  it("recusa sem servidor pronto, com mensagem clara, sem tocar no mundo", async () => {
    const d = deps({ servidorPronto: () => false });
    const r = await criarBackups(d).fazer();
    expect(r).toMatchObject({ ok: false, mensagem: expect.stringMatching(/servidor/i) });
    expect(d.fazerBackup).not.toHaveBeenCalled();
  });

  it("recusa com backup em andamento (um por vez) e deixa o seguinte rodar depois", async () => {
    let liberar: () => void = () => undefined;
    const d = deps();
    d.fazerBackup.mockImplementationOnce(() => new Promise<void>((ok) => (liberar = ok)));
    const b = criarBackups(d);
    const primeiro = b.fazer();
    expect(await b.fazer()).toMatchObject({
      ok: false,
      mensagem: expect.stringMatching(/andamento/i),
    });
    liberar();
    expect(await primeiro).toEqual({ ok: true });
    expect(d.fazerBackup).toHaveBeenCalledTimes(1);
    expect((await b.fazer()).ok).toBe(true);
  });

  it("recusa durante a restauração, e a restauração recusa durante o backup", async () => {
    let liberar: () => void = () => undefined;
    const d = deps({ restaurar: vi.fn(() => new Promise<void>((ok) => (liberar = ok))) });
    const b = criarBackups(d);
    const restaurando = b.restaurar("a.tar.gz");
    expect((await b.fazer()).ok).toBe(false);
    expect(d.fazerBackup).not.toHaveBeenCalled();
    liberar();
    await restaurando;
    let soltar: () => void = () => undefined;
    const d2 = deps({ fazerBackup: vi.fn(() => new Promise<void>((ok) => (soltar = ok))) });
    const b2 = criarBackups(d2);
    const fazendo = b2.fazer();
    expect((await b2.restaurar("a.tar.gz")).ok).toBe(false);
    expect(d2.restaurar).not.toHaveBeenCalled();
    soltar();
    await fazendo;
  });

  it("em demonstração a escrita é recusada no main e nada é chamado", async () => {
    const d = deps();
    const fazer = protegerEscrita({ ativa: () => true }, () => criarBackups(d).fazer());
    expect((await fazer()).ok).toBe(false);
    expect(d.fazerBackup).not.toHaveBeenCalled();
  });

  it("falha do núcleo vira texto fixo seguro, sem caminho cru, e libera o próximo", async () => {
    const d = deps({
      fazerBackup: vi.fn(async () => Promise.reject(new Error("EACCES: C:\\Users\\Eliel\\mundo"))),
    });
    const b = criarBackups(d);
    const r = await b.fazer();
    expect(r).toMatchObject({ ok: false });
    expect(JSON.stringify(r)).not.toMatch(/Users|EACCES|\\/);
    expect((await b.fazer()).ok).toBe(false);
    expect(d.fazerBackup).toHaveBeenCalledTimes(2);
  });
});
