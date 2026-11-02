// Capturas em docs/imagens/ só com SABRE_CAPTURAS=1 (ex.: SABRE_CAPTURAS=1 npm run test:e2e -w apps/desktop)
import { _electron as electron } from "playwright";
import type { ElectronApplication, Page } from "playwright";
import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, describe, expect, it } from "vitest";
import { registrarCaptura } from "./captura.js";

const pastaApp = fileURLToPath(new URL("..", import.meta.url));
const imagens = fileURLToPath(new URL("../../../docs/imagens/", import.meta.url));
const semSandbox = process.getuid?.() === 0 ? ["--no-sandbox"] : [];

interface Espiao {
  spawns: { cmd: string; args: string[] }[];
}

let aberto: ElectronApplication | undefined;
let dados: string | undefined;

function dadosAtual(): string {
  if (!dados) throw new Error("sem pasta de dados");
  return dados;
}

function viva(): ElectronApplication {
  if (!aberto) throw new Error("app não aberto");
  return aberto;
}

async function abrir(
  cenario: string,
  extra: Record<string, string> = {},
  estado = cenario,
): Promise<Page> {
  dados = mkdtempSync(join(tmpdir(), "sabre-e2e-"));
  aberto = await electron.launch({
    args: [...semSandbox, `--user-data-dir=${dados}`, pastaApp],
    env: {
      ...process.env,
      SABRE_E2E: "1",
      SABRE_E2E_CENARIO: cenario,
      SABRE_E2E_REGISTRO: join(dados, "registro.txt"),
      ...extra,
    } as Record<string, string>,
    timeout: 20_000,
  });
  const pagina = await viva().firstWindow();
  await pagina.waitForLoadState("load");
  await pagina.locator(`#cartao[data-estado="${estado}"]`).waitFor();
  return pagina;
}

const espiao = (): Promise<Espiao> =>
  viva().evaluate(() => (globalThis as { __sabreE2EEspiao?: unknown }).__sabreE2EEspiao as Espiao);

