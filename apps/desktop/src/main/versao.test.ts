import { describe, expect, it } from "vitest";
import { criarVersao, type DepsVersao } from "./versao.js";

const SHA1 = "a".repeat(40);

function montar(opts: { dono?: boolean; rodando?: boolean } & Partial<DepsVersao> = {}) {
  const { dono = true, rodando = false, ...extra } = opts;
  const gravados: [string, string][] = [];
  const ordem: string[] = [];
  let consultouOpcoes = 0;
  const versao = criarVersao({
    eu: async () => ({ id: 1, dono }),
    lerAtual: async () => "1.21.1",
    listar: async () => ["1.21.1", "1.20.4", "1.20.1", "1.12.2"],
    opcoes: async (v) => {
      consultouOpcoes++;
      return v === "1.21.1"
        ? { neoforge: true, fabricForge: true, consultou: true }
        : { neoforge: v === "1.20.4", fabricForge: false, consultou: true };
    },
    sha1Do: async () => SHA1,
    backupAntes: async () => void ordem.push("backup"),
    gravar: async (v, s) => void (ordem.push("gravar"), gravados.push([v, s])),
    servidorRodando: () => rodando,
    ...extra,
  });
  return { versao, gravados, ordem, consultas: () => consultouOpcoes };
}

describe("versão do Minecraft (main)", () => {
  it("não-dono: não lista, não consulta e não grava", async () => {
    const { versao, gravados, consultas } = montar({ dono: false });
    expect(await versao.estado()).toEqual({ dono: false });
    expect((await versao.opcoes("1.21.1")).ok).toBe(false);
    expect((await versao.gravar("1.20.4")).ok).toBe(false);
    expect(gravados).toEqual([]);
    expect(consultas()).toBe(0);
  });

  it("dono: lista da mais nova à mais antiga, com a versão atual do grupo", async () => {
    const { versao } = montar();
    expect(await versao.estado()).toEqual({
      dono: true,
      atual: "1.21.1",
      versoes: ["1.21.1", "1.20.4", "1.20.1", "1.12.2"],
    });
  });

  it("1.21.1 roda NeoForge + Fabric e Forge juntos", async () => {
    const r = await montar().versao.opcoes("1.21.1");
    expect(r).toMatchObject({ ok: true, neoforge: true, fabricForge: true });
    expect(r.ok && r.texto).toMatch(/Fabric e Forge/);
  });

  it("versão sem Connector não oferece Fabric + Forge", async () => {
    const r = await montar().versao.opcoes("1.20.4");
    expect(r).toMatchObject({ ok: true, fabricForge: false });
    expect(r.ok && r.texto).not.toMatch(/Fabric e Forge/);
  });

  it("1.20.1 não é oferecida como pronta com mods (sem hash do instalador)", async () => {
    const r = await montar({
      opcoes: async () => ({ neoforge: true, fabricForge: true, consultou: true }),
    }).versao.opcoes("1.20.1");
    expect(r).toMatchObject({ ok: true, neoforge: false, fabricForge: false });
    expect(r.ok && r.texto).toMatch(/só roda sem mods.*ainda não foi liberado/);
  });

  it("outra versão não mostra o aviso de mods pendentes", async () => {
    const r = await montar().versao.opcoes("1.21.1");
    expect(r.ok && r.texto).not.toMatch(/ainda não foi liberado/);
  });

  it("trocando(): vale durante o backup e a gravação, e volta a falso em sucesso e em falha", async () => {
    let solta!: () => void;
    const { versao } = montar({ backupAntes: () => new Promise<void>((ok) => (solta = ok)) });
    expect(versao.trocando()).toBe(false);
    const p = versao.gravar("1.20.4");
    await new Promise((r) => setTimeout(r, 0));
    expect(versao.trocando()).toBe(true);
    solta();
    await p;
    expect(versao.trocando()).toBe(false);
    const falha = montar({
      backupAntes: async () => {
        throw new Error("x");
      },
    }).versao;
    await falha.gravar("1.20.4");
    expect(falha.trocando()).toBe(false);
  });

  it("consulta que falhou: só sem mods, dito com clareza", async () => {
    const r = await montar({
      opcoes: async () => ({ neoforge: false, fabricForge: false, consultou: false }),
    }).versao.opcoes("1.21.1");
    expect(r.ok && r.texto).toMatch(/não consegui consultar/i);
  });

  it("grava a versão com o sha1 do plano oficial", async () => {
    const { versao, gravados } = montar();
    expect(await versao.gravar("1.20.4")).toEqual({ ok: true });
    expect(gravados).toEqual([["1.20.4", SHA1]]);
  });

  it("servidor rodando neste PC: recusa antes de ir ao cartório", async () => {
    const { versao, gravados } = montar({ rodando: true });
    expect(await versao.gravar("1.20.4")).toMatchObject({
      ok: false,
      mensagem: expect.stringMatching(/servidor/i),
    });
    expect(gravados).toEqual([]);
  });

  it.each([["1.99.9"], [""], ["../x"], [21], [undefined]])(
    "entrada da janela %j não chega ao cartório",
    async (v) => {
      const { versao, gravados } = montar();
      expect((await versao.gravar(v)).ok).toBe(false);
      expect((await versao.opcoes(v)).ok).toBe(false);
      expect(gravados).toEqual([]);
    },
  );

  it("409 do cartório mostra a mensagem dele, em pt-BR", async () => {
    const { versao } = montar({
      gravar: async () => {
        throw Object.assign(new Error("Tem um servidor no ar; pare antes de trocar a versão."), {
          status: 409,
        });
      },
    });
    expect(await versao.gravar("1.20.4")).toEqual({
      ok: false,
      mensagem: "Tem um servidor no ar; pare antes de trocar a versão.",
    });
  });

  it("falha sem resposta: mensagem genérica, sem texto técnico", async () => {
    const { versao } = montar({
      gravar: async () => {
        throw new TypeError("fetch failed ECONNRESET");
      },
    });
    const r = await versao.gravar("1.20.4");
    expect(r.ok).toBe(false);
    expect(!r.ok && r.mensagem).not.toMatch(/fetch|ECONN/);
  });

  it("duas gravações ao mesmo tempo: a segunda é recusada", async () => {
    let solta!: () => void;
    const { versao, gravados } = montar({
      gravar: (v, s) => new Promise<void>((ok) => (solta = () => (gravados.push([v, s]), ok()))),
    });
    const primeira = versao.gravar("1.20.4");
    await new Promise((r) => setTimeout(r, 0));
    expect((await versao.gravar("1.20.4")).ok).toBe(false);
    solta();
    expect(await primeira).toEqual({ ok: true });
  });

  it("grava a versão só depois do backup bom", async () => {
    const { versao, gravados, ordem } = montar();
    expect(await versao.gravar("1.20.4")).toEqual({ ok: true });
    expect(ordem).toEqual(["backup", "gravar"]);
    expect(gravados).toEqual([["1.20.4", SHA1]]);
  });

  it("backup que falha recusa a troca, diz por quê e a versão não muda", async () => {
    const { versao, gravados } = montar({
      backupAntes: async () => {
        throw new Error("Não achei a pasta de backups.");
      },
    });
    const r = await versao.gravar("1.20.4");
    expect(r).toEqual({
      ok: false,
      mensagem:
        "Não troquei a versão: o backup antes da troca falhou. Não achei a pasta de backups.",
    });
    expect(gravados).toEqual([]);
  });

  it("servidor rodando segue recusado, sem backup nem gravação", async () => {
    const { versao, gravados, ordem } = montar({ rodando: true });
    expect((await versao.gravar("1.20.4")).ok).toBe(false);
    expect(ordem).toEqual([]);
    expect(gravados).toEqual([]);
  });
});
