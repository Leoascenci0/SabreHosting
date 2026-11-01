import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const pastaApp = fileURLToPath(new URL("..", import.meta.url));
const semSandbox = process.getuid?.() === 0 ? ["--no-sandbox"] : [];
const RECUSA = "Isso é só uma demonstração";
// Tudo o que o app grava de verdade na pasta de dados do usuário (o Chromium cria o resto sozinho).
const GRAVADOS = [
  "boas-vindas.json",
  "preferencias.json",
  "cofre-token.bin",
  "importar",
  "rede",
  "marcas-historico.json",
];

let aberto: ElectronApplication | undefined;
let dados: string | undefined;

/** MODO REAL: sem SABRE_E2E e sem nenhuma variável de teste; a demonstração não pode depender delas. */
async function abrir(): Promise<Page> {
  dados = mkdtempSync(join(tmpdir(), "sabre-demo-"));
  const env = Object.fromEntries(
    Object.entries(process.env).filter(([k]) => !k.startsWith("SABRE_")),
  ) as Record<string, string>;
  aberto = await electron.launch({
    args: [...semSandbox, `--user-data-dir=${dados}`, pastaApp],
    env,
    timeout: 20_000,
  });
  const pagina = await aberto.firstWindow();
  await pagina.waitForLoadState("load");
  await pagina.locator("#tela-boas-vindas:not([hidden])").waitFor();
  return pagina;
}

const gravadosAgora = (): string[] =>
  GRAVADOS.filter((nome) => dados !== undefined && existsSync(join(dados, nome)));

afterEach(async () => {
  await Promise.race([
    aberto?.evaluate(({ app: a }) => a.exit(0)).catch(() => undefined),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
  await aberto?.close().catch(() => undefined);
  aberto = undefined;
  if (dados) rmSync(dados, { recursive: true, force: true });
});

describe("modo demonstração (Explorar sem grupo)", () => {
  it("o botão abre o início com a faixa; o main recusa o que gravaria; nada é gravado; sair volta ao convite", async () => {
    const pagina = await abrir();
    expect(gravadosAgora()).toEqual([]);

    await pagina.locator("#bv-explorar").click();
    await pagina.locator("#cartao:not([hidden])").waitFor();
    await expect(pagina.locator("#tela-boas-vindas").isHidden()).resolves.toBe(true);
    await expect(pagina.locator("#faixa-demo").innerText()).resolves.toContain("Modo demonstração");

    // Início com os botões do app inteiro, com dados de mentira.
    await expect.poll(() => pagina.locator("#status").innerText()).toContain("Ninguém");
    await expect(pagina.locator("#principal").innerText()).resolves.toBe("Hospedar");
    for (const id of ["importar-abrir", "ver-backups", "ver-config"]) {
      await expect(pagina.locator(`#${id}`).isVisible()).resolves.toBe(true);
    }

    // Hospedar pela tela: recusado no main.
    await pagina.locator("#principal").click();
    await expect.poll(() => pagina.locator("#erro").innerText()).toContain(RECUSA);

    // Cada escrita chamada direto na ponte (sem passar pela tela): o main recusa com o mesmo texto.
    const recusas = await pagina.evaluate(async () => {
      const s = (globalThis as unknown as { sabre: import("../src/ui/ponte.js").PonteSabre }).sabre;
      const cfg = (await s.configuracoes.ler()) as never;
      const cru = [
        await s.inicio.hospedar(),
        await s.inicio.parar(),
        await s.backups.restaurar("qualquer.zip"),
        await s.importar.executar(true),
        await s.configuracoes.salvar(cfg),
        await s.grupo.tirar(2),
        await s.grupo.criarConvite("PC novo", 24),
        await s.mods.tirar("sodium.jar"),
        await s.versoes.gravar("1.20.4"),
        await s.pasta.trocar("C:\\Jogos\\Outra"),
      ];
      return cru.map((r) => r as { ok: boolean; mensagem?: string });
    });
    for (const r of recusas)
      expect(r).toEqual({ ok: false, mensagem: expect.stringContaining(RECUSA) });

    // As leituras mostram dados de mentira.
    const backups = await pagina.evaluate(() =>
      (
        globalThis as unknown as { sabre: import("../src/ui/ponte.js").PonteSabre }
      ).sabre.backups.listar(),
    );
    expect(backups.itens.length).toBeGreaterThan(0);

    // Nada novo na pasta de dados do app (nem cofre, nem configurações, nem rede).
    expect(gravadosAgora()).toEqual([]);

    // Sair da demonstração: volta ao convite (passo 1) e a faixa some.
    await pagina.locator("#faixa-demo-sair").click();
    await pagina.locator("#tela-boas-vindas:not([hidden])").waitFor();
    await expect(pagina.locator("#bv-convite").isVisible()).resolves.toBe(true);
    await expect(pagina.locator("#faixa-demo").isHidden()).resolves.toBe(true);
    expect(gravadosAgora()).toEqual([]);
  });
});