async function capturar(pagina: Page, nome: string): Promise<void> {
  await viva().evaluate(({ nativeTheme }) => void (nativeTheme.themeSource = "light"));
  await pagina.emulateMedia({ colorScheme: "light" });
  await pagina.waitForTimeout(200);
  await registrarCaptura(pagina, join(imagens, `app-1.2-${nome}.png`));
  // appui-1.2: antes/depois do redesenho (SABRE_CAPTURA_SUFIXO=antes rodado no código anterior).
  const sufixo = process.env["SABRE_CAPTURA_SUFIXO"] ?? "depois";
  await registrarCaptura(pagina, join(imagens, `appui-1.2/${nome}-${sufixo}.png`));
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
    [...document.querySelectorAll<HTMLButtonElement>("#principal, #parar, #tentar")]
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

  it("dono sou eu, sem servidor (app reaberto): Hospedar de novo sem esperar a trava vencer", async () => {
    const p = await abrir("dono-eu", {}, "ninguem");
    expect(await visiveis(p)).toEqual(["Hospedar"]);
    await p.locator("#principal").click();
    await p.locator('#cartao[data-estado="eu"]').waitFor();
    expect((await espiao()).spawns).toHaveLength(1);
  });

  it("dono sou eu com servidor órfão vivo: espera ele encerrar, sem oferecer Hospedar", async () => {
    const p = await abrir("dono-eu-orfao", {}, "eu");
    await expect(p.locator("#principal").innerText()).resolves.toBe("Parando o servidor…");
    await expect(p.locator("#principal").isDisabled()).resolves.toBe(true);
    expect(await visiveis(p)).not.toContain("Hospedar");
    expect((await espiao()).spawns).toEqual([]);
  });

  it("outro PC hospeda: nome, Jogar copia o endereço e nada sobe", async () => {
    const p = await abrir("outro");
    await expect(p.locator("#status").innerText()).resolves.toBe("Servidor no PC do Lucas");
    expect(await visiveis(p)).toEqual(["Jogar"]);
    await p.locator("#principal").click();
    await expect(p.locator("#aviso").innerText()).resolves.toContain("Endereço copiado");
    await expect(p.locator("#endereco-valor").innerText()).resolves.toBe("mundo.exemplo.net");
    const copias = await viva().evaluate(
      () => (globalThis as { __sabreE2EInicio?: { copias: string[] } }).__sabreE2EInicio?.copias,
    );
    expect(copias).toEqual(["mundo.exemplo.net"]);
    expect((await espiao()).spawns).toEqual([]);
    await capturar(p, "outro");
  });

  it("depois de Jogar o endereço continua visível e o aviso some sozinho", async () => {
    const p = await abrir("eu");
    await p.locator("#principal").click();
    await expect(p.locator("#aviso").innerText()).resolves.toContain("Endereço copiado");
    await expect(p.locator("#endereco-valor").innerText()).resolves.toBe("mundo.exemplo.net");
    await p.waitForFunction(() => document.getElementById("aviso")?.textContent === "", undefined, {
      timeout: 8000,
    });
    await expect(p.locator("#endereco-valor").innerText()).resolves.toBe("mundo.exemplo.net");
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
    // A trava voltou ao cartório depois de Parar.
    const dono = await viva().evaluate(() => {
      const g = (globalThis as { __sabreE2EInicio?: { dono(): unknown } }).__sabreE2EInicio;
      return { lido: g !== undefined, dono: g?.dono() ?? null };
    });
    expect(dono).toEqual({ lido: true, dono: null });
  });

  it("sem endereço do grupo: avisa e não mostra Jogar quebrado", async () => {
    const p = await abrir("outro", { SABRE_E2E_SEM_ENDERECO: "1" });
    await expect(p.locator("#detalhe").innerText()).resolves.toBe(
      "Endereço do grupo ainda não configurado",
    );
    expect(await visiveis(p)).toEqual([]);
  });

  it.each([
    [
      "Sair da bandeja",
      () => (globalThis as { __sabreE2E?: { sair(): Promise<void> } }).__sabreE2E?.sair(),
    ],
    ["saída do sistema (app.quit)", undefined],
  ] as const)(
    "%s com o servidor no ar: para, solta a trava e só então fecha o app",
    async (_n, sair) => {
      await abrir("eu");
      const registro = join(dadosAtual(), "registro.txt");
      const saiu = new Promise<void>((ok) =>
        viva()
          .process()
          .once("exit", () => ok()),
      );
      if (sair)
        void viva()
          .evaluate(sair)
          .catch(() => undefined);
      else
        void viva()
          .evaluate(({ app: a }) => a.quit())
          .catch(() => undefined);
      await saiu;
      // Quando o processo saiu, a ordem já estava gravada: parou → soltou.
      expect(existsSync(registro)).toBe(true);
      const fatos = readFileSync(registro, "utf8").trim().split("\n");
      expect(fatos.indexOf("parou")).toBeGreaterThanOrEqual(0);
      expect(fatos.indexOf("soltar")).toBeGreaterThan(fatos.indexOf("parou"));
    },
  );
});

