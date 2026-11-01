// appui-1.4b: Mods em subtela de Grupo (barra lateral › Grupo › Mods). Capturas só com SABRE_CAPTURAS=1.
import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { registrarCaptura } from "./captura.js";
import { afterEach, describe, expect, it } from "vitest";

const pastaApp = fileURLToPath(new URL("..", import.meta.url));
const imagens = fileURLToPath(new URL("../../../docs/imagens/appui-1.4/", import.meta.url));
const semSandbox = process.getuid?.() === 0 ? ["--no-sandbox"] : [];

let aberto: ElectronApplication | undefined;
let dados: string | undefined;

async function abrir(dono = false): Promise<Page> {
  dados = mkdtempSync(join(tmpdir(), "sabre-e2e-"));
  aberto = await electron.launch({
    args: [...semSandbox, `--user-data-dir=${dados}`, pastaApp],
    env: {
      ...process.env,
      SABRE_E2E: "1",
      SABRE_E2E_CENARIO: "ninguem",
      ...(dono ? { SABRE_E2E_DONO: "1" } : {}),
    } as Record<string, string>,
    timeout: 20_000,
  });
  const pagina = await aberto.firstWindow();
  await pagina.waitForLoadState("load");
  await pagina.locator("#cartao:not([data-estado=carregando])").waitFor();
  await pagina.locator('[data-area="grupo"]').click();
  await pagina.locator("#ver-mods").click(); // Mods mora dentro de Grupo
  await pagina.locator("#tela-mods:not([hidden])").waitFor();
  await pagina.locator("#mods-lista li").first().waitFor();
  return pagina;
}

const esperarTexto = (p: Page, seletor: string, trecho: string): Promise<unknown> =>
  p.waitForFunction(
    ([s, t]) => document.querySelector(s as string)?.textContent?.includes(t as string),
    [seletor, trecho],
  );

const listasDeMods = (): Promise<Array<Array<{ arquivo: string; lado: string }>>> =>
  aberto?.evaluate(
    () =>
      (globalThis as unknown as { __sabreE2EMods: { listas: unknown[] } }).__sabreE2EMods.listas,
  ) as Promise<Array<Array<{ arquivo: string; lado: string }>>>;

const interruptor = (campos: Record<string, boolean | number>): Promise<unknown> =>
  aberto?.evaluate((_electron, c: Record<string, boolean | number>) => {
    const falso = (globalThis as unknown as Record<string, Record<string, unknown>>)[
      "__sabreE2EMods"
    ];
    if (falso) Object.assign(falso, c);
  }, campos) as Promise<unknown>;

/** Os três passos curtos: nome e versão → arquivo → link (código de conferência e "onde usar" em Avançado). */
async function adicionar(
  p: Page,
  m: { nome: string; versao: string; arquivo: string; url: string; hash: string; lado?: string },
): Promise<void> {
  if (await p.locator("#mods-adicionar").isHidden()) await p.locator("#mods-novo").click();
  await p.locator("#mods-nome").fill(m.nome);
  await p.locator("#mods-versao").fill(m.versao);
  await p.locator("#mods-proximo").click();
  await p.locator("#mods-arquivo").fill(m.arquivo);
  await p.locator("#mods-proximo").click();
  await p.locator("#mods-url").fill(m.url);
  if ((await p.locator("#mods-avancado").getAttribute("open")) === null)
    await p.locator("#mods-avancado summary").click();
  await p.locator("#mods-hash").fill(m.hash);
  if (m.lado) await p.locator("#mods-lado").selectOption(m.lado);
  await p.locator("#mods-adicionar-botao").click();
}

