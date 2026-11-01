// appui-1.7: acabamento. Janela de 720 a 1600 px sem quebrar, um título por tela, foco visível, texto sem termo técnico.
// Capturas em docs/imagens/appui-1.7 só com SABRE_CAPTURAS=1.
import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registrarCaptura } from "./captura.js";

const pastaApp = fileURLToPath(new URL("..", import.meta.url));
const imagens = fileURLToPath(new URL("../../../docs/imagens/appui-1.7/", import.meta.url));
const dados = mkdtempSync(join(tmpdir(), "sabre-e2e-"));
const semSandbox = process.getuid?.() === 0 ? ["--no-sandbox"] : [];

let app: ElectronApplication;
let pagina: Page;

const item = (area: string) => pagina.locator(`[data-area="${area}"]`);

beforeAll(async () => {
  app = await electron.launch({
    args: [...semSandbox, `--user-data-dir=${dados}`, pastaApp],
    env: { ...process.env, SABRE_E2E: "1", SABRE_E2E_DONO: "1" } as Record<string, string>,
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

async function redimensionar(largura: number): Promise<void> {
  await app.evaluate(({ BrowserWindow }, l) => {
    const j = BrowserWindow.getAllWindows()[0];
    j?.setContentSize(l, 720);
  }, largura);
  await pagina.waitForTimeout(150);
}

const semRolagemHorizontal = () =>
  pagina.evaluate(
    () => document.documentElement.scrollWidth <= document.documentElement.clientWidth,
  );

describe("acabamento", () => {
  it.each([720, 1024, 1600])("sem rolagem horizontal nem corte em %i px", async (largura) => {
    await redimensionar(largura);
    for (const area of ["inicio", "backups", "grupo", "configuracoes"]) {
      await item(area).click();
      await pagina.waitForTimeout(100);
      expect(await semRolagemHorizontal(), `${area} em ${largura}px`).toBe(true);
      const corte = await pagina.evaluate(() => {
        const tela = [...document.querySelectorAll("main")].find((m) => !(m as HTMLElement).hidden);
        if (!tela) return -1;
        return [...tela.querySelectorAll("button, input, select")].filter((e) => {
          const r = e.getBoundingClientRect();
          return r.width > 0 && (r.right > window.innerWidth + 1 || r.left < -1);
        }).length;
      });
      expect(corte, `controles cortados em ${area} a ${largura}px`).toBe(0);
    }
  });

  it("cada tela tem um título visível, e a barra marca a tela atual", async () => {
    for (const area of ["inicio", "backups", "grupo", "configuracoes"]) {
      await item(area).click();
      await pagina.waitForTimeout(100);
      const titulos = await pagina.evaluate(
        () =>
          [...document.querySelectorAll("main h1, main h2")].filter(
            (h) => (h as HTMLElement).offsetParent !== null && !h.closest("[hidden]"),
          ).length,
      );
      expect(titulos, `títulos visíveis em ${area}`).toBeGreaterThanOrEqual(1);
      await expect(item(area).getAttribute("aria-current")).resolves.toBe("page");
    }
  });

  it("o foco por teclado é visível nos controles da barra e dos botões", async () => {
    await item("inicio").click();
    await item("inicio").focus();
    for (const seletor of ['[data-area="backups"]', "button.principal"]) {
      const alvo = pagina.locator(seletor).first();
      if (!(await alvo.isVisible())) continue;
      await alvo.focus();
      await pagina.keyboard.press("Tab");
      await alvo.focus();
      const contorno = await alvo.evaluate((e) => {
        const c = getComputedStyle(e);
        return { estilo: c.outlineStyle, largura: parseFloat(c.outlineWidth) };
      });
      expect(contorno.estilo, seletor).not.toBe("none");
      expect(contorno.largura, seletor).toBeGreaterThan(0);
    }
  });

  it("os textos das telas não têm termo técnico", async () => {
    const termos = /\b(hash|token|IPC|jar|SHA-?\d*|JSON|WireGuard|Velocity|cartório)\b/i;
    for (const area of ["inicio", "backups", "grupo", "configuracoes"]) {
      await item(area).click();
      await pagina.waitForTimeout(100);
      const texto = await pagina.evaluate(() => {
        const tela = [...document.querySelectorAll("main")].find((m) => !(m as HTMLElement).hidden);
        return (tela as HTMLElement | undefined)?.innerText ?? "";
      });
      expect(texto, `termo técnico em ${area}`).not.toMatch(termos);
    }
  });

  it("grava as capturas nos temas claro e escuro, em 1024 e 720 px", async () => {
    await redimensionar(1024);
    for (const [tema, nome] of [
      ["light", "claro"],
      ["dark", "escuro"],
    ] as const) {
      await app.evaluate(({ nativeTheme }, t) => {
        nativeTheme.themeSource = t;
      }, tema);
      await pagina.emulateMedia({ colorScheme: tema });
      for (const area of ["inicio", "backups", "grupo", "configuracoes"]) {
        await item(area).click();
        await pagina.waitForTimeout(300);
        await registrarCaptura(pagina, join(imagens, `${area}-${nome}.png`));
      }
    }
    await redimensionar(720);
    await item("inicio").click();
    await pagina.waitForTimeout(300);
    await registrarCaptura(pagina, join(imagens, "inicio-720-escuro.png"));
    await app.evaluate(({ nativeTheme }) => {
      nativeTheme.themeSource = "light";
    });
    await pagina.emulateMedia({ colorScheme: "light" });
    await redimensionar(1024);
  });
});