describe("painel de controle do Início (appui-1.2)", () => {
  const texto = (p: Page, id: string) => p.locator(`#${id}`).innerText();
  const aparece = (p: Page, id: string) => p.locator(`#${id}`).isVisible();

  it("parado: estado grande, último backup, versão do mundo; sem endereço nem jogadores", async () => {
    const p = await abrir("ninguem");
    await expect(texto(p, "status")).resolves.toBe("Ninguém está hospedando");
    await expect(p.locator("#estado").getAttribute("data-tom")).resolves.toBe("desligado");
    await expect(texto(p, "backup-valor")).resolves.toBe("há 3 horas");
    await expect(texto(p, "versao-mundo-valor")).resolves.toBe("versão 12 do mundo");
    expect(await aparece(p, "fato-endereco")).toBe(false);
    expect(await aparece(p, "fato-jogadores")).toBe(false);
    expect(await visiveis(p)).toEqual(["Hospedar"]);
    await capturar(p, "painel-parado");
  });

  it("ligado: endereço com Copiar e quem está jogando (2 jogadores, depois ninguém)", async () => {
    const p = await abrir("eu");
    await expect(p.locator("#estado").getAttribute("data-tom")).resolves.toBe("ligado");
    await expect(texto(p, "endereco-valor")).resolves.toBe("mundo.exemplo.net");
    await expect(texto(p, "jogadores-valor")).resolves.toBe("Ana, Lucas");
    expect(await visiveis(p)).toContain("Parar o servidor");
    await capturar(p, "painel-ligado");
  });

  it("com o Início aberto, a lista de quem joga se atualiza sozinha a cada 15 s (nem antes)", async () => {
    const p = await abrir("eu");
    await p.clock.install();
    await p.reload();
    await p.locator('#cartao[data-estado="eu"]').waitFor();
    await expect(texto(p, "jogadores-valor")).resolves.toBe("Ana, Lucas");
    // Lucas sai: a mudança acontece no servidor, a tela só fica sabendo no próximo refresco.
    await viva().evaluate(() => void (process.env["SABRE_E2E_JOGADORES"] = "Ana"));
    await p.clock.runFor(13_000);
    await expect(texto(p, "jogadores-valor")).resolves.toBe("Ana, Lucas"); // antes dos 15 s: nada muda
    await p.clock.runFor(7_000); // 20 s no total: o refresco é de 15 s e a tela só o arma depois de carregar
    await expect.poll(() => texto(p, "jogadores-valor"), { timeout: 15_000 }).toBe("Ana");
  });

  it("ligado sem ninguém: diz 'Ninguém por enquanto'", async () => {
    const p = await abrir("eu", { SABRE_E2E_JOGADORES: "" });
    await expect(texto(p, "jogadores-valor")).resolves.toBe("Ninguém por enquanto");
  });

  it("outro PC hospeda: não promete lista de jogadores", async () => {
    const p = await abrir("outro");
    await expect(texto(p, "jogadores-valor")).resolves.toBe(
      "Não dá para ver quem está jogando daqui",
    );
    await expect(texto(p, "endereco-valor")).resolves.toBe("mundo.exemplo.net");
  });

  it("sem dado (grupo sem backup nem versão): as linhas não aparecem", async () => {
    const p = await abrir("ninguem", { SABRE_E2E_SEM_DADOS: "1" });
    for (const id of ["fato-versao", "fato-jogadores", "fato-endereco"]) {
      expect(await aparece(p, id), id).toBe(false);
    }
    // Início v2: a grade não some, mostra "—" (nunca um número inventado).
    await expect(texto(p, "backup-valor")).resolves.toBe("—");
    await expect(texto(p, "backups-valor")).resolves.toBe("—");
  });

  it.each([
    [{ SABRE_E2E_ATUALIZANDO: "40" }, "Atualizando seu mundo… 40%"],
    [{ SABRE_E2E_TRABALHO: "restaurando" }, "Restaurando um backup…"],
    [{ SABRE_E2E_TRABALHO: "versao" }, "Trocando a versão do Minecraft…"],
  ])("trocando %j: tom de troca e Hospedar travado", async (env, frase) => {
    const p = await abrir("ninguem", env);
    await expect(texto(p, "status")).resolves.toBe(frase);
    await expect(p.locator("#estado").getAttribute("data-tom")).resolves.toBe("troca");
    await expect(p.locator("#principal").isDisabled()).resolves.toBe(true);
    await capturar(p, "painel-trocando");
  });

  it("erro: tom de atenção, só 'Tentar de novo' como ação do servidor", async () => {
    const p = await abrir("sem-cartorio");
    await expect(p.locator("#estado").getAttribute("data-tom")).resolves.toBe("atencao");
    expect(await visiveis(p)).toEqual(["Tentar de novo"]);
    expect(await aparece(p, "principal")).toBe(false);
  });

  // appuimel-2.2: o chip da barra superior acompanha o estado do servidor falso, com cor (tom) + palavra.
  it.each([
    ["ninguem", {}, "ninguem", "Desligado", "desligado"],
    ["ninguem", { SABRE_E2E_ATUALIZANDO: "40" }, "ninguem", "Ligando…", "troca"],
    ["eu", {}, "eu", "2 online", "ligado"],
    ["outro", {}, "outro", "Lucas hospeda", "ligado"],
    ["sem-cartorio", {}, "sem-cartorio", "Sem cartório", "atencao"],
  ] as const)(
    "chip de estado: cenário %s %j mostra %s",
    async (cenario, env, estado, palavra, tom) => {
      const p = await abrir(cenario, env, estado);
      await expect(p.locator("#chip-texto").innerText()).resolves.toBe(palavra);
      await expect(p.locator("#chip-estado").getAttribute("data-tom")).resolves.toBe(tom);
      await p.locator('[data-area="backups"]').click();
      await p.locator("#chip-estado").click();
      await expect(p.locator("#cartao").isVisible()).resolves.toBe(true);
    },
  );
});

