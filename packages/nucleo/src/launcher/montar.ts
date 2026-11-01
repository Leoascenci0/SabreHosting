import { mkdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createHash, randomBytes } from "node:crypto";
import { dirname, join, relative, resolve, sep } from "node:path";
import { baixarConferido, type OpcoesDownload } from "../servidor/baixar.js";
import { hashDoArquivo } from "../integridade/hash.js";
import { extrairJava } from "./zip.js";
import { resolverAdoptium } from "../servidor/resolvedores.js";
import { URL_MANIFESTO, urlAdoptium, buscarPadrao, type Buscar } from "../servidor/versoes.js";

/**
 * Baixar e montar a versão do jogo (lanc-2.3): a partir do manifesto oficial de versões da Mojang (formato
 * documentado), baixa cliente, bibliotecas e assets, tudo com hash conferido, num cache compartilhado entre
 * instâncias. Nada é distribuído pelo SabreHosting: os arquivos vêm direto dos servidores oficiais.
 * Cada arquivo entra por troca atômica (`baixarConferido`); o marcador `.montada.json` é o último a ser gravado.
 */
export type Baixar = (o: OpcoesDownload) => Promise<{ caminho: string; doCache: boolean }>;

export interface OpcoesMontar {
  versao: string;
  /** Raiz do cache compartilhado (`versions`, `libraries`, `assets`, `java`). */
  cache: string;
  buscar?: Buscar;
  baixar?: Baixar;
  /** Baixa o pacote do Java (Adoptium, sha256 conferido), extrai no cache e aponta o `javaw`. */
  java?: boolean;
  /** Só para teste: libera http em 127.0.0.1/[::1] nos downloads. Nunca ligado pelo app. */
  permitirHttpLocal?: boolean;
  /** Chamado a cada peça pronta (para a barra de progresso). */
  aoProgredir?: (feitos: number, total: number) => void;
}

export interface VersaoMontada {
  jarCliente: string;
  bibliotecas: string[];
  assets: number;
  javaMajor: number;
  pacoteJava?: string;
  /** Caminho do `javaw.exe` extraído (só com `java: true`). */
  javaw?: string;
  /** Pasta dos assets (`objects` + `indexes`) e id do índice, para a linha de comando do jogo. */
  pastaAssets: string;
  idIndiceAssets: string;
}

const HOSTS_JSON = new Set(["piston-meta.mojang.com", "launcher.mojang.com"]);
const HOSTS_ARQUIVOS = [
  "piston-data.mojang.com",
  "launcher.mojang.com",
  "libraries.minecraft.net",
  "resources.download.minecraft.net",
];
const ID_VERSAO = /^1\.\d{1,2}(\.\d{1,2})?$/;
const SHA1 = /^[0-9a-f]{40}$/i;
const PARALELO = 8;
const TETO_PECA = 512 * 1024 ** 2;
const TETO_JSON = 64 * 1024 ** 2;

/** Hosts reais do pacote do Java (Adoptium publica no GitHub Releases; o link redireciona para o CDN dele). */
const HOSTS_JAVA = [
  "github.com",
  "objects.githubusercontent.com",
  "release-assets.githubusercontent.com",
];

/**
 * Baixa para um nome temporário único (pid + aleatório) e só então renomeia para o destino: duas montagens ao mesmo
 * tempo, ou duas peças com o mesmo caminho, nunca disputam o mesmo `.parcial`. Já conferido no cache: nada baixa.
 */
async function baixarSemColisao(
  baixar: Baixar,
  o: OpcoesDownload,
  /** Versão já marcada como montada: arquivo com este tamanho (do manifesto) dispensa reler o hash. */
  tamanhoConfiavel?: number,
): Promise<void> {
  try {
    if (tamanhoConfiavel !== undefined && (await stat(o.destino)).size === tamanhoConfiavel) return;
    if (
      (await hashDoArquivo(o.destino, o.hashEsperado.algoritmo)) ===
      o.hashEsperado.valor.toLowerCase()
    )
      return;
  } catch {
    // não existe ainda
  }
  const temporario = `${o.destino}.${process.pid}.${randomBytes(6).toString("hex")}.baixando`;
  try {
    await baixar({ ...o, destino: temporario });
    await rename(temporario, o.destino);
  } finally {
    await rm(temporario, { force: true });
    await rm(`${temporario}.parcial`, { force: true });
    await rm(`${temporario}.parcial.meta`, { force: true });
  }
}

