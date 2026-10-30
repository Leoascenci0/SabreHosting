import { isAbsolute, join, resolve } from "node:path";

export const LINK_DOWNLOAD_PRISM = "https://prismlauncher.org/download";
/** Versão mínima suportada (decidida na rodada; reversível). */
export const VERSAO_MINIMA_PRISM = 8;

export interface SistemaArquivos {
  existe(caminho: string): Promise<boolean>;
  ler(caminho: string): Promise<string>;
}

/** Roda um programa SEM shell e devolve a saída de texto. Injetado: nos testes nunca roda o `reg`. */
export type ExecArquivo = (arquivo: string, args: readonly string[]) => Promise<string>;

export interface OpcoesDetectarPrism {
  ambiente: { LOCALAPPDATA: string; APPDATA: string };
  fs: SistemaArquivos;
  /** Configurações › Geral › "Pasta do Prism"; vazio = automático. */
  pastaEscolhida?: string;
  /** Devolve o DisplayVersion do Prism no registro, ou null. Ausente fora do Windows. */
  lerRegistro?: () => Promise<string | null>;
}

export type ResultadoPrism =
  | { instalado: false; linkDownload: string }
  | {
      instalado: true;
      antigo: boolean;
      pasta: string;
      pastaInstancias: string;
      versao: string | null;
      avisos: string[];
      mensagem?: string;
    };

const EXE = "prismlauncher.exe";
const CFG = "prismlauncher.cfg";

/** Valor de `InstanceDir` na seção [General] do cfg (texto `chave=valor`); aspas e barras normalizadas. */
function lerInstanceDir(cfg: string): string | null {
  let secao = "";
  for (const bruta of cfg.split(/\r?\n/)) {
    const linha = bruta.trim();
    const sec = /^\[(.*)\]$/.exec(linha);
    if (sec) {
      secao = sec[1] ?? "";
      continue;
    }
    if (secao !== "" && secao !== "General") continue;
    const m = /^InstanceDir\s*=(.*)$/.exec(linha);
    if (!m) continue;
    const valor = (m[1] ?? "")
      .trim()
      .replace(/^"(.*)"$/, "$1")
      .replace(/\\+/g, "/");
    return valor === "" ? null : valor;
  }
  return null;
}

function inteiro(versao: string): number {
  return Number.parseInt(versao, 10);
}

export async function detectarPrism(op: OpcoesDetectarPrism): Promise<ResultadoPrism> {
  const { ambiente, fs } = op;
  const avisos: string[] = [];
  const padrao = join(ambiente.LOCALAPPDATA, "Programs", "PrismLauncher");
  const dadosPadrao = join(ambiente.APPDATA, "PrismLauncher");

  const escolhida = op.pastaEscolhida?.trim();
  const candidatas = escolhida ? [escolhida, padrao] : [padrao];
  let pasta: string | null = null;
  for (const c of candidatas) {
    if (await fs.existe(join(c, EXE))) {
      pasta = c;
      break;
    }
    if (c === escolhida) {
      avisos.push(`Não encontrei o Prism na pasta escolhida (${c}); procurei nos lugares padrão.`);
    }
  }

  let pastaDados: string;
  let portatil = false;
  if (pasta !== null) {
    portatil = await fs.existe(join(pasta, CFG));
    pastaDados = portatil ? pasta : dadosPadrao;
  } else if (await fs.existe(join(dadosPadrao, CFG))) {
    pasta = pastaDados = dadosPadrao;
    avisos.push("Achei só os dados do Prism, não o programa; a versão não pôde ser conferida.");
  } else {
    return { instalado: false, linkDownload: LINK_DOWNLOAD_PRISM };
  }

  let instanceDir = "instances";
  const caminhoCfg = join(pastaDados, CFG);
  if (await fs.existe(caminhoCfg)) {
    instanceDir = lerInstanceDir(await fs.ler(caminhoCfg)) ?? instanceDir;
  }
  const pastaInstancias =
    /^[A-Za-z]:\//.test(instanceDir) || isAbsolute(instanceDir)
      ? resolve(instanceDir)
      : join(pastaDados, instanceDir);

  let versao: string | null = null;
  if (portatil) {
    avisos.push("Prism portátil: não consigo saber a versão; vou assumir que serve.");
  } else if (avisos.every((a) => !a.startsWith("Achei só os dados"))) {
    try {
      versao = (await op.lerRegistro?.()) ?? null;
    } catch {
      versao = null;
    }
    if (versao === null)
      avisos.push("Não consegui descobrir a versão do Prism; vou assumir que serve.");
  }

  const antigo = versao !== null && inteiro(versao) < VERSAO_MINIMA_PRISM;
  return {
    instalado: true,
    antigo,
    pasta,
    pastaInstancias,
    versao,
    avisos,
    ...(antigo
      ? {
          mensagem: `O Prism ${versao} é antigo demais. Atualize para a versão ${VERSAO_MINIMA_PRISM}.0 ou mais nova em ${LINK_DOWNLOAD_PRISM}.`,
        }
      : {}),
  };
}

const CHAVES_DESINSTALACAO = [
  "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
  "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
];

/** Lê o DisplayVersion do Prism nas chaves de desinstalação via `reg query` (sem shell, argumentos fixos). */
export async function lerRegistroWindows(exec: ExecArquivo): Promise<string | null> {
  for (const chave of CHAVES_DESINSTALACAO) {
    let saida: string;
    try {
      saida = await exec("reg", ["query", chave, "/s", "/v", "DisplayVersion"]);
    } catch {
      continue;
    }
    let eDoPrism = false;
    for (const linha of saida.split(/\r?\n/)) {
      if (linha.startsWith("HKEY_")) {
        eDoPrism = /prism\s*launcher/i.test(linha);
        continue;
      }
      const m = /^\s*DisplayVersion\s+REG_SZ\s+(\S+)/.exec(linha);
      if (eDoPrism && m) return m[1] ?? null;
    }
  }
  return null;
}