// appuimel-2.4: Início v2 (cartão principal, três peças, grade de números, coluna do grupo).
describe("Início v2 (appuimel-2.4)", () => {
  const texto = (p: Page, id: string) => p.locator(`#${id}`).innerText();
  const sobra = (p: Page) =>
    p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);

  async function capturarV2(p: Page, nome: string): Promise<void> {
    for (const [tema, nome2] of [
      ["light", "claro"],
      ["dark", "escuro"],
    ] as const) {
      await viva().evaluate(({ nativeTheme }, t) => void (nativeTheme.themeSource = t), tema);
      await p.emulateMedia({ colorScheme: tema });
      await p.waitForTimeout(200);
      await registrarCaptura(p, join(imagens, `appuimel-2.4/${nome}-${nome2}.png`));
    }
  }

  const pecas = (p: Page) =>
    p.evaluate(() =>
      [...document.querySelectorAll<HTMLElement>("#pecas .peca")].map((li) => [
        li.id,
        li.dataset["tom"],
        li.querySelector("b")?.textContent,
      ]),
    );

  it("eu hospedo: versão, tempo, jogadores, RAM com contexto, coluna do grupo e Copiar", async () => {
    const p = await abrir("eu");
    await p.setViewportSize({ width: 720, height: 480 });
    await expect(texto(p, "meta")).resolves.toMatch(
      /^Minecraft 1\.21\.1 · ligado: .+ · jogadores: 2$/,
    );
    await expect(texto(p, "ram-valor")).resolves.toBe("4 GB");
    await expect(texto(p, "num-ram")).resolves.toContain("reservada, de 16 GB do PC");
    await expect(texto(p, "jogadores-valor")).resolves.toBe("Ana, Lucas");
    await expect(texto(p, "backups-valor")).resolves.toBe("7");
    await expect(texto(p, "mundo-valor")).resolves.toBe("1,2 GB");
    await expect(pecas(p)).resolves.toEqual([
      ["peca-pc", "ligado", "Hospedando"],
      ["peca-servidor", "ligado", "Ligado"],
      ["peca-grupo", "ligado", "Conectado"],
    ]);
    await p.locator("#copiar-endereco").click();
    await expect.poll(() => texto(p, "aviso")).toBe("Endereço copiado.");
    expect(await sobra(p)).toBeLessThanOrEqual(0);
    await capturarV2(p, "eu");
  });

  it("ninguém hospeda: servidor desligado, ação Hospedar, tempo e jogadores com dica", async () => {
    const p = await abrir("ninguem");
    await p.setViewportSize({ width: 720, height: 480 });
    await expect(pecas(p)).resolves.toEqual([
      ["peca-pc", "desligado", "Pode hospedar"],
      ["peca-servidor", "desligado", "Desligado"],
      ["peca-grupo", "ligado", "Conectado"],
    ]);
    await expect(texto(p, "tempo-valor")).resolves.toBe("—");
    await expect(p.locator("#num-tempo").getAttribute("title")).resolves.toBe(
      "só quem hospeda sabe",
    );
    await expect(texto(p, "backup-valor")).resolves.toBe("há 3 horas");
    expect(await visiveis(p)).toEqual(["Hospedar"]);
    expect(await sobra(p)).toBeLessThanOrEqual(0);
    await capturarV2(p, "ninguem");
  });

  it("outro PC hospeda: servidor ligado no PC dele; RAM e tempo '—' (só quem hospeda sabe)", async () => {
    const p = await abrir("outro");
    await p.setViewportSize({ width: 720, height: 480 });
    await expect(pecas(p)).resolves.toEqual([
      ["peca-pc", "desligado", "Só joga"],
      ["peca-servidor", "ligado", "Ligado"],
      ["peca-grupo", "ligado", "Conectado"],
    ]);
    await expect(texto(p, "ram-valor")).resolves.toBe("—");
    await expect(texto(p, "tempo-valor")).resolves.toBe("—");
    await expect(texto(p, "endereco-valor")).resolves.toBe("mundo.exemplo.net");
    expect(await sobra(p)).toBeLessThanOrEqual(0);
    await capturarV2(p, "outro");
  });

  it("sem cartório: grupo e este PC em atenção; grade toda '—'; sem endereço", async () => {
    const p = await abrir("sem-cartorio");
    await p.setViewportSize({ width: 720, height: 480 });
    await expect(pecas(p)).resolves.toEqual([
      ["peca-pc", "atencao", "Sem conexão"],
      ["peca-servidor", "atencao", "Sem informação"],
      ["peca-grupo", "atencao", "Sem resposta"],
    ]);
    for (const id of ["numero-jogadores", "tempo", "ram", "mundo", "backups", "backup"]) {
      await expect(texto(p, `${id}-valor`), id).resolves.toBe("—");
    }
    expect(await p.locator("#fato-endereco").isVisible()).toBe(false);
    expect(await sobra(p)).toBeLessThanOrEqual(0);
    await capturarV2(p, "sem-cartorio");
  });
});