afterEach(async () => {
  await Promise.race([
    aberto?.evaluate(({ app: a }) => a.exit(0)).catch(() => undefined),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
  await aberto?.close().catch(() => undefined);
  aberto = undefined;
  if (dados) rmSync(dados, { recursive: true, force: true });
});

describe("tela Mods", () => {
  it("amigo vê a lista (nome, versão e onde vale), mas não tem como editar", async () => {
    const p = await abrir();
    const texto = (await p.locator("#mods-lista").textContent()) ?? "";
    expect(texto).toContain("Sodium");
    expect(texto).toContain("versão");
    expect(texto).toContain("vale para");
    expect(await p.locator("#mods-dono").isHidden()).toBe(true);
    expect(await p.locator("#mods-novo").isVisible()).toBe(false);
    expect(await p.locator("#mods-lista button").count()).toBe(0);
  });

  it("dono: o formulário abre em passos; Avançado começa recolhido; faltou campo, não avança", async () => {
    const p = await abrir(true);
    await p.locator("#mods-dono:not([hidden])").waitFor();
    expect(await p.locator("#mods-adicionar").isHidden()).toBe(true);
    await registrarCaptura(p, join(imagens, "depois-mods-claro.png"));
    await p.locator("#mods-novo").click();
    expect(await p.locator("#mods-passo").textContent()).toBe("Passo 1 de 3");
    expect(await p.locator("#mods-arquivo").isVisible()).toBe(false);
    await p.locator("#mods-proximo").click(); // sem nome nem versão
    await esperarTexto(p, "#mods-erro", "nome e a versão");
    expect(await p.locator("#mods-passo").textContent()).toBe("Passo 1 de 3");
    await p.locator("#mods-nome").fill("Lithium");
    await p.locator("#mods-versao").fill("0.13.0");
    await p.locator("#mods-proximo").click();
    expect(await p.locator("#mods-passo").textContent()).toBe("Passo 2 de 3");
    expect(await p.locator("#mods-erro").isHidden()).toBe(true);
    await p.locator("#mods-anterior").click(); // voltar guarda o que foi digitado
    expect(await p.locator("#mods-nome").inputValue()).toBe("Lithium");
    await p.locator("#mods-proximo").click();
    await p.locator("#mods-arquivo").fill("lithium.jar");
    await p.locator("#mods-proximo").click();
    expect(await p.locator("#mods-passo").textContent()).toBe("Passo 3 de 3");
    expect(await p.locator("#mods-avancado").getAttribute("open")).toBeNull();
    expect(await p.locator("#mods-hash").isVisible()).toBe(false);
    await p.locator("#mods-avancado summary").click();
    expect(await p.locator("#mods-hash").isVisible()).toBe(true);
    expect(await p.locator("#mods-lado").inputValue()).toBe("ambos");
    await p.locator("#mods-descartar").click(); // cancelar fecha sem gravar
    expect(await p.locator("#mods-adicionar").isHidden()).toBe(true);
    expect(await listasDeMods()).toEqual([]);
    await p.locator("#mods-novo").click();
    expect(await p.locator("#mods-nome").inputValue()).toBe(""); // começa limpo
  });

  it("dono adiciona (confirma só ao tirar) e a lista segue o cartório", async () => {
    const p = await abrir(true);
    await p.locator("#mods-dono:not([hidden])").waitFor();
    const lithium = {
      nome: "Lithium",
      versao: "0.13.0",
      arquivo: "lithium.jar",
      url: "https://evil.example/lithium.jar",
      hash: "b".repeat(128),
    };
    await adicionar(p, lithium);
    await esperarTexto(p, "#mods-erro", "cdn.modrinth.com");
    expect(await listasDeMods()).toEqual([]); // link de outro site: nada gravado
    await p.locator("#mods-url").fill("https://cdn.modrinth.com/data/x/versions/y/lithium.jar");
    await p.locator("#mods-lado").selectOption("cliente");
    await p.locator("#mods-adicionar-botao").click();
    await p.waitForFunction(() => document.querySelectorAll("#mods-lista li").length === 2);
    const gravada = (await listasDeMods())[0];
    expect(gravada?.map((m) => m.arquivo)).toEqual(["sodium.jar", "lithium.jar"]);
    expect(gravada?.[1]?.lado).toBe("cliente");
    expect(await p.locator("#mods-adicionar").isHidden()).toBe(true); // fechou e limpou
    expect(await p.locator("#mods-lista li", { hasText: "Lithium" }).textContent()).toContain(
      "só o jogo",
    );

    await p
      .locator("#mods-lista li", { hasText: "Sodium" })
      .getByRole("button", { name: "Tirar da lista" })
      .click();
    await esperarTexto(p, "#mods-pergunta", "Sodium");
    await p.locator("#mods-cancelar").click();
    expect((await listasDeMods()).length).toBe(1); // cancelar não grava
    await p
      .locator("#mods-lista li", { hasText: "Sodium" })
      .getByRole("button", { name: "Tirar da lista" })
      .click();
    await p.locator("#mods-confirmar").click();
    await p.waitForFunction(() => document.querySelectorAll("#mods-lista li").length === 1);
    expect((await listasDeMods())[1]?.map((m) => m.arquivo)).toEqual(["lithium.jar"]);
  });

  it("aviso e erro antigos somem quando a lista volta a carregar", async () => {
    const p = await abrir(true);
    const reabrir = async (): Promise<void> => {
      await p.locator("#mods-voltar").click();
      await p.locator("#ver-mods").click();
      await p.locator("#mods-dono:not([hidden])").waitFor();
    };
    const lib = (nome: string, arquivo: string) => ({
      nome,
      versao: "1.0.0",
      arquivo,
      url: `https://cdn.modrinth.com/data/x/versions/y/${arquivo}`,
      hash: "c".repeat(128),
    });

    // Aviso: sem a pasta da instância, o aviso aparece; depois a pasta existe e o aviso some.
    await p.locator("#mods-dono:not([hidden])").waitFor();
    await interruptor({ semInstancia: true });
    await adicionar(p, lib("Lithium", "lithium.jar"));
    await esperarTexto(p, "#mods-aviso", "Prism ainda não foi criada");
    await interruptor({ semInstancia: false });
    await adicionar(p, lib("Iris", "iris.jar")); // uma conferência que dá certo limpa o aviso no servidor
    await p.waitForFunction(() => document.querySelectorAll("#mods-lista li").length === 3);
    await reabrir();
    await p.waitForFunction(
      () => document.querySelector("#mods-aviso")?.textContent === "",
      undefined,
      {
        timeout: 5000,
      },
    );

    // Erro de leitura: some quando a leitura volta.
    await interruptor({ falhaLer: true });
    await reabrir();
    const erroVisivel = (): boolean =>
      (document.querySelector("#mods-erro") as HTMLElement | null)?.hidden === false;
    await p.waitForFunction(erroVisivel, undefined, { timeout: 5000 });
    await interruptor({ falhaLer: false });
    await p.locator("#mods-voltar").click();
    await p.locator("#ver-mods").click();
    await p.waitForFunction(
      () => (document.querySelector("#mods-erro") as HTMLElement | null)?.hidden === true,
      undefined,
      { timeout: 5000 },
    );
  });

  it("leitura que falha logo após uma ação com erro mantém o erro da ação", async () => {
    const p = await abrir(true);
    await p.locator("#mods-dono:not([hidden])").waitFor();
    // A ação lê a lista (passa), confere o link (erro de ação); a leitura logo depois da ação falha.
    await interruptor({ falhaLer: true, leiturasOk: 1 });
    await adicionar(p, {
      nome: "Lithium",
      versao: "0.13.0",
      arquivo: "lithium.jar",
      url: "https://evil.example/lithium.jar",
      hash: "b".repeat(128),
    });
    // Dá tempo de a ação e a leitura (que falha) terminarem; o erro da ação tem que continuar na tela.
    await p.waitForTimeout(1000);
    expect(await p.locator("#mods-erro").textContent()).toContain("cdn.modrinth.com");
    expect(await p.locator("#mods-erro").textContent()).not.toContain("cartório");
    await interruptor({ falhaLer: false, leiturasOk: 0 });
  });

  it("releitura depois de ação bem-sucedida mostra a falha de leitura", async () => {
    const p = await abrir(true);
    await p.locator("#mods-dono:not([hidden])").waitFor();
    // A ação lê (passa), grava com sucesso; a releitura logo depois falha e não há erro de ação na tela.
    await interruptor({ falhaLer: true, leiturasOk: 1 });
    await adicionar(p, {
      nome: "Iris",
      versao: "1.0.0",
      arquivo: "iris2.jar",
      url: "https://cdn.modrinth.com/data/x/versions/y/iris2.jar",
      hash: "c".repeat(128),
    });
    await esperarTexto(p, "#mods-erro", "cartório agora");
    await interruptor({ falhaLer: false, leiturasOk: 0 });
  });

  it("barra lateral: de Mods, Grupo volta à tela do Grupo; tema escuro cabe na janela", async () => {
    const p = await abrir(true);
    await p.locator("#mods-dono:not([hidden])").waitFor();
    await p.locator("#mods-novo").click();
    await aberto?.evaluate(({ nativeTheme }) => void (nativeTheme.themeSource = "dark"));
    await p.emulateMedia({ colorScheme: "dark" });
    await registrarCaptura(p, join(imagens, "depois-mods-escuro.png"));
    const [largura, janela] = await p.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(largura).toBeLessThanOrEqual(janela ?? 0);
    await p.locator('[data-area="grupo"]').click();
    await p.locator("#tela-grupo:not([hidden])").waitFor();
    expect(await p.locator("#tela-mods").isHidden()).toBe(true);
  });
});
