import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  detectarPrism,
  lerRegistroWindows,
  type ExecArquivo,
  type SistemaArquivos,
} from "./prism.js";

const fs: SistemaArquivos = {
  async existe(caminho) {
    return stat(caminho).then(
      () => true,
      () => false,
    );
  },
  ler: (caminho) => readFile(caminho, "utf8"),
};

let raiz: string;
let ambiente: { LOCALAPPDATA: string; APPDATA: string };

beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), "prism-"));
  ambiente = { LOCALAPPDATA: join(raiz, "local"), APPDATA: join(raiz, "roaming") };
});
afterEach(() => rm(raiz, { recursive: true, force: true }));

async function criar(caminho: string, texto = ""): Promise<void> {
  await mkdir(join(caminho, ".."), { recursive: true });
  await writeFile(caminho, texto);
}

const instalacaoPadrao = () => join(ambiente.LOCALAPPDATA, "Programs", "PrismLauncher");
const dados = () => join(ambiente.APPDATA, "PrismLauncher");
const registro = (v: string | null) => async () => v;

describe("detectarPrism", () => {
  it("acha a instalação padrão, a versão e as instâncias padrão", async () => {
    await criar(join(instalacaoPadrao(), "prismlauncher.exe"));
    await mkdir(dados(), { recursive: true });
    const r = await detectarPrism({ ambiente, fs, lerRegistro: registro("9.2") });
    expect(r).toEqual({
      instalado: true,
      antigo: false,
      pasta: instalacaoPadrao(),
      pastaInstancias: join(dados(), "instances"),
      versao: "9.2",
      avisos: [],
    });
  });

  it("InstanceDir relativo vale a partir da pasta de dados (com aspas e barras)", async () => {
    await criar(join(instalacaoPadrao(), "prismlauncher.exe"));
    await criar(
      join(dados(), "prismlauncher.cfg"),
      '[General]\r\nLanguage=pt_BR\r\nInstanceDir="meus\\\\jogos/inst"\r\n',
    );
    const r = await detectarPrism({ ambiente, fs, lerRegistro: registro("9.2") });
    expect(r).toMatchObject({ pastaInstancias: join(dados(), "meus", "jogos", "inst") });
  });

  it("InstanceDir absoluto é respeitado", async () => {
    await criar(join(instalacaoPadrao(), "prismlauncher.exe"));
    const abs = join(raiz, "D", "Instancias");
    await criar(join(dados(), "prismlauncher.cfg"), `[General]\nInstanceDir=${abs}\n`);
    const r = await detectarPrism({ ambiente, fs, lerRegistro: registro("9.2") });
    expect(r).toMatchObject({ pastaInstancias: abs });
  });

  it("portátil: pasta escolhida com .exe e .cfg; versão desconhecida com aviso", async () => {
    const pasta = join(raiz, "Jogos", "Prism");
    await criar(join(pasta, "prismlauncher.exe"));
    await criar(join(pasta, "prismlauncher.cfg"), "[General]\nInstanceDir=inst\n");
    const r = await detectarPrism({
      ambiente,
      fs,
      pastaEscolhida: pasta,
      lerRegistro: registro("1.0"),
    });
    expect(r).toMatchObject({
      instalado: true,
      antigo: false,
      pasta,
      pastaInstancias: join(pasta, "inst"),
      versao: null,
    });
    expect(r.instalado && r.avisos.join(" ")).toMatch(/portátil/i);
  });

  it("a pasta escolhida vence a instalação padrão", async () => {
    await criar(join(instalacaoPadrao(), "prismlauncher.exe"));
    const pasta = join(raiz, "Outra");
    await criar(join(pasta, "prismlauncher.exe"));
    const r = await detectarPrism({
      ambiente,
      fs,
      pastaEscolhida: pasta,
      lerRegistro: registro("9.0"),
    });
    expect(r).toMatchObject({ pasta });
  });

  it("pasta escolhida sem Prism avisa e cai para a instalação padrão", async () => {
    await criar(join(instalacaoPadrao(), "prismlauncher.exe"));
    const r = await detectarPrism({
      ambiente,
      fs,
      pastaEscolhida: join(raiz, "vazia"),
      lerRegistro: registro("9.0"),
    });
    expect(r).toMatchObject({ instalado: true, pasta: instalacaoPadrao() });
    expect(r.instalado && r.avisos.join(" ")).toMatch(/não encontrei o Prism/i);
  });

  it("só a pasta de dados existe: instalado, sem versão, com aviso", async () => {
    await criar(join(dados(), "prismlauncher.cfg"), "[General]\n");
    const r = await detectarPrism({ ambiente, fs, lerRegistro: registro("9.0") });
    expect(r).toMatchObject({ instalado: true, pasta: dados(), versao: null });
    expect(r.instalado && r.avisos.length).toBeGreaterThan(0);
  });

  it("ausente: devolve o link oficial", async () => {
    const r = await detectarPrism({ ambiente, fs, lerRegistro: registro("9.0") });
    expect(r).toEqual({ instalado: false, linkDownload: "https://prismlauncher.org/download" });
  });

  it("versão antiga demais (7.2 < 8.0): avisa em pt-BR", async () => {
    await criar(join(instalacaoPadrao(), "prismlauncher.exe"));
    const r = await detectarPrism({ ambiente, fs, lerRegistro: registro("7.2") });
    expect(r).toMatchObject({ instalado: true, antigo: true, versao: "7.2" });
    expect(r.instalado && r.mensagem).toMatch(/versão 8\.0/);
  });

  it("registro sem a chave: versão null com aviso, não é antigo", async () => {
    await criar(join(instalacaoPadrao(), "prismlauncher.exe"));
    const r = await detectarPrism({ ambiente, fs, lerRegistro: registro(null) });
    expect(r).toMatchObject({ instalado: true, antigo: false, versao: null });
    expect(r.instalado && r.avisos.length).toBe(1);
  });

  it("sem lerRegistro (fora do Windows): versão null", async () => {
    await criar(join(instalacaoPadrao(), "prismlauncher.exe"));
    const r = await detectarPrism({ ambiente, fs });
    expect(r).toMatchObject({ instalado: true, versao: null });
  });

  it("erro ao ler o registro não derruba a detecção", async () => {
    await criar(join(instalacaoPadrao(), "prismlauncher.exe"));
    const r = await detectarPrism({
      ambiente,
      fs,
      lerRegistro: async () => {
        throw new Error("boom");
      },
    });
    expect(r).toMatchObject({ instalado: true, versao: null });
  });
});

describe("lerRegistroWindows", () => {
  const saida = [
    "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\Outro",
    "    DisplayVersion    REG_SZ    1.2.3",
    "",
    "HKEY_CURRENT_USER\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\PrismLauncher",
    "    DisplayVersion    REG_SZ    9.4",
    "",
  ].join("\r\n");

  it("usa execFile sem shell, argumentos fixos, e lê a versão do Prism", async () => {
    const chamadas: Array<[string, readonly string[]]> = [];
    const exec: ExecArquivo = async (arq, args) => {
      chamadas.push([arq, args]);
      return saida;
    };
    expect(await lerRegistroWindows(exec)).toBe("9.4");
    expect(chamadas[0]?.[0]).toBe("reg");
    expect(chamadas[0]?.[1]).toEqual(
      expect.arrayContaining(["query", "/s", "/v", "DisplayVersion"]),
    );
  });

  it("sem a chave ou com erro do reg: null", async () => {
    expect(await lerRegistroWindows(async () => "")).toBeNull();
    expect(
      await lerRegistroWindows(async () => {
        throw new Error("não achou");
      }),
    ).toBeNull();
  });
});
