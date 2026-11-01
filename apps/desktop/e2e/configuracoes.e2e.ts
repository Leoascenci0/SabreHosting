import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { registrarCaptura } from "./captura.js";
import { gerarPropriedades } from "@sabrehosting/nucleo/servidor/configurar";
import { afterEach, describe, expect, it } from "vitest";

const pastaApp = fileURLToPath(new URL("..", import.meta.url));
const imagens = fileURLToPath(new URL("../../../docs/imagens/appui-1.3/", import.meta.url));
const semSandbox = process.getuid?.() === 0 ? ["--no-sandbox"] : [];

let aberto: ElectronApplication | undefined;
let dados: string | undefined;

async function abrir(dono = false, cenario = "ninguem"): Promise<Page> {
  dados = mkdtempSync(join(tmpdir(), "sabre-e2e-"));
  aberto = await electron.launch({
    args: [...semSandbox, `--user-data-dir=${dados}`, pastaApp],
    env: {
      ...process.env,
      SABRE_E2E: "1",
      SABRE_E2E_CENARIO: cenario,
      ...(dono ? { SABRE_E2E_DONO: "1" } : {}),
    } as Record<string, string>,
    timeout: 20_000,
  });
  const pagina = await aberto.firstWindow();
  await pagina.waitForLoadState("load");
  await pagina.locator("#cartao:not([data-estado=carregando])").waitFor();
  await pagina.locator("#ver-config").click();
  return pagina;
}

/** Trocar de aba esconde as outras (display:none): o teste vai primeiro até a aba do campo. */
const ir = (p: Page, aba: string): Promise<void> => p.locator(`#aba-${aba}`).click();

/** O estado do grupo (dono, endereço) chega depois da abertura: espera o endereço aparecer. */
const grupoChegou = (p: Page): Promise<unknown> =>
  p.waitForFunction(() => !document.getElementById("cfg-endereco")?.hidden);

const esperarTexto = (p: Page, seletor: string, trecho: string): Promise<unknown> =>
  p.waitForFunction(
    ([s, t]) => document.querySelector(s as string)?.textContent?.includes(t as string),
    [seletor, trecho],
  );

const arquivo = (): string => join(dados ?? "", "preferencias.json");

afterEach(async () => {
  await Promise.race([
    aberto?.evaluate(({ app: a }) => a.exit(0)).catch(() => undefined),
    new Promise((r) => setTimeout(r, 5000)),
  ]);
  await aberto?.close().catch(() => undefined);
  aberto = undefined;
  if (dados) rmSync(dados, { recursive: true, force: true });
});

