import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { mkdirSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const pastaApp = fileURLToPath(new URL("..", import.meta.url));
const imagens = fileURLToPath(new URL("../../../docs/imagens/", import.meta.url));
const semSandbox = process.getuid?.() === 0 ? ["--no-sandbox"] : [];

interface Espiao {
  spawns: { cmd: string; args: string[] }[];
}

let aberto: ElectronApplication | undefined;
let dados: string | undefined;

function viva(): ElectronApplication {
  if (!aberto) throw new Error("app não aberto");
  return aberto;
}

async function abrir(cenario: string): Promise<Page> {
  dados = mkdtempSync(join(tmpdir(), "sabre-e2e-"));
  aberto = await electron.launch({
    args: [...semSandbox, `--user-data-dir=${dados}`, pastaApp],
    env: { ...process.env, SABRE_E2E: "1", SABRE_E2E_CENARIO: cenario } as Record<string, string>,
    timeout: 20_000,
  });
  const pagina = await viva().firstWindow();
  await pagina.waitForLoadState("load");
  await pagina.locator(`#cartao[data-estado="${cenario}"]`).waitFor();
  return pagina;
}

const espiao = (): Promise<Espiao> =>
  viva().evaluate(() => (globalThis as { __sabreE2EEspiao?: unknown }).__sabreE2EEspiao as Espiao);

async function capturar(pagina: Page, nome: string): Promise<void> {
  mkdirSync(imagens, { recursive: true });
  await viva().evaluate(({ nativeTheme }) => void (nativeTheme.themeSource = "light"));
  await pagina.emulateMedia({ colorScheme: "light" });
  await pagina.waitForTimeout(200);
  await pagina.screenshot({ path: join(imagens, `app-1.2-${nome}.png`) });
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

const visiveis = (p: Page) =>
  p.evaluate(() =>
    [...document.querySelectorAll<HTMLButtonElement>(".acoes button")]
      .filter((b) => !b.hidden && !b.closest("[hidden]"))
      .map((b) => b.textContent),
  );

describe("tela inicial", () => {
  it("sem conexão com o grupo: motivo e 'Tentar de novo', sem Hospedar", async () => {
    const p = await abrir("sem-cartorio");
    await expect(p.locator("#status").innerText()).resolves.toBe("Sem conexão com o grupo");
    await expect(p.locator("#detalhe").innerText()).resolves.toBe(
      "Este PC ainda não entrou no grupo.",
    );
    expect(await visiveis(p)).toEqual(["Tentar de novo"]);
    await p.locator("#tentar").click();
    await p.locator('#cartao[data-estado="sem-cartorio"]').waitFor();
    await capturar(p, "sem-cartorio");
    expect((await espiao()).spawns).toEqual([]);
  });

  it("ninguém hospedando: Hospedar sobe o servidor pelo caminho normal e mostra progresso", async () => {
    const p = await abrir("ninguem");
    await expect(p.locator("#status").innerText()).resolves.toBe("Ninguém está hospedando");
    expect(await visiveis(p)).toEqual(["Hospedar"]);
    expect((await espiao()).spawns).toEqual([]);
    await capturar(p, "ninguem");

    await p.locator("#principal").click();
    // Enquanto sobe: texto de progresso e botão travado.
    await expect(p.locator("#principal").innerText()).resolves.toBe("Subindo o servidor…");
    await expect(p.locator("#principal").isDisabled()).resolves.toBe(true);
    await p.locator('#cartao[data-estado="eu"]').waitFor();
    await expect(p.locator("#status").innerText()).resolves.toBe("Você está hospedando");

    const e = await espiao();
    expect(e.spawns).toHaveLength(1);
    expect(e.spawns[0]?.args.at(-1)).toBe("nogui");
  });

  it("outro PC hospeda: nome, Jogar copia o endereço e nada sobe", async () => {
    const p = await abrir("outro");
    await expect(p.locator("#status").innerText()).resolves.toBe("Servidor no PC do Lucas");
    expect(await visiveis(p)).toEqual(["Jogar"]);
    await p.locator("#principal").click();
    await expect(p.locator("#detalhe").innerText()).resolves.toContain("Endereço copiado");
    const copias = await viva().evaluate(
      () => (globalThis as { __sabreE2EInicio?: { copias: string[] } }).__sabreE2EInicio?.copias,
    );
    expect(copias).toEqual(["10.0.0.5:25565"]);
    expect((await espiao()).spawns).toEqual([]);
    await capturar(p, "outro");
  });

  it("eu hospedo: Jogar e Parar; Parar pede confirmação e devolve a vez", async () => {
    const p = await abrir("eu");
    await expect(p.locator("#status").innerText()).resolves.toBe("Você está hospedando");
    expect(await visiveis(p)).toEqual(["Jogar", "Parar o servidor"]);
    await capturar(p, "eu");

    await p.locator("#parar").click();
    await expect(p.locator("#pergunta").innerText()).resolves.toBe(
      "Os amigos conectados vão cair. Parar o servidor?",
    );
    await p.locator("#cancelar-parar").click();
    await expect(p.locator("#status").innerText()).resolves.toBe("Você está hospedando");

    await p.locator("#parar").click();
    await p.locator("#confirmar-parar").click();
    await p.locator('#cartao[data-estado="ninguem"]').waitFor();
    expect((await espiao()).spawns).toHaveLength(1);
  });
});
