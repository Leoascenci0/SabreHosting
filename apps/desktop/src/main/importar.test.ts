import { describe, expect, it, vi } from "vitest";
import { criarImportacao, type DepsImportacao } from "./importar.js";

const ANALISE = {
  arquivos: 3,
  versaoMinecraft: "1.21.1",
  indicios: { plugins: true, mods: false },
};

function deps(extra: Partial<DepsImportacao> = {}) {
  const importar = vi.fn<(zip: string, aceitar: boolean) => Promise<{ versao: number }>>(
    async () => ({ versao: 1 }),
  );
  const d: DepsImportacao = {
    escolherArquivo: async () => "/home/amigo/Downloads/mundo-velho.zip",
    analisar: async () => ANALISE,
    situacao: async () => ({ versaoNoGrupo: null, dono: false }),
    importar,
    servidorRodando: () => false,
    restaurando: () => false,
    ...extra,
  };
  return { d, importar: (extra.importar as typeof importar | undefined) ?? importar };
}

describe("importar mundo (cola da tela)", () => {
  it("escolher mostra nome, versão, avisos e a situação do grupo; o caminho fica no main", async () => {
    const { d } = deps();
    const r = await criarImportacao(d).escolher();
    expect(r).toEqual({
      ok: true,
      nome: "mundo-velho.zip",
      arquivos: 3,
      versaoMinecraft: "1.21.1",
      plugins: true,
      mods: false,
      versaoNoGrupo: null,
      dono: false,
    });
    expect(JSON.stringify(r)).not.toContain("/home/amigo");
  });

  it("cancelar o seletor não muda nada; zip recusado vira mensagem", async () => {
    expect(
      await criarImportacao(deps({ escolherArquivo: async () => undefined }).d).escolher(),
    ).toEqual({ ok: false, cancelado: true });
    const recusado = deps({
      analisar: async () => {
        throw new Error(
          "Zip do mundo recusado: caminho inseguro. Nada foi importado nem alterado.",
        );
      },
    });
    const i = criarImportacao(recusado.d);
    expect(await i.escolher()).toMatchObject({ ok: false, mensagem: /recusado/ });
    expect(await i.executar(true)).toMatchObject({ ok: false, mensagem: /Escolha o arquivo/ });
    expect(recusado.importar).not.toHaveBeenCalled();
  });

  it("executar usa o arquivo escolhido; confirmação só vale se o grupo já tinha versão", async () => {
    const vazio = deps();
    const i = criarImportacao(vazio.d);
    await i.escolher();
    expect(await i.executar(true)).toEqual({ ok: true, versao: 1 });
    expect(vazio.importar).toHaveBeenCalledWith("/home/amigo/Downloads/mundo-velho.zip", false);
    // Usado: precisa escolher de novo.
    expect(await i.executar(true)).toMatchObject({ ok: false, mensagem: /Escolha o arquivo/ });

    const comVersao = deps({ situacao: async () => ({ versaoNoGrupo: 4, dono: true }) });
    const j = criarImportacao(comVersao.d);
    await j.escolher();
    await j.executar(true);
    expect(comVersao.importar).toHaveBeenCalledWith(expect.any(String), true);
  });

  it("sem a confirmação explícita da tela não importa", async () => {
    const { d, importar } = deps();
    const i = criarImportacao(d);
    await i.escolher();
    for (const v of [false, "true", 1, undefined]) {
      expect(await i.executar(v)).toMatchObject({ ok: false, mensagem: /Confirme/ });
    }
    expect(importar).not.toHaveBeenCalled();
  });

  it("recusa com servidor rodando ou restauração em curso, sem chamar o núcleo", async () => {
    for (const extra of [{ servidorRodando: () => true }, { restaurando: () => true }]) {
      const { d, importar } = deps(extra);
      const i = criarImportacao(d);
      await i.escolher();
      expect(await i.executar(true)).toMatchObject({ ok: false });
      expect(importar).not.toHaveBeenCalled();
    }
  });

  it("uma importação por vez; erro do núcleo vira a mensagem dele", async () => {
    let soltar: () => void = () => undefined;
    const lenta = vi.fn(
      () => new Promise<{ versao: number }>((ok) => (soltar = () => ok({ versao: 2 }))),
    );
    const { d } = deps({ importar: lenta });
    const i = criarImportacao(d);
    await i.escolher();
    const primeira = i.executar(true);
    expect(i.importando()).toBe(true);
    expect(await i.executar(true)).toMatchObject({ ok: false, mensagem: /em andamento/ });
    expect(await i.escolher()).toMatchObject({ ok: false, mensagem: /em andamento/ });
    soltar();
    await primeira;
    expect(i.importando()).toBe(false);

    const falha = deps({
      importar: async () => {
        throw new Error(
          "Outro PC está mexendo no mundo do grupo agora. Nada foi importado nem alterado.",
        );
      },
    });
    const k = criarImportacao(falha.d);
    await k.escolher();
    expect(await k.executar(true)).toEqual({
      ok: false,
      mensagem: "Outro PC está mexendo no mundo do grupo agora. Nada foi importado nem alterado.",
    });
  });

  it("sem cartório na escolha: mensagem clara e nada guardado", async () => {
    const { d, importar } = deps({
      situacao: async () => {
        throw new Error("rede");
      },
    });
    const i = criarImportacao(d);
    expect(await i.escolher()).toMatchObject({ ok: false, mensagem: /cartório/ });
    expect(await i.executar(true)).toMatchObject({ ok: false, mensagem: /Escolha o arquivo/ });
    expect(importar).not.toHaveBeenCalled();
  });
});
