import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { gerarChavesDoPc } from "@sabrehosting/nucleo/rede/wireguard";

const pastaApp = fileURLToPath(new URL("..", import.meta.url));
const semSandbox = process.getuid?.() === 0 ? ["--no-sandbox"] : [];

let aberto: ElectronApplication | undefined;
let dados: string | undefined;

const prov = gerarChavesDoPc();
const hub = gerarChavesDoPc();
function convite(extra: Record<string, unknown> = {}): string {
  const json = {
    g: "Amigos do E2E",
    h: "nuvem.exemplo.org:51820",
    k: hub.publica,
    i: "10.66.0.201",
    p: prov.privada,
    c: "codigo-do-convite",
    a: 7710,
    e: Math.floor(Date.now() / 1000) + 3600,
    ...extra,
  };
  return `sabre://convite/1.${Buffer.from(JSON.stringify(json)).toString("base64url")}`;
}

async function abrir(extra: Record<string, string> = {}): Promise<Page> {
  dados = mkdtempSync(join(tmpdir(), "sabre-e2e-"));
  aberto = await electron.launch({
    args: [...semSandbox, `--user-data-dir=${dados}`, pastaApp],
    env: {
      ...process.env,
      SABRE_E2E: "1",
      SABRE_E2E_CENARIO: "ninguem",
      SABRE_E2E_BOAS_VINDAS: "1",
      ...extra,
    } as Record<string, string>,
    timeout: 20_000,
  });
  const pagina = await aberto.firstWindow();
  await pagina.waitForLoadState("load");
  await pagina.locator("#tela-boas-vindas:not([hidden])").waitFor();
  return pagina;
}

const registro = async () =>
  (await aberto?.evaluate(
    () => (globalThis as { __sabreE2EBoasVindas?: unknown }).__sabreE2EBoasVindas,
  )) as { entradas: string[]; tokens: string[] };

afterEach(async () => {
  await Promise.race([
    aberto?.evaluate(({ app: a }) => a.exit(0)).catch(() => undefined),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
  await aberto?.close().catch(() => undefined);
  aberto = undefined;
  if (dados) rmSync(dados, { recursive: true, force: true });
});

async function conferir(pagina: Page, texto: string): Promise<void> {
  await pagina.locator("#bv-texto").fill(texto);
  await pagina.locator("#bv-conferir").click();
}

describe("assistente de primeira vez", () => {
  it("a dica do convite não usa termo técnico", async () => {
    const pagina = await abrir();
    const dica = await pagina.locator("#bv-convite .dica").first().innerText();
    expect(dica).toContain("administrador do grupo");
    expect(dica).not.toContain("sabre://");
  });

  it("convite torto e convite vencido: mensagem clara e nada muda", async () => {
    const pagina = await abrir();
    await conferir(pagina, "isto não é um convite");
    await expect(pagina.locator("#bv-erro").innerText()).resolves.toContain("não está certo");
    await conferir(pagina, convite({ e: Math.floor(Date.now() / 1000) - 5 }));
    await expect(pagina.locator("#bv-erro").innerText()).resolves.toContain("venceu");
    await expect(pagina.locator("#bv-entrar-caixa").isHidden()).resolves.toBe(true);
    expect((await registro()).entradas).toEqual([]);
  });

  it("convite já usado: o cartório recusa e o token não é guardado", async () => {
    const pagina = await abrir();
    await conferir(pagina, convite({ c: "usado" }));
    await pagina.locator("#bv-entrar").click();
    await expect.poll(() => pagina.locator("#bv-erro").innerText()).toContain("já foi usado");
    expect((await registro()).tokens).toEqual([]);
  });

  it("sem cofre seguro: explica e não gasta o convite", async () => {
    const pagina = await abrir({ SABRE_E2E_SEM_COFRE: "1" });
    await conferir(pagina, convite());
    await pagina.locator("#bv-entrar").click();
    await expect.poll(() => pagina.locator("#bv-erro").innerText()).toContain("cofre");
    const r = await registro();
    expect(r.entradas).toEqual([]);
    expect(r.tokens).toEqual([]);
  });

  it("cofre corrompido: explica que o acesso guardado não abre e pede convite novo", async () => {
    const pagina = await abrir({ SABRE_E2E_COFRE_CORROMPIDO: "1" });
    await expect(pagina.locator("#bv-erro").innerText()).resolves.toContain(
      "Seu acesso guardado neste PC não abre mais; peça um convite novo.",
    );
    await expect(pagina.locator("#bv-texto").isVisible()).resolves.toBe(true);
    expect((await registro()).tokens).toEqual([]);
  });

  it("caminho feliz: convite → EULA (sem aceite não avança) → pasta; depois não abre mais", async () => {
    const pagina = await abrir();
    await conferir(pagina, convite());
    await expect(pagina.locator("#bv-entrar-pergunta").innerText()).resolves.toContain(
      "Amigos do E2E",
    );
    await pagina.locator("#bv-entrar").click();
    await pagina.locator("#bv-eula:not([hidden])").waitFor();
    await expect(pagina.locator("#bv-texto").inputValue()).resolves.toBe("");
    await expect(pagina.locator("#bv-eula-continuar").isDisabled()).resolves.toBe(true);
    await expect(pagina.locator("#bv-pasta").isHidden()).resolves.toBe(true);
    await pagina.locator("#bv-eula-abrir").click();
    await expect
      .poll(() =>
        aberto?.evaluate(
          () => (globalThis as { __sabreE2EEulaAberto?: number }).__sabreE2EEulaAberto,
        ),
      )
      .toBe(1);
    await pagina.locator("#bv-eula-aceito").check();
    await pagina.locator("#bv-eula-continuar").click();
    await pagina.locator("#bv-pasta:not([hidden])").waitFor();
    await pagina.locator("#bv-pasta-escolher").click();
    const escolhida = join(dados ?? "", "escolhida");
    await expect.poll(() => pagina.locator("#bv-pasta-caminho").inputValue()).toBe(escolhida);
    await pagina.locator("#bv-concluir").click();
    await pagina.locator("#cartao").waitFor();
    expect((await registro()).tokens).toEqual(["token-falso-do-e2e"]);
    expect(readFileSync(join(escolhida, "servidor", "eula.txt"), "utf8")).toContain("eula=true");
    expect(existsSync(join(escolhida, "mundos"))).toBe(true);
    expect(await pagina.locator("#tela-boas-vindas").isHidden()).toBe(true);
  });
});
