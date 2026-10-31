import { describe, expect, it, vi } from "vitest";
import { criarBackups, type BackupItem, type DepsBackups } from "./backups.js";

const item = (nome: string, extra: Partial<BackupItem> = {}): BackupItem => ({
  nome,
  criadoEm: "2026-10-31T10:00:00.000Z",
  tamanho: 2048,
  ...extra,
});

function deps(
  extra: Partial<DepsBackups> = {},
): DepsBackups & { restaurar: ReturnType<typeof vi.fn> } {
  return {
    listar: async () => [item("a.tar.gz"), item("b.tar.gz")],
    restaurar: vi.fn(async () => undefined),
    servidorRodando: () => false,
    ...extra,
  } as DepsBackups & { restaurar: ReturnType<typeof vi.fn> };
}

describe("backups (cola da tela)", () => {
  it("lista com 'Este PC' como autor e trava os botões com o servidor rodando", async () => {
    const livre = await criarBackups(deps()).estado();
    expect(livre.bloqueado).toBe(false);
    expect(livre.itens[0]).toMatchObject({ nome: "a.tar.gz", dePc: "Este PC" });
    const rodando = await criarBackups(deps({ servidorRodando: () => true })).estado();
    expect(rodando.bloqueado).toBe(true);
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
