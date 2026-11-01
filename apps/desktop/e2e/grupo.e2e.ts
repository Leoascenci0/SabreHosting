// appui-1.4a: Grupo em tela própria (barra lateral › Grupo). Capturas em docs/imagens/appui-1.4 só com SABRE_CAPTURAS=1.
import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
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

/** Abre o app e chega ao Grupo pelo item da barra lateral; espera o estado do grupo chegar. */
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
  await pagina.locator("#tela-grupo:not([hidden])").waitFor();
  await pagina.locator('#tela-grupo[aria-busy="false"]').waitFor();
  return pagina;
}

const esperarTexto = (p: Page, seletor: string, trecho: string): Promise<unknown> =>
  p.waitForFunction(
    ([s, t]) => document.querySelector(s as string)?.textContent?.includes(t as string),
    [seletor, trecho],
  );

const revogados = (): Promise<number[]> =>
  aberto?.evaluate(
    () =>
      (globalThis as unknown as { __sabreE2EGrupo: { revogados: number[] } }).__sabreE2EGrupo
        .revogados,
  ) as Promise<number[]>;

afterEach(async () => {
  await Promise.race([
    aberto?.evaluate(({ app: a }) => a.exit(0)).catch(() => undefined),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
  await aberto?.close().catch(() => undefined);
  aberto = undefined;
  if (dados) rmSync(dados, { recursive: true, force: true });
});

describe("tela Grupo", () => {
  it("amigo (não-dono): não vê a lista, o botão nem o convite; só o aviso e o link dos Mods", async () => {
    const p = await abrir(false);
    expect(await p.locator("#grupo-area").isHidden()).toBe(true);
    expect(await p.locator("#grupo-lista button").count()).toBe(0);
    expect(await p.locator("#convite-criar").isVisible()).toBe(false);
    expect(await p.locator("#grupo-so-dono").isVisible()).toBe(true);
    expect(await p.locator("#ver-mods").isVisible()).toBe(true);
  });

  it("dono vê os PCs; o dono não tem botão; cancelar não revoga; confirmar revoga", async () => {
    const p = await abrir(true);
    await p.locator("#grupo-lista li").first().waitFor();
    expect(await p.locator("#grupo-lista li").count()).toBe(3);
    expect(await p.locator("#grupo-lista button").count()).toBe(2); // sem botão no dono
    expect(await p.locator("#grupo-lista button").first().textContent()).toBe("Tirar do grupo");
    await registrarCaptura(p, join(imagens, "depois-grupo-claro.png"));

    // Cancelar: a pergunta cita o NOME do PC e nada é revogado.
    await p
      .locator("#grupo-lista li", { hasText: "Lucas" })
      .getByRole("button", { name: "Tirar do grupo" })
      .click();
    await esperarTexto(p, "#grupo-pergunta", "PC do Lucas");
    expect(await p.locator("#grupo-confirmacao").textContent()).toContain("novo convite");
    await p.locator("#grupo-cancelar").click();
    expect(await p.locator("#grupo-confirmacao").isHidden()).toBe(true);
    expect(await revogados()).toEqual([]);
    expect(await p.locator("#grupo-lista li").count()).toBe(3);

    // Confirmar: chama revogarPc só desse PC e a lista perde o PC.
    await p
      .locator("#grupo-lista li", { hasText: "Lucas" })
      .getByRole("button", { name: "Tirar do grupo" })
      .click();
    await p.locator("#grupo-confirmar").click();
    await esperarTexto(p, "#grupo-aviso", "PC do Lucas saiu do grupo");
    expect(await revogados()).toEqual([2]);
    expect(await p.locator("#grupo-lista li").count()).toBe(2);
    // O foco não se perde: vai ao aviso.
    expect(await p.evaluate(() => document.activeElement?.id)).toBe("grupo-aviso");
  });

  it("convite: dono cria com nome e validade, vê o prazo e copia; nada fica em disco", async () => {
    const p = await abrir(true);
    await p.locator("#grupo-lista li").first().waitFor();
    expect(await p.locator("#convite-resultado").isHidden()).toBe(true);

    await p.locator("#convite-criar").click(); // sem nome: não chama o cartório
    await esperarTexto(p, "#convite-erro", "Digite o nome");
    await p.locator("#convite-nome").fill("PC do João");
    await esperarTexto(p, "#convite-nome-ficou", "pc-do-joao");
    await p.locator("#convite-validade").selectOption("24");
    await p.locator("#convite-criar").click();
    await p.locator("#convite-resultado:not([hidden])").waitFor();
    const texto = await p.locator("#convite-texto").inputValue();
    expect(texto).toBe("sabre://convite/1.FALSO-pc-do-joao");
    expect(await p.locator("#convite-prazo").textContent()).toContain("Vale até");
    expect(
      await aberto?.evaluate(
        () =>
          (globalThis as unknown as { __sabreE2EGrupo: { convites: unknown[] } }).__sabreE2EGrupo
            .convites,
      ),
    ).toEqual([{ nomePc: "pc-do-joao", horas: 24 }]);

    await p.locator("#convite-copiar").click();
    await esperarTexto(p, "#convite-copiar", "Copiado");
    // Região de status: é ela que o leitor de tela anuncia (o rótulo do botão sozinho não é).
    expect(await p.locator("#convite-copiado").getAttribute("role")).toBe("status");
    await esperarTexto(p, "#convite-copiado", "Convite copiado");
    expect(await aberto?.evaluate(({ clipboard }) => clipboard.readText())).toBe(texto);

    // Segunda cópia seguida: a região tem que mudar de novo (limpa e reescrita) para o leitor de tela anunciar.
    await p.evaluate(() => {
      const w = globalThis as unknown as { __mudancasConvite: number };
      w.__mudancasConvite = 0;
      new MutationObserver((registros) => {
        w.__mudancasConvite += registros.length;
      }).observe(document.querySelector("#convite-copiado") as Node, {
        childList: true,
        characterData: true,
        subtree: true,
      });
    });
    await p.locator("#convite-copiar").click();
    await p.waitForTimeout(500);
    const mudancas = await p.evaluate(
      () => (globalThis as unknown as { __mudancasConvite: number }).__mudancasConvite,
    );
    expect(mudancas).toBeGreaterThanOrEqual(2);
    await esperarTexto(p, "#convite-copiado", "Convite copiado");

    // Sair para o Início e voltar: o texto some da tela, e nada do convite foi gravado em disco.
    await p.locator('[data-area="inicio"]').click();
    await p.locator('[data-area="grupo"]').click();
    await p.locator('#tela-grupo[aria-busy="false"]').waitFor();
    await p.locator("#grupo-lista li").first().waitFor();
    expect(await p.locator("#convite-resultado").isHidden()).toBe(true);
    expect(await p.locator("#convite-texto").inputValue()).toBe("");
    const gravados = readdirSync(dados ?? "", { recursive: true, withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => readFileSync(join(e.parentPath, e.name)).toString("latin1"));
    expect(
      gravados.some((c) => c.includes("sabre://convite") || c.includes("FALSO-pc-do-joao")),
    ).toBe(false);
  });

  it("tema escuro e janela mínima: a tela do dono cabe sem rolar de lado", async () => {
    const p = await abrir(true);
    await p.locator("#grupo-lista li").first().waitFor();
    await aberto?.evaluate(({ nativeTheme }) => void (nativeTheme.themeSource = "dark"));
    await p.emulateMedia({ colorScheme: "dark" });
    await registrarCaptura(p, join(imagens, "depois-grupo-escuro.png"));
    const [largura, janela] = await p.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(largura).toBeLessThanOrEqual(janela ?? 0);
  });
});