describe("tela de configurações", () => {
  it("mostra os padrões; valor inválido não salva; válido chega ao núcleo", async () => {
    const p = await abrir();
    await ir(p, "servidor");
    expect(await p.locator("#cfg-visao").inputValue()).toBe("10");
    expect(await p.locator("#cfg-simulacao").inputValue()).toBe("8");

    await p.locator("#cfg-visao").fill("2");
    await p.locator("#config-salvar").click();
    await esperarTexto(p, "#config-erro", "distância de visão");
    expect(() => readFileSync(arquivo())).toThrow(); // nada foi gravado

    await p.locator("#cfg-visao").fill("12");
    await p.locator("#cfg-simulacao").fill("12");
    await p.locator("#config-salvar").click();
    await esperarTexto(p, "#config-erro", "menor que a distância de visão");
    expect(() => readFileSync(arquivo())).toThrow();

    await p.locator("#cfg-simulacao").fill("6");
    await p.locator("#config-salvar").click();
    await esperarTexto(p, "#config-aviso", "Salvo.");
    const salvo = JSON.parse(readFileSync(arquivo(), "utf8")) as Record<string, number>;
    expect(salvo).toMatchObject({ distanciaVisao: 12, distanciaSimulacao: 6 });
    const texto = gerarPropriedades({
      ipRedePrivada: "10.66.0.5",
      distanciaVisao: salvo["distanciaVisao"] ?? 0,
      distanciaSimulacao: salvo["distanciaSimulacao"] ?? 0,
    });
    expect(texto).toContain("view-distance=12");
    expect(texto).toContain("simulation-distance=6");

    // Voltar e abrir de novo: o valor salvo é o que aparece.
    await p.locator("#config-voltar").click();
    await p.locator("#ver-config").click();
    await ir(p, "servidor");
    expect(await p.locator("#cfg-visao").inputValue()).toBe("12");
  });

  it("backups: intervalo inválido não salva; o valor salvo muda o intervalo do agendador", async () => {
    // Cenário "eu": este PC hospeda; quando o servidor fica pronto o agendador do núcleo liga com o padrão (10 min).
    const p = await abrir(false, "eu");
    await ir(p, "backups");
    const intervalos = (): Promise<number[]> =>
      aberto?.evaluate(
        () =>
          (globalThis as unknown as { __sabreE2EAgenda: { intervalos: number[] } }).__sabreE2EAgenda
            .intervalos,
      ) as Promise<number[]>;
    await expect.poll(intervalos, { timeout: 10_000 }).toEqual([10 * 60_000]);
    expect(await p.locator("#cfg-intervalo").inputValue()).toBe("10");

    await p.locator("#cfg-intervalo").fill("0");
    await p.locator("#config-salvar").click();
    await esperarTexto(p, "#config-erro", "intervalo do backup");
    expect(() => readFileSync(arquivo())).toThrow(); // nada gravado
    expect(await intervalos()).toEqual([10 * 60_000]); // e o agendador nem mexeu

    await p.locator("#cfg-intervalo").fill("30");
    await p.locator("#config-salvar").click();
    await esperarTexto(p, "#config-aviso", "Salvo.");
    expect(JSON.parse(readFileSync(arquivo(), "utf8"))).toMatchObject({ intervaloBackupMin: 30 });
    await expect.poll(intervalos, { timeout: 5000 }).toEqual([10 * 60_000, 30 * 60_000]);

    await p.locator("#config-voltar").click();
    await p.locator("#ver-config").click();
    await ir(p, "backups");
    expect(await p.locator("#cfg-intervalo").inputValue()).toBe("30");

    // Quantos guardar: padrão 10; 0 é recusado e o foco vai para o campo; 4 grava.
    expect(await p.locator("#cfg-quantos").inputValue()).toBe("10");
    await p.locator("#cfg-quantos").fill("0");
    await p.locator("#config-salvar").click();
    await esperarTexto(p, "#config-erro", "Quantos guardar");
    expect(await p.locator("#cfg-quantos").getAttribute("aria-invalid")).toBe("true");
    await p.locator("#cfg-quantos").fill("4");
    await p.locator("#config-salvar").click();
    await esperarTexto(p, "#config-aviso", "Salvo.");
    expect(JSON.parse(readFileSync(arquivo(), "utf8"))).toMatchObject({ quantosGuardar: 4 });
  });

  it("histórico longo: pasta e botão só ficam ativos com a opção ligada; erro leva ao campo certo", async () => {
    const p = await abrir();
    await ir(p, "backups");
    await expect(p.locator("#cfg-historico-pasta").isDisabled()).resolves.toBe(true);
    await expect(p.locator("#cfg-historico-escolher").isDisabled()).resolves.toBe(true);
    await p.locator("#cfg-historico").check();
    await expect(p.locator("#cfg-historico-escolher").isDisabled()).resolves.toBe(false);
    await p.locator("#config-salvar").click(); // ligado sem pasta
    await esperarTexto(p, "#config-erro", "histórico longo");
    expect(await p.locator("#cfg-historico-pasta").getAttribute("aria-invalid")).toBe("true");
    expect(await p.locator("#cfg-intervalo").getAttribute("aria-invalid")).toBe("false");
    expect(() => readFileSync(arquivo())).toThrow();
  });

  it("cada aba mostra só as suas seções; Grupo e Mods não são mais abas", async () => {
    const p = await abrir();
    await ir(p, "servidor");
    await p.locator("#cfg-endereco").waitFor(); // o endereço chega junto com o estado do grupo
    const legendas = (): Promise<string[]> => p.locator("legend:visible").allTextContents();
    expect(await legendas()).toEqual(["Servidor", "Endereço do servidor"]);
    await ir(p, "backups");
    expect(await legendas()).toEqual(["Backups"]);
    await ir(p, "geral");
    expect(await legendas()).toEqual(["Geral"]);
    // Grupo e Mods têm tela própria (barra lateral › Grupo): sem aba aqui.
    expect(await p.locator('[role="tab"]').allTextContents()).toEqual([
      "Geral",
      "Servidor",
      "Backups",
    ]);
  });

  it("Endereço do servidor: aparece para todos, só leitura, com o endereço do cartório", async () => {
    const p = await abrir();
    await ir(p, "servidor");
    await p.locator("#cfg-endereco").waitFor();
    const campo = p.locator("#grupo-endereco");
    expect(await campo.inputValue()).toBe("mundo.exemplo.net");
    expect(await campo.isEditable()).toBe(false);
  });

  it("versão: não-dono não vê a área", async () => {
    const p = await abrir();
    await grupoChegou(p);
    await ir(p, "servidor");
    expect(await p.locator("#cfg-versao-area").isHidden()).toBe(true);
  });

  it("versão: dono vê o que roda; cancelar não grava; confirmar grava", async () => {
    const p = await abrir(true);
    await ir(p, "servidor");
    await p.locator("#cfg-versao-area:not([hidden])").waitFor();
    await esperarTexto(p, "#cfg-versao-dica", "Fabric e Forge");
    expect(await p.locator("#cfg-versao-trocar").isDisabled()).toBe(true); // a de hoje: nada a trocar
    await p.locator("#cfg-versao").selectOption("1.12.2");
    await esperarTexto(p, "#cfg-versao-dica", "Só roda sem mods");
    await p.locator("#cfg-versao-trocar").click();
    await esperarTexto(p, "#cfg-versao-pergunta", "de 1.21.1 para 1.12.2");
    await p.locator("#cfg-versao-cancelar").click();
    expect(await p.locator("#cfg-versao-confirmacao").isHidden()).toBe(true);
    const gravados = (): Promise<string[]> =>
      p.evaluate(
        () =>
          (globalThis as unknown as { __sabreE2EVersao?: { gravados: string[] } }).__sabreE2EVersao
            ?.gravados ?? [],
      );
    expect(await gravados()).toEqual([]);
    await p.locator("#cfg-versao-trocar").click();
    await p.locator("#cfg-versao-confirmar").click();
    await esperarTexto(p, "#cfg-versao-aviso", "usa a versão 1.12.2");
  });
});