/** Marcador `.montada.json` lido do disco (entrada não confiável): só vale se for desta versão e deste Java. */
function marcadorValido(texto: string | undefined, versao: string, javaMajor: number): boolean {
  try {
    const m = JSON.parse(texto ?? "") as Record<string, unknown>;
    return m?.app === "SabreHosting" && m.versao === versao && m.javaMajor === javaMajor;
  } catch {
    return false;
  }
}

const tamanhoDe = (t: unknown): number | undefined =>
  typeof t === "number" && Number.isSafeInteger(t) && t >= 0 ? t : undefined;

const sha1De = (texto: string) => createHash("sha1").update(texto).digest("hex");

function exigirSha1(valor: unknown, o: string): string {
  if (typeof valor !== "string" || !SHA1.test(valor))
    throw new Error(`A Mojang informou ${o} sem hash válido; não vou baixar sem conferir.`);
  return valor.toLowerCase();
}

function exigirUrl(valor: unknown, o: string): string {
  if (typeof valor !== "string") throw new Error(`A Mojang informou ${o} sem endereço.`);
  return valor;
}

/** Caminho relativo dentro do cache: sem `..`, sem barra de volta, sem absoluto (entrada não confiável). */
function caminhoNoCache(raiz: string, relativo: unknown): string {
  if (
    typeof relativo !== "string" ||
    !relativo ||
    relativo.includes("\\") ||
    relativo.startsWith("/") ||
    relativo.split("/").some((p) => p === ".." || p === "." || p === "")
  )
    throw new Error("O manifesto trouxe um caminho de arquivo inseguro; recusei.");
  const final = resolve(raiz, relativo);
  if (!final.startsWith(resolve(raiz) + sep)) throw new Error("Caminho fora do cache; recusei.");
  return final;
}

interface Peca {
  url: string;
  sha1: string;
  destino: string;
  tamanho?: number;
}

type Regra = { action?: string; os?: { name?: string } };
/** Regras de biblioteca da Mojang: vale para Windows se a última regra que casa permite. */
function vale(regras: unknown): boolean {
  if (!Array.isArray(regras) || regras.length === 0) return true;
  let permitido = false;
  for (const r of regras as Regra[]) {
    const casa = !r.os?.name || r.os.name === "windows";
    if (casa) permitido = r.action === "allow";
  }
  return permitido;
}

async function lerJson(
  buscar: Buscar,
  url: string,
  sha1: string,
  o: string,
): Promise<{ json: unknown; texto: string }> {
  const texto = await buscar(url);
  if (texto.length > TETO_JSON || sha1De(texto) !== sha1)
    throw new Error(`O arquivo ${o} da Mojang não confere com o hash do manifesto; descartei.`);
  return { json: JSON.parse(texto), texto };
}

async function gravarAtomico(destino: string, conteudo: string): Promise<void> {
  await mkdir(dirname(destino), { recursive: true });
  const tmp = `${destino}.${process.pid}.${randomBytes(6).toString("hex")}.tmp`;
  try {
    await writeFile(tmp, conteudo);
    await rename(tmp, destino);
  } catch (e) {
    await rm(tmp, { force: true });
    throw e;
  }
}

