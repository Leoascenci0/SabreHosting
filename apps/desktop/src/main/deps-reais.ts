import type { SpawnOptions, ChildProcess } from "node:child_process";
import { access, readdir, readFile, readlink, realpath, stat } from "node:fs/promises";
import { join } from "node:path";
import { criarCliente } from "@sabrehosting/nucleo/cartorio/cliente";
import { hospedar } from "@sabrehosting/nucleo/cartorio/hospedar";
import { gravarConfiguracao } from "@sabrehosting/nucleo/servidor/configurar";
import { abrirJogo } from "@sabrehosting/nucleo/launcher/abrir";
import { idDaInstancia, temMarcadorSabre } from "@sabrehosting/nucleo/launcher/instancia";
import {
  detectarPrism,
  lerRegistroWindows,
  LINK_DOWNLOAD_PRISM,
  type ExecArquivo,
  type ResultadoPrism,
} from "@sabrehosting/nucleo/launcher/prism";
import { ambienteLegado, ENDERECO_VALIDO, nomeDoMundo, type ConfigPc } from "./config-pc.js";
import { erroSemGrupo, type DepsInicio } from "./inicio.js";
import { lerPreferencias, opcoesDoServidor } from "./preferencias.js";
import { ipDaRedePrivada } from "./servir-arquivos.js";

/** Ganchos só dos testes: rede e processo falsos no lugar dos reais. */
export interface ExtrasDepsReais {
  /** Pasta dos dados do app (onde mora `preferencias.json`); sem ela valem as distâncias padrão. */
  pastaDados?: string;
  /** IP deste PC no túnel privado; o padrão lê a interface do WireGuard. */
  ipPrivado?: () => string | undefined;
  fetchFn?: typeof fetch;
  spawnFn?: (cmd: string, args: readonly string[], opcoes: SpawnOptions) => ChildProcess;
  prefixoArgs?: string[];
  plataforma?: NodeJS.Platform;
  /** Pasta no lugar de `/proc` (Linux). */
  raizProc?: string;
  /** Acha o Prism; o padrão olha o PC de verdade. */
  detectarPrism?: () => Promise<ResultadoPrism>;
  /** Dispara o Prism; o padrão é o do núcleo (sem shell). */
  execPrism?: ExecArquivo;
}

const existe = (c: string): Promise<boolean> =>
  access(c).then(
    () => true,
    () => false,
  );

/** `detectarPrism` com o Windows de verdade (pastas do usuário e registro). Sem as pastas do usuário: não instalado. */
function detectarPrismReal(): Promise<ResultadoPrism> {
  const { LOCALAPPDATA, APPDATA } = process.env;
  if (!LOCALAPPDATA || !APPDATA) {
    return Promise.resolve({ instalado: false, linkDownload: LINK_DOWNLOAD_PRISM });
  }
  return detectarPrism({
    ambiente: { LOCALAPPDATA, APPDATA },
    fs: { existe, ler: (c) => readFile(c, "utf8") },
    ...(process.platform === "win32" ? { lerRegistro: () => lerRegistroWindows() } : {}),
  });
}

/**
 * Pasta `mods` da instância do grupo no Prism (lancmel-2.1 sincroniza nela). Só devolve se a instância já existe
 * (marcador do SabreHosting) e a pasta `mods` já está lá: nunca cria nada dentro do Prism do amigo.
 */
export async function pastaModsDaInstancia(
  grupo: string | undefined,
  detectar: () => Promise<ResultadoPrism> = detectarPrismReal,
): Promise<string | undefined> {
  if (!grupo) return undefined;
  try {
    const prism = await detectar();
    if (!prism.instalado) return undefined;
    const instancia = join(prism.pastaInstancias, idDaInstancia(grupo));
    if (!(await temMarcadorSabre(join(instancia, "SabreHosting")))) return undefined;
    for (const sub of ["minecraft", ".minecraft"]) {
      const mods = join(instancia, sub, "mods");
      if (await existe(mods)) return mods;
    }
  } catch {
    // Prism ilegível: o aviso "instância ainda não criada" da tela de mods cobre.
  }
  return undefined;
}

/**
 * Há servidor vivo na pasta (sobra de app fechado à força com o Java no ar)? Lado seguro: `true` também quando não
 * dá para saber, e quem chama trata erro como `true`.
 */
async function servidorNaPasta(
  pasta: string,
  plataforma: NodeJS.Platform,
  raizProc = "/proc",
): Promise<boolean> {
  if (plataforma === "linux") {
    const alvo = await realpath(pasta);
    const ausente = (e: unknown) => (e as NodeJS.ErrnoException).code === "ENOENT";
    for (const pid of await readdir(raizProc)) {
      if (!/^\d+$/.test(pid) || Number(pid) === process.pid) continue;
      try {
        // Processo de outro usuário não é o Java deste app (que roda como o próprio usuário).
        if ((await stat(join(raizProc, pid))).uid !== process.getuid?.()) continue;
        if ((await readlink(join(raizProc, pid, "cwd"))) === alvo) return true;
      } catch (e) {
        if (!ausente(e)) return true; // processo que não deixa conferir: talvez seja o órfão
      }
    }
    return false;
  }
  if (plataforma === "win32") {
    // O Java prende o session.lock do mundo com trava obrigatória do Windows: ler falha enquanto ele vive.
    const mundo = await nomeDoMundo(pasta);
    try {
      await readFile(join(pasta, mundo, "session.lock"));
      return false;
    } catch (e) {
      return (e as NodeJS.ErrnoException).code !== "ENOENT";
    }
  }
  return true;
}

