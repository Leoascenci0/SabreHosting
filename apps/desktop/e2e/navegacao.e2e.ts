// appuimel-2.2: barra superior com abas, chip de estado e rodapé. Capturas em docs/imagens/appuimel-2.2 só com SABRE_CAPTURAS=1.
import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registrarCaptura } from "./captura.js";

const pastaApp = fileURLToPath(new URL("..", import.meta.url));
const imagens = fileURLToPath(new URL("../../../docs/imagens/appuimel-2.2/", import.meta.url));
const dados = mkdtempSync(join(tmpdir(), "sabre-e2e-"));
const semSandbox = process.getuid?.() === 0 ? ["--no-sandbox"] : [];

let app: ElectronApplication;
let pagina: Page;

const item = (area: string) => pagina.locator(`[data-area="${area}"]`);
const atual = () => pagina.locator('.item-barra[aria-current="page"]').getAttribute("data-area");

beforeAll(async () => {
  app = await electron.launch({
    args: [...semSandbox, `--user-data-dir=${dados}`, pastaApp],
    env: { ...process.env, SABRE_E2E: "1" } as Record<string, string>,
    timeout: 20_000,
  });
  pagina = await app.firstWindow();
  await pagina.waitForLoadState("load");
});

afterAll(async () => {
  await Promise.race([
    app?.evaluate(({ app: a }) => a.exit(0)).catch(() => undefined),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
  await app?.close().catch(() => undefined);
  rmSync(dados, { recursive: true, force: true });
});

describe("barra superior", () => {
  it("mostra Início, Backups, Mundo, Grupo e Configurações, com o Início marcado", async () => {
    const nomes = await pagina.locator(".item-barra span").allInnerTexts();
    expect(nomes).toEqual(["Início", "Backups", "Mundo", "Grupo", "Configurações"]);
    expect(await pagina.locator(".item-barra svg").count()).toBe(5);
    expect(await atual()).toBe("inicio");
    await expect(pagina.locator("#cartao").isVisible()).resolves.toBe(true);
  });

  it("Mundo abre a sua tela, marca a aba e volta ao Início pela barra", async () => {
    await item("mundo").click();
    await expect(pagina.locator("#tela-mundo").isVisible()).resolves.toBe(true);
    await expect(pagina.locator("#cartao").isHidden()).resolves.toBe(true);
    expect(await atual()).toBe("mundo");
    await item("inicio").click();
    await expect(pagina.locator("#cartao").isVisible()).resolves.toBe(true);
    await expect(pagina.locator("#tela-mundo").isHidden()).resolves.toBe(true);
    expect(await atual()).toBe("inicio");
  });

  it("cada item abre a sua tela e marca o atual", async () => {
    await item("backups").click();
    await expect(pagina.locator("#tela-backups").isVisible()).resolves.toBe(true);
    await expect(pagina.locator("#cartao").isHidden()).resolves.toBe(true);
    expect(await atual()).toBe("backups");

    await item("configuracoes").click();
    await expect(pagina.locator("#tela-config").isVisible()).resolves.toBe(true);
    await expect(pagina.locator("#tela-backups").isHidden()).resolves.toBe(true);
    expect(await atual()).toBe("configuracoes");

    await item("grupo").click();
    await expect(pagina.locator("#tela-grupo").isVisible()).resolves.toBe(true);
    await expect(pagina.locator("#tela-config").isHidden()).resolves.toBe(true);
    expect(await atual()).toBe("grupo");

    // Mods é subtela de Grupo: a barra continua em "Grupo" e voltar à barra leva à tela do Grupo.
    await pagina.locator("#ver-mods").click();
    await expect(pagina.locator("#tela-mods").isVisible()).resolves.toBe(true);
    expect(await atual()).toBe("grupo");
    await item("grupo").click();
    await expect(pagina.locator("#tela-grupo").isVisible()).resolves.toBe(true);
    await expect(pagina.locator("#tela-mods").isHidden()).resolves.toBe(true);
    await pagina.locator("#ver-mods").click();
    await item("backups").click(); // de Mods direto para outra área
    await expect(pagina.locator("#tela-backups").isVisible()).resolves.toBe(true);
    await expect(pagina.locator("#tela-mods").isHidden()).resolves.toBe(true);
    expect(await atual()).toBe("backups");
    await item("grupo").click();

    await item("inicio").click();
    await expect(pagina.locator("#cartao").isVisible()).resolves.toBe(true);
    await expect(pagina.locator("#tela-config").isHidden()).resolves.toBe(true);
    expect(await atual()).toBe("inicio");
  });

  it("os botões que já existiam nas telas continuam levando e trazendo (barra acompanha)", async () => {
    await pagina.locator("#ver-backups").click();
    expect(await atual()).toBe("backups");
    await item("inicio").click();
    expect(await atual()).toBe("inicio");
    await pagina.locator("#ver-config").click();
    expect(await atual()).toBe("configuracoes");
    await pagina.locator("#config-voltar").click();
    expect(await atual()).toBe("inicio");
  });

  it("teclado: Tab chega ao item atual; setas e Home/End andam pelas abas", async () => {
    await item("inicio").focus();
    await pagina.keyboard.press("ArrowRight");
    await expect(item("backups").evaluate((e) => e === document.activeElement)).resolves.toBe(true);
    await pagina.keyboard.press("End");
    await expect(item("configuracoes").evaluate((e) => e === document.activeElement)).resolves.toBe(
      true,
    );
    await pagina.keyboard.press("ArrowRight");
    await expect(item("inicio").evaluate((e) => e === document.activeElement)).resolves.toBe(true);
    await pagina.keyboard.press("ArrowLeft");
    await expect(item("configuracoes").evaluate((e) => e === document.activeElement)).resolves.toBe(
      true,
    );
    await pagina.keyboard.press("Enter");
    expect(await atual()).toBe("configuracoes");
    // Só o item atual entra na ordem do Tab (os outros se alcançam pelas setas).
    const tabs = await pagina.locator(".item-barra").evaluateAll((l) => l.map((e) => e.tabIndex));
    expect(tabs).toEqual([-1, -1, -1, -1, 0]);
    await item("inicio").click();
  });

  it("a barra fica no alto, com o chip à direita e o rodapé embaixo", async () => {
    const caixa = (sel: string) =>
      pagina.locator(sel).evaluate((e) => e.getBoundingClientRect().toJSON());
    const [barra, conteudo, rodape, chip, aba] = await Promise.all([
      caixa("#barra"),
      caixa(".conteudo"),
      caixa("#rodape"),
      caixa("#chip-estado"),
      caixa('[data-area="configuracoes"]'),
    ]);
    expect(barra.top).toBeLessThanOrEqual(1);
    expect(barra.bottom).toBeLessThanOrEqual(conteudo.top + 1);
    expect(rodape.top).toBeGreaterThanOrEqual(conteudo.bottom - 1);
    expect(chip.left).toBeGreaterThan(aba.right);
    expect(await pagina.locator("#rodape-versao").innerText()).toMatch(/^Versão \d/);
    expect(await pagina.locator("#rodape-grupo").innerText()).toContain("—");
    expect(await pagina.locator("#rodape-cartorio").innerText()).toMatch(/^Cartório: /);
  });

  it("o chip diz o estado do servidor e abre o Início ao clicar", async () => {
    await expect(pagina.locator("#chip-texto").innerText()).resolves.toBe("Desligado");
    await item("backups").click();
    await pagina.locator("#chip-estado").click();
    expect(await atual()).toBe("inicio");
    await expect(pagina.locator("#cartao").isVisible()).resolves.toBe(true);
  });

  it("abaixo de 840 px as abas ficam só com o ícone, sem rolagem horizontal em 720x480", async () => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(720, 480));
    await pagina.waitForTimeout(200);
    for (const area of ["inicio", "backups", "grupo", "configuracoes"]) {
      const largura = await item(area)
        .locator("span")
        .evaluate((e) => e.getBoundingClientRect().width);
      expect(largura, area).toBeLessThanOrEqual(1);
      await expect(item(area).locator("svg").isVisible()).resolves.toBe(true);
    }
    const rolagem = await pagina.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(rolagem).toBeLessThanOrEqual(0);
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.setSize(1000, 700));
    await pagina.waitForTimeout(200);
    const larg = await item("backups")
      .locator("span")
      .evaluate((e) => e.getBoundingClientRect().width);
    expect(larg).toBeGreaterThan(20);
  });

  it("o conteúdo fica centralizado com no máximo 960 px e a janela tem tamanho mínimo", async () => {
    const largura = await pagina
      .locator(".conteudo")
      .evaluate((e) => e.getBoundingClientRect().width);
    expect(largura).toBeLessThanOrEqual(960);
    const min = await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0]?.getMinimumSize(),
    );
    expect(min).toEqual([720, 480]);
  });

  it("a Boas-vindas (primeira vez) fica sem barra nem rodapé", async () => {
    await pagina.evaluate(() => {
      for (const [id, escondida] of [
        ["cartao", true],
        ["tela-boas-vindas", false],
      ] as const) {
        const el = document.getElementById(id);
        if (el) el.hidden = escondida;
      }
    });
    await pagina.waitForTimeout(100);
    await expect(pagina.locator("#barra").isHidden()).resolves.toBe(true);
    await expect(pagina.locator("#rodape").isHidden()).resolves.toBe(true);
    await pagina.evaluate(() => {
      for (const [id, escondida] of [
        ["tela-boas-vindas", true],
        ["cartao", false],
      ] as const) {
        const el = document.getElementById(id);
        if (el) el.hidden = escondida;
      }
    });
    await expect(pagina.locator("#barra").isVisible()).resolves.toBe(true);
  });

  it("grava as capturas depois, nos temas claro e escuro", async () => {
    for (const [tema, nome] of [
      ["light", "claro"],
      ["dark", "escuro"],
    ] as const) {
      await app.evaluate(({ nativeTheme }, t) => {
        nativeTheme.themeSource = t;
      }, tema);
      await pagina.emulateMedia({ colorScheme: tema });
      await item("inicio").click();
      await pagina.waitForTimeout(300);
      await registrarCaptura(pagina, join(imagens, `depois-inicio-${nome}.png`));
      await item("backups").click();
      await pagina.waitForTimeout(300);
      await registrarCaptura(pagina, join(imagens, `depois-backups-${nome}.png`));
      await item("configuracoes").click();
      await pagina.waitForTimeout(300);
      await registrarCaptura(pagina, join(imagens, `depois-config-${nome}.png`));
      await item("inicio").click();
    }
  });
});
