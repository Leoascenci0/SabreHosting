// chunk-1.6: aba Mundo (resetar parte do mundo e desfazer) com servidor falso e mundo inventado em pasta temporária.
// Capturas em docs/imagens/chunk-1.6 só com SABRE_CAPTURAS=1.
import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { existsSync, mkdtempSync, readdirSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { registrarCaptura } from "./captura.js";

const pastaApp = fileURLToPath(new URL("..", import.meta.url));
const imagens = fileURLToPath(new URL("../../../docs/imagens/chunk-1.6/", import.meta.url));
const semSandbox = process.getuid?.() === 0 ? ["--no-sandbox"] : [];

interface Pastas {
  mundo: string;
  backups: string;
}

let aberto: ElectronApplication | undefined;
let dados: string | undefined;

async function abrir(
  cenario: string,
  extra: Record<string, string> = { SABRE_E2E_DONO: "1" },
): Promise<{ pagina: Page; pastas: Pastas }> {
  dados = mkdtempSync(join(tmpdir(), "sabre-e2e-"));
  aberto = await electron.launch({
    args: [...semSandbox, `--user-data-dir=${dados}`, pastaApp],
    env: { ...process.env, ...extra, SABRE_E2E: "1", SABRE_E2E_CENARIO: cenario } as Record<
      string,
      string
    >,
    timeout: 20_000,
  });
  const pagina = await aberto.firstWindow();
  await pagina.waitForLoadState("load");
  await pagina.locator("#cartao:not([data-estado=carregando])").waitFor();
  const pastas = await aberto.evaluate(
    () => (globalThis as { __sabreE2EMundo?: unknown }).__sabreE2EMundo as Pastas,
  );
  await pagina.locator('[data-area="mundo"]').click();
  return { pagina, pastas };
}

const regiao = (p: Pastas, nome = "r.0.0.mca"): string => join(p.mundo, "region", nome);
const pacotes = (p: Pastas): string[] =>
  readdirSync(p.backups).filter((n) => n.endsWith(".tar.gz"));

afterEach(async () => {
  await Promise.race([
    aberto?.evaluate(({ app: a }) => a.exit(0)).catch(() => undefined),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
  await aberto?.close().catch(() => undefined);
  aberto = undefined;
  if (dados) rmSync(dados, { recursive: true, force: true });
});

/** Marca a região 0,0 (64 chunks), vê a prévia e abre a confirmação de "Resetar…". */
async function ateConfirmar(pagina: Page): Promise<void> {
  await pagina.locator("#mundo-grade button", { hasText: "0, 0" }).click();
  await pagina.locator("#mundo-ver-previa").click();
  await pagina.locator("#mundo-previa:not([hidden])").waitFor();
  await pagina.locator("#mundo-resetar").click();
  await pagina.locator("#mundo-confirmacao:not([hidden])").waitFor();
}

async function confirmarComNome(pagina: Page, nome = "world"): Promise<void> {
  await pagina.locator("#mundo-nome-digitado").fill(nome);
  await pagina.locator("#mundo-confirmar").click();
}

describe("aba Mundo", () => {
  it("quem não é o dono não vê a ação nenhuma", async () => {
    const { pagina } = await abrir("ninguem", {});
    await pagina.locator("#mundo-so-dono:not([hidden])").waitFor();
    await expect(pagina.locator("#mundo-so-dono").innerText()).resolves.toContain("dono");
    await expect(pagina.locator("#mundo-area").isHidden()).resolves.toBe(true);
    await expect(pagina.locator("#mundo-resetar").isVisible()).resolves.toBe(false);
  });

  it("com o servidor ligado Resetar e Desfazer ficam desligados, com a dica à vista; nada muda", async () => {
    const { pagina, pastas } = await abrir("eu");
    await pagina.locator("#mundo-area:not([hidden])").waitFor();
    await pagina.locator("#mundo-grade button").first().waitFor();
    await pagina.locator("#mundo-grade button", { hasText: "0, 0" }).click();
    await pagina.locator("#mundo-ver-previa").click(); // só lê: a prévia continua valendo
    await pagina.locator("#mundo-previa:not([hidden])").waitFor();
    await expect(pagina.locator("#mundo-resetar").isDisabled()).resolves.toBe(true);
    await expect(pagina.locator("#mundo-desfazer").isDisabled()).resolves.toBe(true);
    await expect(pagina.locator("#mundo-dica").innerText()).resolves.toBe(
      "Pare o servidor para resetar",
    );
    await expect(pagina.locator("#mundo-desfazer-info").innerText()).resolves.toBe(
      "Pare o servidor para resetar",
    );
    expect(existsSync(regiao(pastas))).toBe(true);
    expect(pacotes(pastas)).toHaveLength(0);
  });

  it("a grade mostra as regiões do disco; clicar preenche os campos; a prévia bate com o plano", async () => {
    const { pagina } = await abrir("ninguem");
    await pagina.locator("#mundo-grade button").first().waitFor();
    await expect(pagina.locator("#mundo-grade button").count()).resolves.toBe(3);
    await expect(pagina.locator("#mundo-grade-vazio").innerText()).resolves.toMatch(
      /^3 regiões salvas; o mundo todo tem/,
    );
    await expect(pagina.locator("#mundo-resetar").isDisabled()).resolves.toBe(true);
    await expect(pagina.locator("#mundo-dica").innerText()).resolves.toContain("prévia");

    await pagina.locator("#mundo-grade button", { hasText: "1, 0" }).click();
    await expect(pagina.locator("#mundo-x1").inputValue()).resolves.toBe("512");
    await expect(pagina.locator("#mundo-x2").inputValue()).resolves.toBe("1023");
    await expect(pagina.locator("#mundo-z2").inputValue()).resolves.toBe("511");
    await pagina.locator("#mundo-ver-previa").click();
    await expect(pagina.locator("#mundo-previa-titulo").innerText()).resolves.toBe(
      "Vai apagar 10 chunks.",
    );

    // Região 0,0 marcada junto: o retângulo que contém as duas (74 chunks existem lá).
    await pagina.locator("#mundo-grade button", { hasText: "0, 0" }).click();
    await pagina.locator("#mundo-ver-previa").click();
    await expect(pagina.locator("#mundo-previa-titulo").innerText()).resolves.toBe(
      "Vai apagar 74 chunks.",
    );
    const linhas = await pagina.locator("#mundo-previa-linhas").innerText();
    expect(linhas).toMatch(/Libera cerca de .* de .* no mundo todo\./);
    expect(linhas).toContain("Um backup é feito antes.");
    await expect(pagina.locator("#mundo-resetar").isEnabled()).resolves.toBe(true);

    // Mexer na área apaga a prévia: Resetar só vale para o que foi visto.
    await pagina.locator("#mundo-x2").fill("2000");
    await expect(pagina.locator("#mundo-previa").isHidden()).resolves.toBe(true);
    await expect(pagina.locator("#mundo-resetar").isDisabled()).resolves.toBe(true);
  });

  it("área ao redor de um ponto, campo inválido e área grande pedem confirmação mostrando o número", async () => {
    const { pagina, pastas } = await abrir("ninguem");
    await pagina.locator("#mundo-grade button").first().waitFor();
    await pagina.locator("#mundo-modo-raio").check();
    await pagina.locator("#mundo-x").fill("abc");
    await pagina.locator("#mundo-ver-previa").click();
    await expect(pagina.locator("#mundo-erro").innerText()).resolves.toContain("número inteiro");

    await pagina.locator("#mundo-x").fill("0");
    await pagina.locator("#mundo-raio").fill("100");
    await pagina.locator("#mundo-ver-previa").click();
    await expect(pagina.locator("#mundo-previa-titulo").innerText()).resolves.toBe(
      "Vai apagar 64 chunks.", // só a quina da região 0,0 tem chunks dentro do círculo? o plano diz
    );
    await expect(pagina.locator("#mundo-erro").isHidden()).resolves.toBe(true);

    await pagina.locator("#mundo-raio").fill("5000");
    await pagina.locator("#mundo-ver-previa").click();
    await pagina.locator("#mundo-grande:not([hidden])").waitFor();
    await expect(pagina.locator("#mundo-grande-texto").innerText()).resolves.toMatch(
      /cobre [\d.]+ chunks/,
    );
    await expect(pagina.locator("#mundo-previa").isHidden()).resolves.toBe(true);
    await pagina.locator("#mundo-grande-sim").click();
    await pagina.locator("#mundo-previa:not([hidden])").waitFor();
    await expect(pagina.locator("#mundo-previa-titulo").innerText()).resolves.toBe(
      "Vai apagar 75 chunks.",
    );
    expect(existsSync(regiao(pastas))).toBe(true);
  });

  it("confirmação com nome errado não reseta; Esc cancela; nada é escrito", async () => {
    const { pagina, pastas } = await abrir("ninguem");
    await pagina.locator("#mundo-grade button").first().waitFor();
    await ateConfirmar(pagina);
    await expect(pagina.locator("#mundo-pergunta").innerText()).resolves.toMatch(
      /Apagar 64 chunks do mundo “world”\? Um backup é feito agora \(hoje \d{2}:\d{2}\)/,
    );
    await expect(pagina.locator("#mundo-confirmar").isDisabled()).resolves.toBe(true);
    await pagina.locator("#mundo-nome-digitado").fill("mundo errado");
    await expect(pagina.locator("#mundo-confirmar").isDisabled()).resolves.toBe(true);
    await pagina.locator("#mundo-nome-digitado").fill("World"); // a caixa conta
    await expect(pagina.locator("#mundo-confirmar").isDisabled()).resolves.toBe(true);
    await pagina.keyboard.press("Escape");
    await expect(pagina.locator("#mundo-confirmacao").isHidden()).resolves.toBe(true);
    expect(existsSync(regiao(pastas))).toBe(true);
    expect(pacotes(pastas)).toHaveLength(0);
  });

  it("resetar apaga só a área, faz o backup antes, mostra o progresso; desfazer devolve", async () => {
    const { pagina, pastas } = await abrir("ninguem");
    await pagina.locator("#mundo-grade button").first().waitFor();
    const tamanhoAntes = statSync(regiao(pastas)).size;
    await ateConfirmar(pagina);
    await pagina.evaluate(() => {
      const alvo = document.getElementById("mundo-progresso") as HTMLElement;
      const w = window as unknown as { __viuProgresso?: boolean };
      w.__viuProgresso = false;
      new MutationObserver(() => {
        if (!alvo.hidden && alvo.getBoundingClientRect().height > 0) w.__viuProgresso = true;
      }).observe(alvo, { attributes: true, attributeFilter: ["hidden"] });
    });
    await confirmarComNome(pagina);
    await expect
      .poll(() => pagina.locator("#mundo-resultado").innerText(), { timeout: 15_000 })
      .toContain("Pronto neste PC: 64 chunks apagados.");
    await expect(pagina.locator("#mundo-resultado").innerText()).resolves.toContain(
      "já foi enviada ao grupo",
    );
    await expect(
      pagina.evaluate(() => (window as unknown as { __viuProgresso?: boolean }).__viuProgresso),
    ).resolves.toBe(true);
    expect(existsSync(regiao(pastas))).toBe(false); // região inteira saiu
    expect(existsSync(regiao(pastas, "r.1.0.mca"))).toBe(true); // o resto fica
    expect(existsSync(regiao(pastas, "r.0.1.mca"))).toBe(true);
    expect(pacotes(pastas).length).toBeGreaterThanOrEqual(1);
    await expect(pagina.locator("#mundo-grade button").count()).resolves.toBe(2);

    // Desfazer: pede nome e data; devolve a região.
    await expect(pagina.locator("#mundo-desfazer").isEnabled()).resolves.toBe(true);
    await expect(pagina.locator("#mundo-desfazer-info").innerText()).resolves.toMatch(
      /Último reset: backup “Antes de resetar” de hoje \d{2}:\d{2}\./,
    );
    await pagina.locator("#mundo-desfazer").click();
    await expect(pagina.locator("#mundo-pergunta").innerText()).resolves.toMatch(
      /Desfazer o último reset\? O mundo “world” volta ao backup de hoje/,
    );
    await expect(pagina.locator("#mundo-pergunta-aviso").isHidden()).resolves.toBe(true);
    await confirmarComNome(pagina);
    await expect
      .poll(() => pagina.locator("#mundo-resultado").innerText(), { timeout: 15_000 })
      .toContain("Pronto neste PC.");
    expect(statSync(regiao(pastas)).size).toBe(tamanhoAntes);
    await expect(pagina.locator("#mundo-erro").isHidden()).resolves.toBe(true);
  });

  it("desfazer com jogo depois do reset avisa e só segue com a 2ª confirmação", async () => {
    const { pagina, pastas } = await abrir("ninguem");
    await pagina.locator("#mundo-grade button").first().waitFor();
    await ateConfirmar(pagina);
    await confirmarComNome(pagina);
    await expect
      .poll(() => pagina.locator("#mundo-resultado").innerText(), { timeout: 15_000 })
      .toContain("Pronto neste PC");
    await aberto?.evaluate(() =>
      (
        globalThis as unknown as { __sabreE2EMundo: { jogar(): Promise<void> } }
      ).__sabreE2EMundo.jogar(),
    );
    await pagina.locator("#mundo-desfazer").click();
    await confirmarComNome(pagina); // 1ª confirmação: o main só devolve o plano
    await pagina.locator("#mundo-pergunta-aviso:not([hidden])").waitFor();
    await expect(pagina.locator("#mundo-pergunta-aviso").innerText()).resolves.toContain(
      "o mundo foi jogado depois desse reset",
    );
    expect(existsSync(regiao(pastas))).toBe(false); // ainda não voltou
    await expect(pagina.locator("#mundo-confirmar").isDisabled()).resolves.toBe(true);
    await registrarCaptura(pagina, join(imagens, "desfazer-aviso-claro.png"));
    await confirmarComNome(pagina); // 2ª confirmação
    await expect.poll(() => existsSync(regiao(pastas)), { timeout: 15_000 }).toBe(true);
    await expect(pagina.locator("#mundo-resultado").innerText()).resolves.toContain(
      "Antes de restaurar",
    );
  });

  it("teclado: dá para ver a prévia, resetar e confirmar sem o mouse", async () => {
    const { pagina, pastas } = await abrir("ninguem");
    await pagina.locator("#mundo-grade button").first().waitFor();
    const grade = pagina.locator("#mundo-grade button", { hasText: "0, 0" });
    await grade.focus();
    await pagina.keyboard.press("Space"); // marca a região
    await expect(grade.getAttribute("aria-pressed")).resolves.toBe("true");
    await pagina.locator("#mundo-ver-previa").focus();
    await pagina.keyboard.press("Enter");
    await pagina.locator("#mundo-previa:not([hidden])").waitFor();
    await pagina.locator("#mundo-resetar").focus();
    await pagina.keyboard.press("Enter");
    // O foco já está no campo do nome; o botão perigoso só liga com o nome certo.
    await expect(pagina.evaluate(() => document.activeElement?.id)).resolves.toBe(
      "mundo-nome-digitado",
    );
    await pagina.keyboard.type("world");
    await pagina.keyboard.press("Enter");
    await expect
      .poll(() => pagina.locator("#mundo-resultado").innerText(), { timeout: 15_000 })
      .toContain("Pronto neste PC: 64 chunks apagados.");
    expect(existsSync(regiao(pastas))).toBe(false);
  });

  it("captura da aba, clara e escura", async () => {
    const { pagina } = await abrir("ninguem");
    await pagina.locator("#mundo-grade button").first().waitFor();
    await pagina.locator("#mundo-grade button", { hasText: "0, 0" }).click();
    await pagina.locator("#mundo-ver-previa").click();
    await pagina.locator("#mundo-previa:not([hidden])").waitFor();
    for (const [esquema, nome] of [
      ["light", "claro"],
      ["dark", "escuro"],
    ] as const) {
      await pagina.emulateMedia({ colorScheme: esquema });
      await registrarCaptura(pagina, join(imagens, `mundo-${nome}.png`));
    }
    await pagina.emulateMedia({ colorScheme: "light" });
    await pagina.locator("#mundo-resetar").click();
    await registrarCaptura(pagina, join(imagens, "mundo-confirmacao-claro.png"));
    await pagina.emulateMedia({ colorScheme: "dark" });
    await registrarCaptura(pagina, join(imagens, "mundo-confirmacao-escuro.png"));
    const [largura, janela] = await pagina.evaluate(() => [
      document.documentElement.scrollWidth,
      window.innerWidth,
    ]);
    expect(largura).toBeLessThanOrEqual(janela ?? 0);
  });
});
