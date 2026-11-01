// appui-1.6: Importar mundo em passo a passo (escolher → conferir → confirmar). Capturas em docs/imagens/appui-1.6 só com SABRE_CAPTURAS=1.
import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { registrarCaptura } from "./captura.js";

const pastaApp = fileURLToPath(new URL("..", import.meta.url));
const semSandbox = process.getuid?.() === 0 ? ["--no-sandbox"] : [];

let aberto: ElectronApplication | undefined;
let dados: string | undefined;

const CAPTURAS = join(pastaApp, "..", "..", "docs", "imagens", "appui-1.6");

/** `extra`: SABRE_E2E_VERSAO_GRUPO (grupo já tem mundo) e SABRE_E2E_DONO (este PC é o dono). Abre no passo 1. */
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
  await pagina.locator("#importar-abrir").click();
  await pagina.locator("#tela-importar:not([hidden])").waitFor();
  return pagina;
}

/** Passo 1 → 2: aperta "Escolher arquivo" (o main devolve o .zip de teste). */
async function escolher(pagina: Page): Promise<void> {
  await pagina.locator("#importar-escolher").click();
  await pagina.locator("#importar-passo-2:not([hidden])").waitFor();
}

const passoDito = (pagina: Page) => pagina.locator("#importar-passo").innerText();
const focoEm = (pagina: Page) => pagina.evaluate(() => document.activeElement?.id);

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

describe("Início › Importar mundo (passo a passo)", () => {
  it("abre em tela própria, no passo 1, com título focado; o Início não mostra mais painel de importar", async () => {
    const pagina = await abrir();
    await expect(pagina.locator("#cartao").isHidden()).resolves.toBe(true);
    await expect(passoDito(pagina)).resolves.toBe("Passo 1 de 3");
    await expect(pagina.locator("#importar-titulo").innerText()).resolves.toContain("arquivo");
    expect(await focoEm(pagina)).toBe("importar-titulo");
    await expect(pagina.locator("#importar-passo-2").isHidden()).resolves.toBe(true);
    await expect(pagina.locator("#importar-passo-3").isHidden()).resolves.toBe(true);
    await registrarCaptura(pagina, join(CAPTURAS, "importar-1-escolher.png"));
  });

  it("grupo sem mundo: conferir mostra versão e aviso de plugins; confirmar importa como versão 1", async () => {
    const pagina = await abrir();
    await escolher(pagina);
    await expect(passoDito(pagina)).resolves.toBe("Passo 2 de 3");
    expect(await focoEm(pagina)).toBe("importar-titulo");
    await expect(pagina.locator("#importar-info").innerText()).resolves.toContain(
      "Minecraft 1.21.1",
    );
    await expect(pagina.locator("#importar-avisos").innerText()).resolves.toContain("plugins");
    await registrarCaptura(pagina, join(CAPTURAS, "importar-2-conferir.png"));
    await pagina.locator("#importar-continuar").click();
    await pagina.locator("#importar-passo-3:not([hidden])").waitFor();
    await expect(passoDito(pagina)).resolves.toBe("Passo 3 de 3");
    await expect(pagina.locator("#importar-explica").innerText()).resolves.toContain("não muda");
    await registrarCaptura(pagina, join(CAPTURAS, "importar-3-confirmar.png"));
    expect(await chamadas()).toEqual([]); // até confirmar, nada foi importado
    await pagina.locator("#importar-confirmar").click();
    await expect
      .poll(() => pagina.locator("#importar-status").innerText())
      .toContain("virou a versão 1 do grupo");
    expect(await chamadas()).toEqual([
      { zip: expect.stringContaining("mundo-da-hospedagem.zip"), aceitar: false },
    ]);
    await registrarCaptura(pagina, join(CAPTURAS, "importar-4-pronto.png"));
    await pagina.locator("#importar-voltar").click();
    await expect(pagina.locator("#cartao").isVisible()).resolves.toBe(true);
  });

  it("grupo com mundo e PC comum: o passo 2 explica e não deixa continuar; nada é importado", async () => {
    const pagina = await abrir({ SABRE_E2E_VERSAO_GRUPO: "4" });
    await escolher(pagina);
    await expect(pagina.locator("#importar-bloqueio").innerText()).resolves.toContain(
      "Só o dono do grupo",
    );
    await expect(pagina.locator("#importar-continuar").isHidden()).resolves.toBe(true);
    await pagina.locator("#importar-voltar").click();
    await expect(pagina.locator("#tela-importar").isHidden()).resolves.toBe(true);
    expect(await chamadas()).toEqual([]);
  });

  it("grupo com mundo e dono: confirmação forte no passo 3 e vira a versão 5", async () => {
    const pagina = await abrir({ SABRE_E2E_VERSAO_GRUPO: "4", SABRE_E2E_DONO: "1" });
    await escolher(pagina);
    await pagina.locator("#importar-continuar").click();
    await expect(pagina.locator("#importar-explica").innerText()).resolves.toContain(
      "Isto vira a versão mais nova do grupo; o mundo atual continua guardado nos backups.",
    );
    await pagina.locator("#importar-confirmar").click();
    await expect
      .poll(() => pagina.locator("#importar-status").innerText())
      .toContain("virou a versão 5 do grupo");
    expect((await chamadas())[0]?.aceitar).toBe(true);
  });

  it("voltar de um passo para o anterior não importa nada, e a barra lateral sai do fluxo", async () => {
    const pagina = await abrir();
    await escolher(pagina);
    await pagina.locator("#importar-continuar").click();
    await pagina.locator("#importar-anterior").click();
    await expect(passoDito(pagina)).resolves.toBe("Passo 2 de 3");
    await pagina.locator("#importar-trocar").click(); // "Escolher outro arquivo": volta ao passo 1
    await expect(passoDito(pagina)).resolves.toBe("Passo 1 de 3");
    await pagina.locator('[data-area="backups"]').click();
    await pagina.locator("#tela-backups:not([hidden])").waitFor();
    await expect(pagina.locator("#tela-importar").isHidden()).resolves.toBe(true);
    expect(await chamadas()).toEqual([]);
  });
});