/** O cliente do cartório feito de variáveis `SABRE_*`; `exigir()` lança o erro de "sem grupo" quando falta ou é inválido. */
export function clienteDoAmbiente(
  env: NodeJS.ProcessEnv,
  fetchFn?: typeof fetch,
): () => ReturnType<typeof criarCliente> {
  const { SABRE_CARTORIO_URL: url, SABRE_CARTORIO_TOKEN: token } = env;
  let cliente: ReturnType<typeof criarCliente> | undefined;
  let falha: unknown;
  if (url && token) {
    try {
      cliente = criarCliente({
        url,
        cofre: { guardar: async () => {}, ler: async () => token },
        ...(fetchFn ? { fetchFn } : {}),
      });
    } catch (e) {
      falha = e;
    }
  }
  return () => {
    if (cliente) return cliente;
    throw falha ?? erroSemGrupo();
  };
}

/** O cliente do cartório feito da configuração do PC (endereço gravado pelo assistente + token do cofre). */
export function clienteDoPc(config: ConfigPc, fetchFn?: typeof fetch) {
  return clienteDoAmbiente(ambienteLegado(config), fetchFn);
}

/** Tudo vem da configuração do PC (`config-pc.ts`): nada de `SABRE_*` do ambiente entra por aqui. */
export function depsReais(
  config: ConfigPc,
  copiar: (texto: string) => void,
  extras: ExtrasDepsReais = {},
): DepsInicio {
  const { pastaServidor: pasta, java, neoforge } = config;
  const exigir = clienteDoPc(config, extras.fetchFn);
  let endereco = config.enderecoGravado ?? "";
  return {
    lerTrava: async () => exigir().estadoTrava(),
    // Único caminho que sobe o servidor: pega a trava antes e devolve depois (regra de ouro 1).
    hospedar: async (aoPerder) => {
      if (!pasta || !java || !neoforge) {
        throw new Error("Este PC ainda não está configurado para hospedar o servidor.");
      }
      // O servidor só escuta no IP do túnel privado (regra de segurança): sem túnel, nem grava nem sobe.
      const ip = (extras.ipPrivado ?? ipDaRedePrivada)();
      if (!ip) {
        throw new Error(
          "A rede privada do grupo não está ativa neste PC. Ative a conexão e tente Hospedar de novo.",
        );
      }
      // As distâncias de Configurações › Servidor entram no server.properties antes de subir.
      const prefs = extras.pastaDados ? opcoesDoServidor(lerPreferencias(extras.pastaDados)) : {};
      await gravarConfiguracao(pasta, { ipRedePrivada: ip, ...prefs });
      return hospedar({
        cliente: exigir(),
        aoPerder,
        pasta,
        javaPath: java,
        versaoNeoForge: neoforge,
        ...(extras.spawnFn ? { spawnFn: extras.spawnFn } : {}),
        ...(extras.prefixoArgs ? { prefixoArgs: extras.prefixoArgs } : {}),
        ...(extras.plataforma ? { plataforma: extras.plataforma } : {}),
      });
    },
    eu: async () => exigir().eu(),
    // Sem pasta não dá para conferir: na dúvida, não oferece Hospedar (que também recusaria sem configuração).
    servidorOrfao: async () =>
      pasta ? servidorNaPasta(pasta, extras.plataforma ?? process.platform, extras.raizProc) : true,
    get endereco() {
      return endereco;
    },
    // O cartório é quem sabe o endereço (GET /grupo); sem resposta, vale o último conhecido.
    atualizarEndereco: async () => {
      try {
        const novo = (await exigir().grupo()).endereco_jogar;
        if (ENDERECO_VALIDO.test(novo)) endereco = novo; // resposta torta não troca o endereço bom
      } catch {
        // cartório fora do ar ou sem grupo: mantém o endereço que já tinha
      }
    },
    abrirJogo: async (alvo) => {
      if (!config.grupo) return { ok: false, mensagem: "Este PC ainda não entrou no grupo." };
      try {
        const prism = await (extras.detectarPrism ?? detectarPrismReal)();
        if (!prism.instalado) {
          return {
            ok: false,
            mensagem: `O Prism Launcher não está instalado. Baixe em ${prism.linkDownload}.`,
          };
        }
        if (prism.antigo) {
          return {
            ok: false,
            mensagem: prism.mensagem ?? "O Prism instalado é antigo demais. Atualize-o.",
          };
        }
        return await abrirJogo({
          exe: join(prism.pasta, "prismlauncher.exe"),
          pastaInstancias: prism.pastaInstancias,
          idInstancia: idDaInstancia(config.grupo),
          endereco: alvo,
          ...(extras.execPrism ? { exec: extras.execPrism } : {}),
        });
      } catch {
        return {
          ok: false,
          mensagem: "Não consegui abrir o Prism agora. Confira se ele está instalado.",
        };
      }
    },
    copiar,
  };
}
