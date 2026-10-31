import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { gerarPropriedades } from "@sabrehosting/nucleo/servidor/configurar";
import { afterEach, describe, expect, it } from "vitest";

const pastaApp = fileURLToPath(new URL("..", import.meta.url));
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
    expect(await p.locator("#cfg-visao").inputValue()).toBe("12");
  });

  it("backups: intervalo inválido não salva; o valor salvo muda o intervalo do agendador", async () => {
    // Cenário "eu": este PC hospeda; quando o servidor fica pronto o agendador do núcleo liga com o padrão (10 min).
    const p = await abrir(false, "eu");
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

  it("não mostra a área Grupo a quem não é dono", async () => {
    const p = await abrir();
    await p.locator("#cfg-endereco").waitFor(); // o endereço chega junto com o estado do grupo
    expect(await p.locator("legend:visible").allTextContents()).toEqual([
      "Geral",
      "Servidor",
      "Backups",
      "Endereço do servidor",
      "Mods do grupo",
    ]);
  });

  it("Endereço do servidor: aparece para todos, só leitura, com o endereço do cartório", async () => {
    const p = await abrir();
    await p.locator("#cfg-endereco").waitFor();
    const campo = p.locator("#grupo-endereco");
    expect(await campo.inputValue()).toBe("mundo.exemplo.net");
    expect(await campo.isEditable()).toBe(false);
  });

  const revogados = (): Promise<number[]> =>
    aberto?.evaluate(
      () =>
        (globalThis as unknown as { __sabreE2EGrupo: { revogados: number[] } }).__sabreE2EGrupo
          .revogados,
    ) as Promise<number[]>;

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
    expect(await aberto?.evaluate(({ clipboard }) => clipboard.readText())).toBe(texto);

    // Sair e voltar: o texto some da tela, e nada do convite foi gravado nas preferências.
    await p.locator("#config-voltar").click();
    await p.locator("#ver-config").click();
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

  it("convite: amigo (não-dono) não vê o formulário", async () => {
    const p = await abrir(false);
    await p.locator("#cfg-endereco").waitFor();
    expect(await p.locator("#cfg-grupo").isHidden()).toBe(true);
    expect(await p.locator("#convite-criar").isVisible()).toBe(false);
  });

  it("grupo: não-dono não vê a área nem o botão", async () => {
    const p = await abrir();
    await p.locator("#cfg-visao").waitFor();
    expect(await p.locator("#cfg-grupo").isHidden()).toBe(true);
    expect(await p.locator("#grupo-lista button").count()).toBe(0);
  });

  it("grupo: dono vê os PCs; o dono não tem botão; cancelar não revoga; confirmar revoga", async () => {
    const p = await abrir(true);
    await p.locator("#grupo-lista li").first().waitFor();
    expect(await p.locator("#grupo-lista li").count()).toBe(3);
    expect(await p.locator("#grupo-lista button").count()).toBe(2); // sem botão no dono
    expect(await p.locator("#grupo-lista button").first().textContent()).toBe("Tirar PC do grupo");

    // Cancelar: a pergunta cita o NOME do PC e nada é revogado.
    await p
      .locator("#grupo-lista li", { hasText: "Lucas" })
      .getByRole("button", { name: "Tirar PC do grupo" })
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
      .getByRole("button", { name: "Tirar PC do grupo" })
      .click();
    await p.locator("#grupo-confirmar").click();
    await esperarTexto(p, "#grupo-aviso", "PC do Lucas saiu do grupo");
    expect(await revogados()).toEqual([2]);
    expect(await p.locator("#grupo-lista li").count()).toBe(2);
    // O foco não se perde: vai ao aviso; e o botão não tem aria-label que esconda o texto visível.
    expect(await p.evaluate(() => document.activeElement?.id)).toBe("grupo-aviso");
    expect(await p.locator("#grupo-lista button[aria-label]").count()).toBe(0);
  });
  const listasDeMods = (): Promise<Array<Array<{ arquivo: string }>>> =>
    aberto?.evaluate(
      () =>
        (globalThis as unknown as { __sabreE2EMods: { listas: unknown[] } }).__sabreE2EMods.listas,
    ) as Promise<Array<Array<{ arquivo: string }>>>;

  it("mods: amigo vê a lista, mas não tem como editar", async () => {
    const p = await abrir();
    await p.locator("#mods-lista li").first().waitFor();
    expect(await p.locator("#mods-lista").textContent()).toContain("Sodium");
    expect(await p.locator("#mods-adicionar").isHidden()).toBe(true);
    expect(await p.locator("#mods-lista button").count()).toBe(0);
  });

  it("mods: dono adiciona (confirma só ao tirar) e a lista segue o cartório", async () => {
    const p = await abrir(true);
    await p.locator("#mods-adicionar:not([hidden])").waitFor();
    await p.locator("#mods-nome").fill("Lithium");
    await p.locator("#mods-versao").fill("0.13.0");
    await p.locator("#mods-arquivo").fill("lithium.jar");
    await p.locator("#mods-url").fill("https://evil.example/lithium.jar");
    await p.locator("#mods-hash").fill("b".repeat(128));
    await p.locator("#mods-adicionar-botao").click();
    await esperarTexto(p, "#mods-erro", "cdn.modrinth.com");
    expect(await listasDeMods()).toEqual([]); // link de outro site: nada gravado
    await p.locator("#mods-url").fill("https://cdn.modrinth.com/data/x/versions/y/lithium.jar");
    await p.locator("#mods-adicionar-botao").click();
    await p.waitForFunction(() => document.querySelectorAll("#mods-lista li").length === 2);
    expect((await listasDeMods())[0]?.map((m) => m.arquivo)).toEqual(["sodium.jar", "lithium.jar"]);

    await p.locator("#mods-lista li", { hasText: "Sodium" }).getByRole("button").click();
    await esperarTexto(p, "#mods-pergunta", "Sodium");
    await p.locator("#mods-cancelar").click();
    expect((await listasDeMods()).length).toBe(1); // cancelar não grava
    await p.locator("#mods-lista li", { hasText: "Sodium" }).getByRole("button").click();
    await p.locator("#mods-confirmar").click();
    await p.waitForFunction(() => document.querySelectorAll("#mods-lista li").length === 1);
    expect((await listasDeMods())[1]?.map((m) => m.arquivo)).toEqual(["lithium.jar"]);
  });

  it("versão: não-dono não vê a área", async () => {
    const p = await abrir();
    await p.locator("#cfg-visao").waitFor();
    expect(await p.locator("#cfg-versao-area").isHidden()).toBe(true);
  });

  it("versão: dono vê o que roda; cancelar não grava; confirmar grava", async () => {
    const p = await abrir(true);
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