export async function montarVersao(opcoes: OpcoesMontar): Promise<VersaoMontada> {
  const { versao, cache, java = false, permitirHttpLocal = false } = opcoes;
  const buscar = opcoes.buscar ?? buscarPadrao;
  const baixar = opcoes.baixar ?? baixarConferido;
  if (!ID_VERSAO.test(versao)) throw new Error(`Versão do Minecraft inválida: ${versao}.`);
  // Marcador antigo não vale numa remontagem: se esta falhar no meio, a versão fica sem marcador.
  // Antes de apagar, guarda o conteúdo: ele só serve para pular a releitura de hash (lancmel-2.7).
  const arquivoMarcador = join(cache, "versions", versao, ".montada.json");
  const marcadorAntigo = await readFile(arquivoMarcador, "utf8").catch(() => undefined);
  await rm(arquivoMarcador, { force: true });

  const manifesto = JSON.parse(await buscar(URL_MANIFESTO)) as {
    versions?: Record<string, unknown>[];
  };
  const entrada = (Array.isArray(manifesto?.versions) ? manifesto.versions : []).find(
    (v) => v?.id === versao && v.type === "release",
  );
  if (!entrada) throw new Error(`A versão ${versao} não está na lista oficial de versões.`);
  const urlJson = exigirUrl(entrada.url, "a versão");
  if (new URL(urlJson).protocol !== "https:" || !HOSTS_JSON.has(new URL(urlJson).hostname))
    throw new Error("O manifesto apontou a versão para fora dos servidores oficiais; recusei.");
  const { json } = await lerJson(
    buscar,
    urlJson,
    exigirSha1(entrada.sha1, "a versão"),
    "da versão",
  );

  const v = json as {
    downloads?: { client?: { url?: unknown; sha1?: unknown; size?: unknown } };
    libraries?: Array<{
      rules?: unknown;
      downloads?: { artifact?: { path?: unknown; url?: unknown; sha1?: unknown; size?: unknown } };
    }>;
    assetIndex?: { id?: unknown; url?: unknown; sha1?: unknown; size?: unknown };
    javaVersion?: { majorVersion?: unknown };
  };
  const javaMajor = v.javaVersion?.majorVersion;
  if (
    typeof javaMajor !== "number" ||
    !Number.isInteger(javaMajor) ||
    javaMajor < 8 ||
    javaMajor > 99
  )
    throw new Error("A Mojang não informou a versão do Java dessa versão do Minecraft.");
  const marcada = marcadorValido(marcadorAntigo, versao, javaMajor);
  const c = v.downloads?.client;
  if (!c) throw new Error("A Mojang não publicou o cliente dessa versão.");
  const idAssets = v.assetIndex?.id;
  if (typeof idAssets !== "string" || !/^[\w.-]{1,32}$/.test(idAssets))
    throw new Error("A Mojang informou um índice de assets inválido.");

  const pastaVersao = caminhoNoCache(cache, `versions/${versao}`);
  const jarCliente = join(pastaVersao, `${versao}.jar`);
  const pecas: Peca[] = [
    {
      url: exigirUrl(c.url, "o cliente"),
      sha1: exigirSha1(c.sha1, "o cliente"),
      destino: jarCliente,
      tamanho: tamanhoDe(c.size),
    },
  ];
  const bibliotecas: string[] = [];
  const vistos = new Map<string, string>(pecas.map((p) => [p.destino, p.sha1]));
  /** Mesmo caminho: mesma peça (ignora a repetida) ou conflito (recusa). */
  const nova = (p: Peca): boolean => {
    const antigo = vistos.get(p.destino);
    if (antigo === undefined) {
      vistos.set(p.destino, p.sha1);
      pecas.push(p);
      return true;
    }
    if (antigo !== p.sha1)
      throw new Error("O manifesto trouxe dois arquivos diferentes para o mesmo caminho; recusei.");
    return false;
  };
  for (const lib of v.libraries ?? []) {
    const a = lib.downloads?.artifact;
    if (!a || !vale(lib.rules)) continue;
    const destino = caminhoNoCache(join(cache, "libraries"), a.path);
    const peca = {
      url: exigirUrl(a.url, "uma biblioteca"),
      sha1: exigirSha1(a.sha1, "uma biblioteca"),
      destino,
      tamanho: tamanhoDe(a.size),
    };
    if (nova(peca)) bibliotecas.push(destino);
  }

  // Índice de assets: JSON conferido pelo sha1; cada objeto fica em objects/<2 primeiros>/<hash>.
  const ia = v.assetIndex ?? {};
  const indiceDestino = join(cache, "assets/indexes", `${idAssets}.json`);
  const indicePeca: Peca = {
    url: exigirUrl(ia.url, "o índice de assets"),
    sha1: exigirSha1(ia.sha1, "o índice de assets"),
    destino: indiceDestino,
    tamanho: tamanhoDe(ia.size),
  };

  const total = () => pecas.length;
  let feitos = 0;
  const fazer = async (p: Peca) => {
    const vigiado = new URL(p.url);
    if (
      !HOSTS_ARQUIVOS.includes(vigiado.hostname) &&
      !(permitirHttpLocal && ["127.0.0.1", "[::1]"].includes(vigiado.hostname))
    )
      throw new Error("A Mojang apontou um arquivo para fora dos servidores oficiais; recusei.");
    await mkdir(dirname(p.destino), { recursive: true });
    await baixarSemColisao(
      baixar,
      {
        url: p.url,
        hashEsperado: { algoritmo: "sha1", valor: p.sha1 },
        destino: p.destino,
        tamanhoMaximo: Math.min(
          typeof p.tamanho === "number" ? p.tamanho + 1 : TETO_PECA,
          TETO_PECA,
        ),
        hostsPermitidos: permitirHttpLocal
          ? [...HOSTS_ARQUIVOS, "127.0.0.1", "[::1]"]
          : HOSTS_ARQUIVOS,
        permitirHttpLocal,
      },
      marcada ? p.tamanho : undefined,
    );
    opcoes.aoProgredir?.(++feitos, total());
  };
  const emParalelo = async (lista: Peca[]) => {
    let i = 0;
    const trabalhador = async () => {
      for (let p = lista[i++]; p; p = lista[i++]) await fazer(p);
    };
    await Promise.all(Array.from({ length: Math.min(PARALELO, lista.length) }, trabalhador));
  };

  await fazer(indicePeca);
  const indice = JSON.parse(await readFile(indiceDestino, "utf8")) as {
    objects?: Record<string, { hash?: unknown; size?: unknown }>;
  };
  if (!indice.objects || typeof indice.objects !== "object")
    throw new Error("O índice de assets veio sem a lista de objetos.");
  const assets: Peca[] = [];
  for (const o of Object.values(indice.objects)) {
    const hash = exigirSha1(o?.hash, "um asset");
    assets.push({
      url: `https://resources.download.minecraft.net/${hash.slice(0, 2)}/${hash}`,
      sha1: hash,
      destino: join(cache, "assets/objects", hash.slice(0, 2), hash),
      tamanho: typeof o.size === "number" ? o.size : undefined,
    });
  }
  if (permitirHttpLocal) {
    // Teste: o servidor falso serve os objetos em /obj/<2>/<hash> no mesmo endereço do índice.
    const origem = new URL(indicePeca.url).origin;
    for (const a of assets) a.url = `${origem}/obj/${a.sha1.slice(0, 2)}/${a.sha1}`;
  }
  assets.forEach(nova);
  await emParalelo(pecas);

  let pacoteJava: string | undefined;
  let javaw: string | undefined;
  if (java) {
    const alvo = resolverAdoptium(JSON.parse(await buscar(urlAdoptium(javaMajor))));
    pacoteJava = join(cache, "java", `jre-${javaMajor}-${alvo.hashEsperado.valor}.zip`);
    await mkdir(dirname(pacoteJava), { recursive: true });
    await baixarSemColisao(baixar, {
      url: alvo.url,
      hashEsperado: alvo.hashEsperado,
      destino: pacoteJava,
      tamanhoMaximo: 512 * 1024 ** 2,
      hostsPermitidos: HOSTS_JAVA, // vale também nos redirecionamentos (baixarConferido confere cada salto)
    });
    const pastaJava = pacoteJava.replace(/\.zip$/, "");
    ({ javaw } = await extrairJava(pacoteJava, pastaJava));
  }

  // Por último: a versão só conta como montada com tudo conferido.
  await gravarAtomico(
    join(pastaVersao, ".montada.json"),
    JSON.stringify({
      app: "SabreHosting",
      versao,
      javaMajor,
      javaw: javaw && relative(cache, javaw).split(sep).join("/"),
      assets: assets.length,
      bibliotecas: bibliotecas.length,
    }),
  );
  return {
    jarCliente,
    bibliotecas,
    assets: assets.length,
    javaMajor,
    pacoteJava,
    javaw,
    pastaAssets: join(cache, "assets"),
    idIndiceAssets: idAssets,
  };
}
