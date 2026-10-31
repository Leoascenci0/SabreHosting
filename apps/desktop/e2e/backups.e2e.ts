import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";

const pastaApp = fileURLToPath(new URL("..", import.meta.url));
const semSandbox = process.getuid?.() === 0 ? ["--no-sandbox"] : [];

interface Pastas {
  mundo: string;
  backups: string;
}

let aberto: ElectronApplication | undefined;
let dados: string | undefined;

async function abrir(cenario: string): Promise<{ pagina: Page; pastas: Pastas }> {
  dados = mkdtempSync(join(tmpdir(), "sabre-e2e-"));
  aberto = await electron.launch({
    args: [...semSandbox, `--user-data-dir=${dados}`, pastaApp],
    env: { ...process.env, SABRE_E2E: "1", SABRE_E2E_CENARIO: cenario } as Record<string, string>,
    timeout: 20_000,
  });
  const pagina = await aberto.firstWindow();
  await pagina.waitForLoadState("load");
  await pagina.locator("#cartao:not([data-estado=carregando])").waitFor();
  const pastas = await aberto.evaluate(
    () => (globalThis as { __sabreE2EBackups?: unknown }).__sabreE2EBackups as Pastas,
  );
  await pagina.locator("#ver-backups").click();
  return { pagina, pastas };
}

const mundoAgora = (p: Pastas): string => readFileSync(join(p.mundo, "level.dat"), "utf8");

afterEach(async () => {
  await Promise.race([
    aberto?.evaluate(({ app: a }) => a.exit(0)).catch(() => undefined),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
  await aberto?.close().catch(() => undefined);
  aberto = undefined;
  if (dados) rmSync(dados, { recursive: true, force: true });
});

describe("tela de backups", () => {
  it("lista data, tamanho e de quem; cancelar não muda nada", async () => {
    const { pagina, pastas } = await abrir("ninguem");
    const linha = pagina.locator("#lista-backups li");
    await linha.first().waitFor();
    await expect(linha.first().innerText()).resolves.toContain("Este PC");
    await linha
      .first()
      .getByRole("button", { name: /Restaurar/ })
      .click();
    await expect(pagina.locator("#backups-pergunta").innerText()).resolves.toMatch(
      /30\/10\/2026.*mundo de agora será trocado|mundo de agora será trocado/s,
    );
    await expect(pagina.locator("#backups-confirmacao").innerText()).resolves.toContain(
      "guardado num backup antes da troca",
    );
    await pagina.locator("#backups-cancelar").click();
    expect(mundoAgora(pastas)).toBe("atual");
    expect(readdirSync(pastas.backups)).toHaveLength(1);
  });

  it("confirmar restaura o backup: o mundo volta e o estado de antes vira outro backup", async () => {
    const { pagina, pastas } = await abrir("ninguem");
    await pagina.locator("#lista-backups li button").first().click();
    await pagina.locator("#backups-confirmar").click();
    await expect.poll(() => pagina.locator("#backups-detalhe").innerText()).toContain("Pronto");
    expect(mundoAgora(pastas)).toBe("do-backup");
    expect(readdirSync(pastas.backups).filter((n) => n.endsWith(".tar.gz"))).toHaveLength(2);
  });

  it("com o servidor rodando os botões de restaurar ficam desligados", async () => {
    const { pagina, pastas } = await abrir("eu");
    await pagina.locator("#lista-backups li button").first().waitFor();
    await expect(pagina.locator("#lista-backups li button").first().isDisabled()).resolves.toBe(
      true,
    );
    await expect(pagina.locator("#backups-detalhe").innerText()).resolves.toContain(
      "Pare o servidor",
    );
    expect(mundoAgora(pastas)).toBe("atual");
  });
});
