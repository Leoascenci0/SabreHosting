import { execFile } from "node:child_process";
import { isAbsolute, join, resolve } from "node:path";

export const LINK_DOWNLOAD_PRISM = "https://prismlauncher.org/download";
/** Versão mínima suportada (decidida na rodada; reversível). */
export const VERSAO_MINIMA_PRISM = "8.0.0";

export interface SistemaArquivos {
  existe(caminho: string): Promise<boolean>;
  ler(caminho: string): Promise<string>;
}

/** Roda um programa SEM shell e devolve a saída de texto. Injetável: nos testes nunca roda o `reg`. */
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
    const valor = (m[1] ?? "").trim().replace(/^"(.*)"$/, "$1");
    if (valor === "") return null;
    // Caminho de rede (\\servidor\pasta) mantém as duas barras iniciais.
    const rede = /^(\\\\|\/\/)/.test(valor);
    const limpo = valor.replace(/[\\/]+/g, "/");
    return rede ? `/${limpo}` : limpo;
  }
  return null;
}

/** "8.0.0-rc1" -> [8, 0, 0]; parte que falta vale 0 ("8.1" = 8.1.0); null se não começa por número. */
function partesDaVersao(versao: string): [number, number, number] | null {
  const m = /^\s*(\d+)(?:\.(\d+))?(?:\.(\d+))?/.exec(versao);
  return m ? [Number(m[1]), Number(m[2] ?? 0), Number(m[3] ?? 0)] : null;
}

/** Compara major.minor.patch: negativo se `a` < `b`, 0 se iguais, positivo se `a` > `b`; null se ilegível. */
export function compararVersoes(a: string, b: string): number | null {
  const pa = partesDaVersao(a);
  const pb = partesDaVersao(b);
  if (!pa || !pb) return null;
  return pa[0] - pb[0] || pa[1] - pb[1] || pa[2] - pb[2];
}

export async function detectarPrism(op: OpcoesDetectarPrism): Promise<ResultadoPrism> {
  const { ambiente } = op;
  // Pasta sem permissão ou arquivo travado conta como "não existe", nunca derruba a detecção.
  const fs: SistemaArquivos = {
    existe: (c) => op.fs.existe(c).catch(() => false),
    ler: (c) => op.fs.ler(c),
  };
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
  let soDados = false;
  if (pasta !== null) {
    portatil = await fs.existe(join(pasta, CFG));
    pastaDados = portatil ? pasta : dadosPadrao;
  } else if (await fs.existe(join(dadosPadrao, CFG))) {
    pasta = pastaDados = dadosPadrao;
    soDados = true;
    avisos.push("Achei só os dados do Prism, não o programa; a versão não pôde ser conferida.");
  } else {
    return { instalado: false, linkDownload: LINK_DOWNLOAD_PRISM };
  }

  let instanceDir = "instances";
  const caminhoCfg = join(pastaDados, CFG);
  if (await fs.existe(caminhoCfg)) {
    try {
      instanceDir = lerInstanceDir(await fs.ler(caminhoCfg)) ?? instanceDir;
    } catch {
      avisos.push(
        "Não consegui ler a configuração do Prism (arquivo travado ou sem permissão); usei a pasta de instâncias padrão.",
      );
    }
  }
  const rede = instanceDir.startsWith("//");
  const pastaInstancias = rede
    ? instanceDir
    : /^[A-Za-z]:\//.test(instanceDir) || isAbsolute(instanceDir)
      ? resolve(instanceDir)
      : join(pastaDados, instanceDir);

  let versao: string | null = null;
  if (portatil) {
    avisos.push("Prism portátil: não consigo saber a versão; vou assumir que serve.");
  } else if (!soDados) {
    try {
      versao = (await op.lerRegistro?.()) ?? null;
    } catch {
      versao = null;
    }
    if (versao === null)
      avisos.push("Não consegui descobrir a versão do Prism; vou assumir que serve.");
  }

  const antigo = versao !== null && (compararVersoes(versao, VERSAO_MINIMA_PRISM) ?? 0) < 0;
  return {
    instalado: true,
    antigo,
    pasta,
    pastaInstancias,
    versao,
    avisos,
    ...(antigo
      ? {
          mensagem: `O Prism ${versao} é antigo demais. Atualize para a versão ${VERSAO_MINIMA_PRISM} ou mais nova em ${LINK_DOWNLOAD_PRISM}.`,
        }
      : {}),
  };
}

const CHAVES_DESINSTALACAO = [
  "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
  "HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall",
];

const PRAZO_REG_MS = 5000;

export const execReal: ExecArquivo = (arquivo, args) =>
  new Promise((ok, falha) => {
    execFile(
      arquivo,
      [...args],
      { shell: false, timeout: PRAZO_REG_MS, windowsHide: true, encoding: "utf8" },
      (erro, saida) => (erro ? falha(erro) : ok(saida)),
    );
  });

export interface OpcoesRegistro {
  exec?: ExecArquivo;
  prazoMs?: number;
  plataforma?: string;
}

/**
 * Lê o DisplayVersion do Prism nas chaves de desinstalação via `reg query` (sem shell, argumentos fixos,
 * com prazo). Devolve null em erro, prazo estourado ou fora do Windows.
 */
export async function lerRegistroWindows(op: OpcoesRegistro = {}): Promise<string | null> {
  if ((op.plataforma ?? process.platform) !== "win32") return null;
  const exec = op.exec ?? execReal;
  const prazo = op.prazoMs ?? PRAZO_REG_MS;
  for (const chave of CHAVES_DESINSTALACAO) {
    let saida: string;
    let timer: NodeJS.Timeout | undefined;
    try {
      saida = await Promise.race([
        exec("reg", ["query", chave, "/s", "/v", "DisplayVersion"]),
        new Promise<never>((_, falha) => {
          timer = setTimeout(() => falha(new Error("prazo")), prazo);
        }),
      ]);
    } catch {
      continue;
    } finally {
      clearTimeout(timer);
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
