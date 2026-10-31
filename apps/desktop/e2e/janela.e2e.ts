// Capturas em docs/imagens/ só com SABRE_CAPTURAS=1 (ex.: SABRE_CAPTURAS=1 npm run test:e2e -w apps/desktop)
import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { registrarCaptura } from "./captura.js";

const pastaApp = fileURLToPath(new URL("..", import.meta.url));
const imagens = fileURLToPath(new URL("../../../docs/imagens/", import.meta.url));
const dados = mkdtempSync(join(tmpdir(), "sabre-e2e-"));
// O contêiner roda como root e o Chromium recusa sem isto; o app em si nunca usa --no-sandbox.
const semSandbox = process.getuid?.() === 0 ? ["--no-sandbox"] : [];
const argumentos = [...semSandbox, `--user-data-dir=${dados}`, pastaApp];
const ambiente = { ...process.env, SABRE_E2E: "1" } as Record<string, string>;

let app: ElectronApplication;
let pagina: Page;

beforeAll(async () => {
  app = await electron.launch({ args: argumentos, env: ambiente, timeout: 20_000 });
  pagina = await app.firstWindow();
  await pagina.waitForLoadState("load");
});

afterAll(async () => {
  // Segurança contra processo pendurado (na triagem uma execução travou).
  await Promise.race([
    app?.evaluate(({ app: a }) => a.exit(0)).catch(() => undefined),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
  await app?.close().catch(() => undefined);
  rmSync(dados, { recursive: true, force: true });
});

describe("janela do SabreHosting", () => {
  it("abre com o nome, o ícone e o estado do servidor", async () => {
    expect(await pagina.title()).toBe("SabreHosting");
    await expect(pagina.locator("h1").innerText()).resolves.toBe("SabreHosting");
    await expect(pagina.locator("#status").innerText()).resolves.toBe("Ninguém está hospedando");
    const largura = await pagina
      .locator("img.icone")
      .evaluate((i: HTMLImageElement) => i.naturalWidth);
    expect(largura).toBeGreaterThan(0);
  });

  it("isola a tela do sistema", async () => {
    const prefs = await app.evaluate(({ BrowserWindow }) => {
      // getLastWebPreferences existe no Electron mas não está nos tipos.
      const web = BrowserWindow.getAllWindows()[0]?.webContents as unknown as
        { getLastWebPreferences(): Record<string, unknown> } | undefined;
      const p = web?.getLastWebPreferences();
      return { iso: p?.contextIsolation, nodeI: p?.nodeIntegration, sandbox: p?.sandbox };
    });
    expect(prefs).toEqual({ iso: true, nodeI: false, sandbox: true });
    expect(await pagina.evaluate(() => typeof (globalThis as { require?: unknown }).require)).toBe(
      "undefined",
    );
    expect(await pagina.evaluate(() => typeof (globalThis as { process?: unknown }).process)).toBe(
      "undefined",
    );
    expect(
      await pagina.evaluate(() =>
        Object.keys((globalThis as { sabre?: object }).sabre ?? {}).sort(),
      ),
    ).toEqual(["abrirComWindows", "backups", "configuracoes", "inicio", "versao"]);
  });

  it("mostra a versão pela ponte", async () => {
    await expect(pagina.locator("#versao").innerText()).resolves.toBe("Versão 0.0.0");
  });

  it("'Abrir com o Windows' começa desligado e aceita só sim/não", async () => {
    const sabre = () =>
      pagina.evaluate(async () => {
        const ponte = (
          globalThis as unknown as {
            sabre: {
              abrirComWindows: { ler(): Promise<boolean>; definir(v: unknown): Promise<boolean> };
            };
          }
        ).sabre;
        const inicial = await ponte.abrirComWindows.ler();
        const ligou = await ponte.abrirComWindows.definir(true);
        const lido = await ponte.abrirComWindows.ler();
        const erro = await ponte.abrirComWindows.definir("sim").then(
          () => "aceitou",
          () => "recusou",
        );
        await ponte.abrirComWindows.definir(false);
        return { inicial, ligou, lido, erro, final: await ponte.abrirComWindows.ler() };
      });
    expect(await sabre()).toEqual({
      inicial: false,
      ligou: true,
      lido: true,
      erro: "recusou",
      final: false,
    });
  });

  it("tem ícone na bandeja", async () => {
    const existe = await app.evaluate(() => {
      const e = (globalThis as { __sabreE2E?: { bandeja: { isDestroyed(): boolean } } }).__sabreE2E;
      return e ? !e.bandeja.isDestroyed() : false;
    });
    expect(existe).toBe(true);
  });

  it("bloqueia navegação para fora e janelas novas", async () => {
    await pagina.evaluate(() => {
      (globalThis as { window: Window }).window.open("https://exemplo.com");
      (globalThis as { location: Location }).location.href = "https://exemplo.com";
    });
    await pagina.waitForTimeout(500);
    expect(pagina.url().startsWith("file://")).toBe(true);
    expect(app.windows().length).toBe(1);
  });

  it("segunda abertura não cria outra janela e encerra sozinha", async () => {
    const segundo = await electron
      .launch({ args: argumentos, env: ambiente, timeout: 20_000 })
      .catch(() => null);
    // Com a trava de instância única o segundo processo sai antes de abrir janela.
    if (segundo) {
      const codigo = await Promise.race([
        new Promise<number>((r) => segundo.process().once("exit", (c) => r(c ?? 0))),
        new Promise<string>((r) => setTimeout(() => r("travado"), 8000)),
      ]);
      await segundo.close().catch(() => undefined);
      expect(codigo).not.toBe("travado");
    }
    const total = await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows().length);
    expect(total).toBe(1);
  });

  it("grava as capturas nos temas claro e escuro", async () => {
    for (const [tema, nome] of [
      ["light", "claro"],
      ["dark", "escuro"],
    ] as const) {
      await app.evaluate(({ nativeTheme }, t) => {
        nativeTheme.themeSource = t;
      }, tema);
      await pagina.emulateMedia({ colorScheme: tema });
      await pagina.waitForTimeout(300);
      await registrarCaptura(pagina, join(imagens, `app-1.1-janela-${nome}.png`));
    }
  });

  it("fechar a janela só esconde: o app continua na bandeja", async () => {
    await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0]?.close());
    const estado = await app.evaluate(({ BrowserWindow }) => {
      const j = BrowserWindow.getAllWindows()[0];
      return {
        total: BrowserWindow.getAllWindows().length,
        visivel: j?.isVisible(),
        destruida: j?.isDestroyed(),
      };
    });
    expect(estado).toEqual({ total: 1, visivel: false, destruida: false });
  });
});
