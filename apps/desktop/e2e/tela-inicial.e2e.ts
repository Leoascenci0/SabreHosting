// appmel-1.27: na janela padrão os 4 botões (Hospedar, Importar mundo, Backups, Configurações) aparecem sem rolar.
import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const pastaApp = fileURLToPath(new URL("..", import.meta.url));
const semSandbox = process.getuid?.() === 0 ? ["--no-sandbox"] : [];

let aberto: ElectronApplication | undefined;
let dados: string | undefined;

async function abrir(cenario: string): Promise<Page> {
  dados = mkdtempSync(join(tmpdir(), "sabre-e2e-"));
  aberto = await electron.launch({
    args: [...semSandbox, `--user-data-dir=${dados}`, pastaApp],
    env: { ...process.env, SABRE_E2E: "1", SABRE_E2E_CENARIO: cenario } as Record<string, string>,
    timeout: 20_000,
  });
  const pagina = await aberto.firstWindow();
  await pagina.waitForLoadState("load");
  await pagina.locator(`#cartao[data-estado="${cenario}"]`).waitFor();
  return pagina;
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

const medidas = (p: Page) =>
  p.evaluate(() => ({
    rolagem: document.documentElement.scrollHeight - window.innerHeight,
    botoes: ["principal", "importar-abrir", "ver-backups", "ver-config"].map((id) => {
      const r = document.getElementById(id)?.getBoundingClientRect();
      return r
        ? { id, altura: r.height, dentro: r.top >= 0 && r.bottom <= window.innerHeight }
        : { id, altura: 0, dentro: false };
    }),
  }));

describe("tela inicial: os 4 botões sem rolar", () => {
  for (const cenario of ["ninguem", "eu"]) {
    it(`cenário ${cenario}: sem rolagem e os 4 botões dentro da janela com ≥ 44 px`, async () => {
      const p = await abrir(cenario);
      const m = await medidas(p);
      expect(m.rolagem).toBeLessThanOrEqual(0);
      for (const b of m.botoes) {
        expect(b.dentro, `${b.id} dentro da janela`).toBe(true);
        expect(b.altura, `${b.id} altura`).toBeGreaterThanOrEqual(44);
      }
    });
  }

  it("Importar mundo abre o passo a passo em tela própria (appui-1.6), sem painel no Início", async () => {
    const p = await abrir("ninguem");
    await p.locator("#importar-abrir").click();
    await p.locator("#tela-importar:not([hidden])").waitFor();
    expect(await p.locator("#cartao").isVisible()).toBe(false);
    expect(await p.locator("#importar-passo").innerText()).toBe("Passo 1 de 3");
  });
});
