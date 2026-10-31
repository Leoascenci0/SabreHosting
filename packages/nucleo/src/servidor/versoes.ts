import { resolverMojang, type Alvo } from "./resolvedores.js";

/** Devolve o corpo (texto) do endereço https pedido. Injetável: os testes não usam rede. */
export type Buscar = (url: string) => Promise<string>;

export const URL_MANIFESTO = "https://piston-meta.mojang.com/mc/game/version_manifest_v2.json";
const HOSTS_JSON = new Set(["piston-meta.mojang.com", "launcher.mojang.com"]);
const ID_VERSAO = /^1\.\d{1,2}(\.\d{1,2})?$/;
const TETO_CORPO = 8 * 1024 * 1024;

export interface VersaoMinecraft {
  id: string;
  urlJson: string;
}

export interface PlanoVersao {
  versao: string;
  /** Alvo do `server.jar`: url oficial + sha1 do manifesto (o cartório o guarda no 3.1b). */
  jar: Alvo;
  javaMajor: number;
}

export interface OpcoesDaVersao {
  neoforge: boolean;
  /** Fabric + Forge juntos pelo Sinytra Connector (sobre o NeoForge). */
  fabricForge: boolean;
  /** Sempre disponível. */
  semMods: true;
  /** Falso quando a consulta de loaders falhou (só "sem mods" é oferecido). */
  consultou: boolean;
}

export const buscarPadrao: Buscar = async (url) => {
  if (new URL(url).protocol !== "https:") throw new Error("Só https.");
  const r = await fetch(url, { signal: AbortSignal.timeout(15_000), redirect: "error" });
  if (!r.ok) throw new Error(`Resposta ${r.status} de ${new URL(url).hostname}.`);
  if (Number(r.headers.get("content-length") ?? 0) > TETO_CORPO) {
    await r.body?.cancel();
    throw new Error("Resposta grande demais.");
  }
  const partes: Uint8Array[] = [];
  let total = 0;
  const leitor = r.body?.getReader();
  for (;;) {
    const trecho = await leitor?.read();
    if (!trecho || trecho.done) break;
    total += trecho.value.byteLength;
    if (total > TETO_CORPO) {
      await leitor?.cancel();
      throw new Error("Resposta grande demais.");
    }
    partes.push(trecho.value);
  }
  return Buffer.concat(partes).toString("utf8");
};

const lerJson = async (buscar: Buscar, url: string): Promise<unknown> =>
  JSON.parse(await buscar(url));

const urlOficial = (u: unknown): u is string => {
  try {
    const url = new URL(u as string);
    return url.protocol === "https:" && HOSTS_JSON.has(url.hostname);
  } catch {
    return false;
  }
};

/** Versões `release` do manifesto oficial, da mais nova à mais antiga (a ordem do manifesto). */
export async function listarVersoes(buscar: Buscar = buscarPadrao): Promise<VersaoMinecraft[]> {
  const manifesto = (await lerJson(buscar, URL_MANIFESTO)) as {
    versions?: Record<string, unknown>[];
  };
  if (!Array.isArray(manifesto?.versions))
    throw new Error("O manifesto da Mojang veio sem a lista de versões.");
  const lista: VersaoMinecraft[] = [];
  for (const v of manifesto.versions) {
    if (v?.type !== "release" || typeof v.id !== "string" || !ID_VERSAO.test(v.id)) continue;
    if (!urlOficial(v.url)) continue; // entrada não confiável: fora dos hosts oficiais não entra
    lista.push({ id: v.id, urlJson: v.url });
  }
  return lista;
}

/** Plano de uma versão: só se ela estiver na lista de releases; sha1 e Java vêm do JSON oficial da versão. */
export async function planoDaVersao(
  versao: string,
  buscar: Buscar = buscarPadrao,
): Promise<PlanoVersao> {
  const escolhida = (await listarVersoes(buscar)).find((v) => v.id === versao);
  if (!escolhida) throw new Error(`A versão ${versao} não está na lista oficial de versões.`);
  const { javaMajor, ...jar } = resolverMojang(await lerJson(buscar, escolhida.urlJson));
  return { versao, jar, javaMajor };
}

/** Link da Adoptium para o Java maior pedido (a resposta passa por `resolverAdoptium`). */
export function urlAdoptium(javaMajor: number): string {
  if (!Number.isInteger(javaMajor) || javaMajor < 8 || javaMajor > 99)
    throw new Error("Versão do Java inválida.");
  return `https://api.adoptium.net/v3/assets/latest/${javaMajor}/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse`;
}

const MAVEN_NEOFORGE =
  "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml";
const MAVEN_FORGE_LEGADO =
  "https://maven.neoforged.net/releases/net/neoforged/forge/maven-metadata.xml";

/** `1.21.1` → prefixo `21.1.`; `1.20` → `20.0.`. NeoForge novo existe a partir da 1.20.2. */
const prefixoNeoForge = (versao: string) => {
  const [, menor, remendo = "0"] = versao.split(".");
  return `${menor}.${remendo}.`;
};

/**
 * O que o servidor consegue rodar em `versao`, por consulta na hora. Qualquer falha na consulta vira "só sem mods":
 * nunca bloqueia o grupo de escolher uma versão.
 */
export async function opcoesDaVersao(
  versao: string,
  buscar: Buscar = buscarPadrao,
): Promise<OpcoesDaVersao> {
  if (!ID_VERSAO.test(versao)) throw new Error(`Versão do Minecraft inválida: ${versao}.`);
  const so = (neoforge: boolean, fabricForge: boolean, consultou: boolean): OpcoesDaVersao => ({
    neoforge,
    fabricForge,
    semMods: true,
    consultou,
  });
  try {
    const [, menor, remendo = "0"] = versao.split(".");
    const novo = Number(menor) > 20 || (Number(menor) === 20 && Number(remendo) >= 2);
    if (!novo && versao !== "1.20.1") return so(false, false, true); // NeoForge nasce na 1.20.1
    const xml = await buscar(novo ? MAVEN_NEOFORGE : MAVEN_FORGE_LEGADO);
    const prefixo = novo ? prefixoNeoForge(versao) : `${versao}-`;
    const temNeoForge = [...xml.matchAll(/<version>([^<]+)<\/version>/g)].some((m) =>
      m[1]?.startsWith(prefixo),
    );
    if (!temNeoForge) return so(false, false, true);
    const filtro = `game_versions=${encodeURIComponent(`["${versao}"]`)}&loaders=${encodeURIComponent('["neoforge"]')}`;
    const conector = JSON.parse(
      await buscar(`https://api.modrinth.com/v2/project/connector/version?${filtro}`),
    ) as unknown;
    return so(true, Array.isArray(conector) && conector.length > 0, true);
  } catch {
    return so(false, false, false);
  }
}
