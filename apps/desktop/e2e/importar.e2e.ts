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

/** `extra`: SABRE_E2E_VERSAO_GRUPO (grupo já tem mundo) e SABRE_E2E_DONO (este PC é o dono). */
async function abrir(extra: Record<string, string> = {}): Promise<Page> {
  dados = mkdtempSync(join(tmpdir(), "sabre-e2e-"));
  aberto = await electron.launch({
    args: [...semSandbox, `--user-data-dir=${dados}`, pastaApp],
    env: {
      ...process.env,
      SABRE_E2E: "1",
      SABRE_E2E_CENARIO: "ninguem",
      ...extra,
    } as Record<string, string>,
    timeout: 20_000,
  });
  const pagina = await aberto.firstWindow();
  await pagina.waitForLoadState("load");
  await pagina.locator("#cartao:not([data-estado=carregando])").waitFor();
  await pagina.locator("#ver-backups").click();
  await pagina.locator("#importar-abrir").click();
  await pagina.locator("#importar-painel").waitFor();
  return pagina;
}

const chamadas = async () =>
  (await aberto?.evaluate(
    () =>
      (globalThis as { __sabreE2EImportar?: { chamadas: unknown[] } }).__sabreE2EImportar?.chamadas,
  )) as Array<{ zip: string; aceitar: boolean }>;

afterEach(async () => {
  await Promise.race([
    aberto?.evaluate(({ app: a }) => a.exit(0)).catch(() => undefined),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
  await aberto?.close().catch(() => undefined);
  aberto = undefined;
  if (dados) rmSync(dados, { recursive: true, force: true });
});

describe("tela Backups › Importar mundo", () => {
  it("grupo sem mundo: mostra versão e aviso de plugins; confirmar importa como versão 1", async () => {
    const pagina = await abrir();
    await expect(pagina.locator("#importar-info").innerText()).resolves.toContain(
      "Minecraft 1.21.1",
    );
    await expect(pagina.locator("#importar-avisos").innerText()).resolves.toContain("plugins");
    await expect(pagina.locator("#importar-explica").innerText()).resolves.toContain("não muda");
    await pagina.locator("#importar-confirmar").click();
    await expect
      .poll(() => pagina.locator("#importar-status").innerText())
      .toContain("virou a versão 1 do grupo");
    expect(await chamadas()).toEqual([
      { zip: expect.stringContaining("mundo-da-hospedagem.zip"), aceitar: false },
    ]);
  });

  it("grupo com mundo e PC comum: não há botão de importar; cancelar não importa nada", async () => {
    const pagina = await abrir({ SABRE_E2E_VERSAO_GRUPO: "4" });
    await expect(pagina.locator("#importar-explica").innerText()).resolves.toContain(
      "Só o dono do grupo",
    );
    await expect(pagina.locator("#importar-confirmar").isVisible()).resolves.toBe(false);
    await pagina.locator("#importar-cancelar").click();
    await expect(pagina.locator("#importar-painel").isVisible()).resolves.toBe(false);
    expect(await chamadas()).toEqual([]);
  });

  it("grupo com mundo e dono: confirmação forte e vira a versão 5", async () => {
    const pagina = await abrir({ SABRE_E2E_VERSAO_GRUPO: "4", SABRE_E2E_DONO: "1" });
    await expect(pagina.locator("#importar-explica").innerText()).resolves.toContain(
      "Isto vira a versão mais nova do grupo; o mundo atual continua guardado nos backups.",
    );
    await pagina.locator("#importar-confirmar").click();
    await expect
      .poll(() => pagina.locator("#importar-status").innerText())
      .toContain("virou a versão 5 do grupo");
    expect((await chamadas())[0]?.aceitar).toBe(true);
  });
});
