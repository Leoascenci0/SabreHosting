// appui-1.7: Boas-vindas (3 passos) também cabem de 720 a 1600 px, com um título por passo e sem termo técnico.
import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const pastaApp = fileURLToPath(new URL("..", import.meta.url));
const dados = mkdtempSync(join(tmpdir(), "sabre-e2e-"));
const semSandbox = process.getuid?.() === 0 ? ["--no-sandbox"] : [];

let app: ElectronApplication;
let pagina: Page;

beforeAll(async () => {
  app = await electron.launch({
    args: [...semSandbox, `--user-data-dir=${dados}`, pastaApp],
    env: {
      ...process.env,
      SABRE_E2E: "1",
      SABRE_E2E_CENARIO: "ninguem",
      SABRE_E2E_BOAS_VINDAS: "1",
    } as Record<string, string>,
    timeout: 20_000,
  });
  pagina = await app.firstWindow();
  await pagina.waitForLoadState("load");
  await pagina.locator("#tela-boas-vindas:not([hidden])").waitFor();
});

afterAll(async () => {
  await Promise.race([
    app?.evaluate(({ app: a }) => a.exit(0)).catch(() => undefined),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
  await app?.close().catch(() => undefined);
  rmSync(dados, { recursive: true, force: true });
});

// Os passos 2 e 3 só se alcançam com convite gasto (cartório): aqui mostramos cada passo pelo DOM,
// que é o que a janela desenha; o fluxo real dos passos é coberto em boas-vindas.e2e.ts.
const PASSOS = ["convite", "eula", "pasta"] as const;
async function mostrarPasso(passo: (typeof PASSOS)[number]): Promise<void> {
  await pagina.evaluate((p) => {
    const ids = { convite: "bv-convite", eula: "bv-eula", pasta: "bv-pasta" } as const;
    for (const [nome, id] of Object.entries(ids)) {
      const el = document.getElementById(id);
      if (el) el.hidden = nome !== p;
    }
  }, passo);
}

describe("Boas-vindas: acabamento", () => {
  it.each([720, 1024, 1600])("os 3 passos cabem em %i px", async (largura) => {
    await app.evaluate(({ BrowserWindow }, l) => {
      BrowserWindow.getAllWindows()[0]?.setContentSize(l, 720);
    }, largura);
    await pagina.waitForTimeout(150);
    for (const passo of PASSOS) {
      await mostrarPasso(passo);
      const r = await pagina.evaluate(() => ({
        rolagem: document.documentElement.scrollWidth > document.documentElement.clientWidth,
        cortados: [
          ...document.querySelectorAll("#tela-boas-vindas button, #tela-boas-vindas input"),
        ].filter((e) => {
          const b = e.getBoundingClientRect();
          return b.width > 0 && (b.right > window.innerWidth + 1 || b.left < -1);
        }).length,
      }));
      expect(r, `${passo} em ${largura}px`).toEqual({ rolagem: false, cortados: 0 });
    }
  });

  it("tem um título e nenhum termo técnico no texto", async () => {
    const termos = /\b(hash|token|IPC|jar|SHA-?\d*|JSON|WireGuard|Velocity|cartório)\b/i;
    await mostrarPasso("convite");
    await expect(pagina.locator("#titulo-bv").isVisible()).resolves.toBe(true);
    await expect(pagina.locator("#tela-boas-vindas h2:visible").count()).resolves.toBe(1);
    const texto = await pagina.locator("#tela-boas-vindas").innerText();
    expect(texto).not.toMatch(termos);
  });
});
