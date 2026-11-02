// appuimel-2.6: seções recolhíveis em Grupo, Mods e Configurações; lembradas por tela neste PC.
import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { registrarCaptura } from "./captura.js";
import { afterEach, describe, expect, it } from "vitest";

const pastaApp = fileURLToPath(new URL("..", import.meta.url));
const imagens = fileURLToPath(new URL("../../../docs/imagens/appuimel-2.6/", import.meta.url));
const semSandbox = process.getuid?.() === 0 ? ["--no-sandbox"] : [];

let aberto: ElectronApplication | undefined;
let dados: string | undefined;

async function abrir(dono: boolean): Promise<Page> {
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
  return pagina;
}

const irParaGrupo = async (p: Page): Promise<void> => {
  await p.locator('[data-area="grupo"]').click();
  await p.locator("#tela-grupo:not([hidden])").waitFor();
  await p.locator('#tela-grupo[aria-busy="false"]').waitFor();
};

const expandida = (p: Page, id: string): Promise<string | null> =>
  p.locator(`#${id}`).getAttribute("aria-expanded");

afterEach(async () => {
  await Promise.race([
    aberto?.evaluate(({ app: a }) => a.exit(0)).catch(() => undefined),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
  await aberto?.close().catch(() => undefined);
  aberto = undefined;
  if (dados) rmSync(dados, { recursive: true, force: true });
});

describe("seções recolhíveis", () => {
  it("Grupo: dono recolhe a lista de PCs, o estado é lembrado e o convite continua à mostra", async () => {
    const p = await abrir(true);
    await irParaGrupo(p);
    await p.locator("#grupo-lista li").first().waitFor();
    // Peça de estado honesta: sem dado de "visto" no cartório, mostra "—".
    expect(await p.locator("#grupo-lista li").first().textContent()).toContain("Visto: —");
    expect(await p.locator("#grupo-lista li").first().textContent()).toContain("Dono do grupo");
    for (const [esquema, nome] of [
      ["light", "claro"],
      ["dark", "escuro"],
    ] as const) {
      await p.emulateMedia({ colorScheme: esquema });
      await registrarCaptura(p, join(imagens, `grupo-${nome}.png`));
    }
    expect(await expandida(p, "secao-pcs-seta")).toBe("true");
    await p.locator("#secao-pcs-seta").click();
    expect(await expandida(p, "secao-pcs-seta")).toBe("false");
    expect(await p.locator("#grupo-lista").isVisible()).toBe(false);
    expect(await p.locator("#convite-criar").isVisible()).toBe(true);
    await p.reload();
    await p.locator("#cartao:not([data-estado=carregando])").waitFor();
    await irParaGrupo(p);
    expect(await expandida(p, "secao-pcs-seta")).toBe("false");
    await p.locator("#secao-convite-seta").click();
    expect(await p.locator("#convite-criar").isVisible()).toBe(false);
    await p.emulateMedia({ colorScheme: "dark" });
    await registrarCaptura(p, join(imagens, "grupo-recolhido-escuro.png"));
    await p.locator("#secao-pcs-seta").click();
    expect(await p.locator("#grupo-lista li").first().isVisible()).toBe(true);
  });

  it("Grupo: amigo (não-dono) não vê PCs nem convite", async () => {
    const p = await abrir(false);
    await irParaGrupo(p);
    expect(await p.locator("#grupo-area").isHidden()).toBe(true);
    expect(await p.locator("#secao-pcs").isVisible()).toBe(false);
    expect(await p.locator("#secao-convite").isVisible()).toBe(false);
  });

  it("Mods: a lista recolhe, abre e é lembrada; só o dono vê o botão de adicionar", async () => {
    const p = await abrir(true);
    await irParaGrupo(p);
    await p.locator("#ver-mods").click();
    await p.locator("#tela-mods:not([hidden])").waitFor();
    await p.locator("#mods-lista li").first().waitFor();
    expect(await p.locator("#mods-novo").isVisible()).toBe(true);
    for (const [esquema, nome] of [
      ["light", "claro"],
      ["dark", "escuro"],
    ] as const) {
      await p.emulateMedia({ colorScheme: esquema });
      await registrarCaptura(p, join(imagens, `mods-${nome}.png`));
    }
    await p.locator("#secao-mods-lista-seta").click();
    expect(await expandida(p, "secao-mods-lista-seta")).toBe("false");
    expect(await p.locator("#mods-lista").isVisible()).toBe(false);
    await p.reload();
    await p.locator("#cartao:not([data-estado=carregando])").waitFor();
    await irParaGrupo(p);
    await p.locator("#ver-mods").click();
    await p.locator("#tela-mods:not([hidden])").waitFor();
    expect(await expandida(p, "secao-mods-lista-seta")).toBe("false");
  });

  it("Mods: amigo (não-dono) vê a lista, sem adicionar", async () => {
    const p = await abrir(false);
    await irParaGrupo(p);
    await p.locator("#ver-mods").click();
    await p.locator("#tela-mods:not([hidden])").waitFor();
    await p.locator("#mods-lista li").first().waitFor();
    expect(await p.locator("#mods-novo").isVisible()).toBe(false);
  });
  it("Configurações: seções recolhem e são lembradas; a barra de salvar mora no rodapé só nesta tela", async () => {
    const p = await abrir(false);
    expect(await p.locator("#config-barra").isVisible()).toBe(false);
    await p.locator('[data-area="configuracoes"]').click();
    await p.locator("#tela-config:not([hidden])").waitFor();
    // A barra está dentro do rodapé (não do formulário) e o Salvar continua ligado ao formulário.
    expect(await p.locator("#rodape #config-barra").count()).toBe(1);
    expect(await p.locator("#config-form #config-barra").count()).toBe(0);
    expect(await p.locator("#config-barra").isVisible()).toBe(true);
    for (const [esquema, nome] of [
      ["light", "claro"],
      ["dark", "escuro"],
    ] as const) {
      await p.emulateMedia({ colorScheme: esquema });
      await registrarCaptura(p, join(imagens, `configuracoes-${nome}.png`));
    }
    // Editar acende "Há alterações não salvas" e libera o Salvar, que fica fora do formulário.
    await p.locator("#cfg-windows").click();
    expect(await p.locator("#config-pendente").isVisible()).toBe(true);
    expect(await p.locator("#config-salvar").isEnabled()).toBe(true);
    await p.locator("#config-descartar").click();
    expect(await p.locator("#config-salvar").isEnabled()).toBe(false);
    // Recolher a seção Geral esconde a opção; reabrir a mostra; o estado sobrevive ao recarregar.
    await p.locator("#secao-config-geral-seta").click();
    expect(await expandida(p, "secao-config-geral-seta")).toBe("false");
    expect(await p.locator("#cfg-windows").isVisible()).toBe(false);
    await p.reload();
    await p.locator("#cartao:not([data-estado=carregando])").waitFor();
    await p.locator('[data-area="configuracoes"]').click();
    await p.locator("#tela-config:not([hidden])").waitFor();
    expect(await expandida(p, "secao-config-geral-seta")).toBe("false");
    await p.emulateMedia({ colorScheme: "dark" });
    await registrarCaptura(p, join(imagens, "configuracoes-recolhida-escuro.png"));
    await p.locator("#secao-config-geral-seta").click();
    expect(await p.locator("#cfg-windows").isVisible()).toBe(true);
    // Sair da tela some a barra do rodapé.
    await p.locator("#config-voltar").click();
    expect(await p.locator("#config-barra").isVisible()).toBe(false);
  });
});