describe("configurações em seções (appui-1.3)", () => {
  const salvar = (p: Page) => p.locator("#config-salvar");

  it("trocar de aba mantém o que foi digitado e não relê nada", async () => {
    const p = await abrir();
    await ir(p, "servidor");
    await p.locator("#cfg-visao").fill("14");
    await ir(p, "backups");
    await p.locator("#cfg-intervalo").fill("45");
    await ir(p, "geral");
    await ir(p, "servidor");
    expect(await p.locator("#cfg-visao").inputValue()).toBe("14");
    await ir(p, "backups");
    expect(await p.locator("#cfg-intervalo").inputValue()).toBe("45");
    expect(await p.locator("#aba-backups").getAttribute("aria-selected")).toBe("true");
    expect(await p.locator("#aba-geral").getAttribute("aria-selected")).toBe("false");
  });

  it("Salvar só habilita com mudança; 'Há alterações não salvas' acompanha", async () => {
    const p = await abrir();
    await ir(p, "backups");
    await expect(salvar(p).isDisabled()).resolves.toBe(true);
    await expect(p.locator("#config-pendente").isVisible()).resolves.toBe(false);
    await p.locator("#cfg-quantos").fill("7");
    await expect(salvar(p).isDisabled()).resolves.toBe(false);
    await expect(p.locator("#config-pendente").isVisible()).resolves.toBe(true);
    await p.locator("#cfg-quantos").fill("10"); // voltou ao que estava salvo
    await expect(salvar(p).isDisabled()).resolves.toBe(true);
    await p.locator("#cfg-quantos").fill("7");
    await salvar(p).click();
    await esperarTexto(p, "#config-aviso", "Salvo.");
    await expect(salvar(p).isDisabled()).resolves.toBe(true); // salvo: nada mais pendente
    await expect(p.locator("#config-pendente").isVisible()).resolves.toBe(false);
    expect(JSON.parse(readFileSync(arquivo(), "utf8"))).toMatchObject({ quantosGuardar: 7 });
  });

  it("Descartar volta ao que está salvo, sem gravar nada", async () => {
    const p = await abrir();
    await ir(p, "servidor");
    await p.locator("#cfg-visao").fill("20");
    await ir(p, "backups");
    await p.locator("#cfg-banda").fill("50");
    await p.locator("#config-descartar").click();
    await p.waitForFunction(
      () => document.querySelector<HTMLInputElement>("#cfg-banda")?.value === "10",
    );
    await ir(p, "servidor");
    expect(await p.locator("#cfg-visao").inputValue()).toBe("10");
    await expect(salvar(p).isDisabled()).resolves.toBe(true);
    await expect(p.locator("#config-descartar").isDisabled()).resolves.toBe(true);
    expect(() => readFileSync(arquivo())).toThrow();
  });

  it("Padrão restaura o valor de fábrica de cada campo (vindo da ponte)", async () => {
    const p = await abrir();
    await ir(p, "backups");
    await p.locator("#cfg-intervalo").fill("30");
    await p.locator('button.padrao[data-campo="cfg-intervalo"]').click();
    expect(await p.locator("#cfg-intervalo").inputValue()).toBe("10");
    await expect(salvar(p).isDisabled()).resolves.toBe(true); // igual ao salvo de novo
    await p.locator("#cfg-banda").fill("99");
    await p.locator('button.padrao[data-campo="cfg-banda"]').click();
    expect(await p.locator("#cfg-banda").inputValue()).toBe("10");
    await ir(p, "servidor");
    await p.locator("#cfg-simulacao").fill("20");
    await p.locator('button.padrao[data-campo="cfg-simulacao"]').click();
    expect(await p.locator("#cfg-simulacao").inputValue()).toBe("8");
    // O padrão do histórico só vale com a opção ligada (campo desligado, botão desligado).
    await ir(p, "backups");
    await expect(
      p.locator('button.padrao[data-campo="cfg-historico-quantos"]').isDisabled(),
    ).resolves.toBe(true);
    // Nada de "Padrão: 10" escrito à mão na tela: o número vem da ponte.
    expect(await p.locator(".config .dica").allTextContents()).not.toContainEqual(
      expect.stringMatching(/Padrão: \d/),
    );
  });

  it("valor fora do limite mostra o erro e leva à aba e ao campo certos", async () => {
    const p = await abrir();
    await ir(p, "backups");
    await p.locator("#cfg-quantos").fill("0");
    await ir(p, "geral");
    await salvar(p).click(); // ainda dá para salvar de outra aba: o app leva até o erro
    await esperarTexto(p, "#config-erro", "Quantos guardar");
    expect(await p.locator("#aba-backups").getAttribute("aria-selected")).toBe("true");
    expect(await p.locator("#cfg-quantos").getAttribute("aria-invalid")).toBe("true");
    expect(await p.locator("#cfg-quantos").evaluate((el) => el === document.activeElement)).toBe(
      true,
    );
    expect(() => readFileSync(arquivo())).toThrow();
  });

  it("teclado: setas, Home e End andam pelas abas", async () => {
    const p = await abrir();
    await p.locator("#aba-geral").focus();
    await p.keyboard.press("ArrowRight");
    expect(await p.locator("#aba-servidor").getAttribute("aria-selected")).toBe("true");
    await p.keyboard.press("End");
    expect(await p.locator("#aba-backups").getAttribute("aria-selected")).toBe("true");
    await p.keyboard.press("ArrowRight"); // dá a volta
    expect(await p.locator("#aba-geral").getAttribute("aria-selected")).toBe("true");
    await p.keyboard.press("ArrowLeft");
    expect(await p.locator("#aba-backups").getAttribute("aria-selected")).toBe("true");
  });

  it("nenhuma aba passa de 1,5 vez a altura da janela (dono, com tudo aparecendo)", async () => {
    const p = await abrir(true);
    await grupoChegou(p);
    await ir(p, "backups");
    await p.locator("#cfg-historico").check(); // liga o histórico: a aba mais comprida
    for (const tema of ["light", "dark"] as const) {
      await aberto?.evaluate(({ nativeTheme }, t) => void (nativeTheme.themeSource = t), tema);
      await p.emulateMedia({ colorScheme: tema });
      for (const aba of ["geral", "servidor", "backups"]) {
        await ir(p, aba);
        const [alto, janela] = await p.evaluate(() => [
          document.querySelector(".conteudo")?.scrollHeight ?? 0,
          window.innerHeight,
        ]);
        expect(alto, `aba ${aba} (${tema})`).toBeLessThanOrEqual((janela ?? 0) * 1.5);
        if (tema === "light" || aba === "backups") {
          await registrarCaptura(
            p,
            join(
              imagens,
              `configuracoes-depois-${aba}-${tema === "light" ? "claro" : "escuro"}.png`,
            ),
          );
        }
      }
    }
  });
});
