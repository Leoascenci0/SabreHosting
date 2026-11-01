import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
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

  it("não mostra a área Grupo a quem não é dono; cada aba mostra só as suas seções", async () => {
    const p = await abrir();
    await ir(p, "servidor");
    await p.locator("#cfg-endereco").waitFor(); // o endereço chega junto com o estado do grupo
    const legendas = (): Promise<string[]> => p.locator("legend:visible").allTextContents();
    expect(await legendas()).toEqual(["Servidor", "Endereço do servidor"]);
    await ir(p, "backups");
    expect(await legendas()).toEqual(["Backups"]);
    await ir(p, "grupo");
    expect(await legendas()).toEqual([]);
    await ir(p, "mods");
    expect(await legendas()).toEqual(["Mods do grupo"]);
    await ir(p, "geral");
    expect(await legendas()).toEqual(["Geral"]);
  });

  it("Endereço do servidor: aparece para todos, só leitura, com o endereço do cartório", async () => {
    const p = await abrir();
    await ir(p, "servidor");
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
    await ir(p, "grupo");
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

    // Sair e voltar: o texto some da tela, e nada do convite foi gravado nas preferências.
    await p.locator("#config-voltar").click();
    await p.locator("#ver-config").click();
    await ir(p, "grupo");
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
    await grupoChegou(p);
    await ir(p, "grupo");
    expect(await p.locator("#cfg-grupo").isHidden()).toBe(true);
    expect(await p.locator("#convite-criar").isVisible()).toBe(false);
  });

  it("grupo: não-dono não vê a área nem o botão", async () => {
    const p = await abrir();
    await grupoChegou(p);
    await ir(p, "grupo");
    expect(await p.locator("#cfg-grupo").isHidden()).toBe(true);
    expect(await p.locator("#grupo-lista button").count()).toBe(0);
  });

  it("grupo: dono vê os PCs; o dono não tem botão; cancelar não revoga; confirmar revoga", async () => {
    const p = await abrir(true);
    await ir(p, "grupo");
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
    await ir(p, "mods");
    await p.locator("#mods-lista li").first().waitFor();
    expect(await p.locator("#mods-lista").textContent()).toContain("Sodium");
    expect(await p.locator("#mods-adicionar").isHidden()).toBe(true);
    expect(await p.locator("#mods-lista button").count()).toBe(0);
  });

  it("mods: dono adiciona (confirma só ao tirar) e a lista segue o cartório", async () => {
    const p = await abrir(true);
    await ir(p, "mods");
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

  it("mods: aviso e erro antigos somem quando a lista volta a carregar", async () => {
    const p = await abrir(true);
    await ir(p, "mods");
    // O Electron passa o módulo do Electron antes do argumento; o argumento é o par [nome, ligado].
    const interruptor = (nome: "semInstancia" | "falhaLer", ligado: boolean): Promise<unknown> =>
      aberto?.evaluate(
        (_electron, [n, v]: [string, boolean]) => {
          const falso = (globalThis as unknown as Record<string, Record<string, boolean>>)[
            "__sabreE2EMods"
          ];
          if (falso) falso[n] = v;
        },
        [nome, ligado],
      ) as Promise<unknown>;
    const reabrir = async (): Promise<void> => {
      await p.locator("#config-voltar").click();
      await p.locator("#ver-config").click();
      await ir(p, "mods");
      await p.locator("#mods-adicionar:not([hidden])").waitFor();
    };
    const adicionar = async (nome: string, arquivo: string): Promise<void> => {
      await p.locator("#mods-nome").fill(nome);
      await p.locator("#mods-versao").fill("1.0.0");
      await p.locator("#mods-arquivo").fill(arquivo);
      await p.locator("#mods-url").fill(`https://cdn.modrinth.com/data/x/versions/y/${arquivo}`);
      await p.locator("#mods-hash").fill("c".repeat(128));
      await p.locator("#mods-adicionar-botao").click();
    };

    // Aviso: sem a pasta da instância, o aviso aparece; depois a pasta existe e o aviso some.
    await p.locator("#mods-adicionar:not([hidden])").waitFor();
    await interruptor("semInstancia", true);
    await adicionar("Lithium", "lithium.jar");
    await esperarTexto(p, "#mods-aviso", "Prism ainda não foi criada");
    await interruptor("semInstancia", false);
    await adicionar("Iris", "iris.jar"); // uma conferência que dá certo limpa o aviso no servidor
    await p.waitForFunction(() => document.querySelectorAll("#mods-lista li").length === 3);
    await reabrir();
    await p.waitForFunction(
      () => document.querySelector("#mods-aviso")?.textContent === "",
      undefined,
      {
        timeout: 5000,
      },
    );

    // Erro de leitura: some quando a leitura volta.
    await interruptor("falhaLer", true);
    await reabrir();
    const erroVisivel = (): boolean =>
      (document.querySelector("#mods-erro") as HTMLElement | null)?.hidden === false;
    await p.waitForFunction(erroVisivel, undefined, { timeout: 5000 });
    await interruptor("falhaLer", false);
    await reabrir();
    await p.waitForFunction(
      () => (document.querySelector("#mods-erro") as HTMLElement | null)?.hidden === true,
      undefined,
      {
        timeout: 5000,
      },
    );
  });

  it("mods: leitura que falha logo após uma ação com erro mantém o erro da ação", async () => {
    const p = await abrir(true);
    await ir(p, "mods");
    await p.locator("#mods-adicionar:not([hidden])").waitFor();
    // A ação lê a lista (passa), confere o link (erro de ação); a leitura logo depois da ação falha.
    const interruptorMods = (campos: Record<string, boolean | number>): Promise<unknown> =>
      aberto?.evaluate((_electron, c: Record<string, boolean | number>) => {
        const falso = (globalThis as unknown as Record<string, Record<string, unknown>>)[
          "__sabreE2EMods"
        ];
        if (falso) Object.assign(falso, c);
      }, campos) as Promise<unknown>;
    await p.locator("#mods-nome").fill("Lithium");
    await p.locator("#mods-versao").fill("0.13.0");
    await p.locator("#mods-arquivo").fill("lithium.jar");
    await p.locator("#mods-url").fill("https://evil.example/lithium.jar");
    await p.locator("#mods-hash").fill("b".repeat(128));
    await interruptorMods({ falhaLer: true, leiturasOk: 1 });
    await p.locator("#mods-adicionar-botao").click();
    // Dá tempo de a ação e a leitura (que falha) terminarem; o erro da ação tem que continuar na tela.
    await p.waitForTimeout(1000);
    expect(await p.locator("#mods-erro").textContent()).toContain("cdn.modrinth.com");
    expect(await p.locator("#mods-erro").textContent()).not.toContain("cartório");
    await interruptorMods({ falhaLer: false, leiturasOk: 0 });
  });

  it("mods: releitura depois de ação bem-sucedida mostra a falha de leitura", async () => {
    const p = await abrir(true);
    await ir(p, "mods");
    await p.locator("#mods-adicionar:not([hidden])").waitFor();
    const interruptorMods = (campos: Record<string, boolean | number>): Promise<unknown> =>
      aberto?.evaluate((_electron, c: Record<string, boolean | number>) => {
        const falso = (globalThis as unknown as Record<string, Record<string, unknown>>)[
          "__sabreE2EMods"
        ];
        if (falso) Object.assign(falso, c);
      }, campos) as Promise<unknown>;
    await p.locator("#mods-nome").fill("Iris");
    await p.locator("#mods-versao").fill("1.0.0");
    await p.locator("#mods-arquivo").fill("iris2.jar");
    await p.locator("#mods-url").fill("https://cdn.modrinth.com/data/x/versions/y/iris2.jar");
    await p.locator("#mods-hash").fill("c".repeat(128));
    // A ação lê (passa), grava com sucesso; a releitura logo depois falha e não há erro de ação na tela.
    await interruptorMods({ falhaLer: true, leiturasOk: 1 });
    await p.locator("#mods-adicionar-botao").click();
    await esperarTexto(p, "#mods-erro", "cartório agora");
    await interruptorMods({ falhaLer: false, leiturasOk: 0 });
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
    expect(await p.locator("#aba-mods").getAttribute("aria-selected")).toBe("true");
    await p.keyboard.press("ArrowRight"); // dá a volta
    expect(await p.locator("#aba-geral").getAttribute("aria-selected")).toBe("true");
    await p.keyboard.press("ArrowLeft");
    expect(await p.locator("#aba-mods").getAttribute("aria-selected")).toBe("true");
  });

  it("nenhuma aba passa de 1,5 vez a altura da janela (dono, com tudo aparecendo)", async () => {
    const p = await abrir(true);
    await grupoChegou(p);
    await ir(p, "mods");
    await p.locator("#mods-adicionar:not([hidden])").waitFor();
    await ir(p, "backups");
    await p.locator("#cfg-historico").check(); // liga o histórico: a aba mais comprida
    for (const tema of ["light", "dark"] as const) {
      await aberto?.evaluate(({ nativeTheme }, t) => void (nativeTheme.themeSource = t), tema);
      await p.emulateMedia({ colorScheme: tema });
      for (const aba of ["geral", "servidor", "backups", "grupo", "mods"]) {
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
