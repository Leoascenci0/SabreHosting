import { mkdir, readFile, readdir, rename, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { ErroDownload, baixarConferido } from "../servidor/baixar.js";
import { hashDoArquivo } from "../integridade/hash.js";
import { ARQUIVO_MOD, type ModGrupo, validarModsGrupo } from "../cartorio/tipos.js";

/**
 * Mods do grupo iguais para todos (lanc-1.4): põe na pasta `mods` (da instância ou do servidor) exatamente os mods da
 * lista do cartório. Download e conferência de hash são do `baixarConferido` (troca atômica); aqui só se decide o que
 * baixar e o que sair. Regra de ouro: só se remove o que o SabreHosting colocou (lista de gerenciados na própria pasta);
 * mod do amigo que não é do grupo nunca é tocado.
 */
export type LadoMods = "cliente" | "servidor";

export interface ResultadoMods {
  baixados: string[];
  /** Já estavam certos (hash conferido) e ficaram como estavam. */
  mantidos: string[];
  removidos: string[];
  /** Não aplicados, com o motivo em pt-BR para mostrar ao amigo. O resto da lista segue normalmente. */
  falhas: Array<{ arquivo: string; motivo: string }>;
}

const MARCADOR = ".sabrehosting-mods.json";
const TAMANHO_MAXIMO = 256 * 1024 ** 2;

/** Nomes que o SabreHosting colocou. Vem do disco, então é entrada não confiável (S-07): só nome simples de `.jar`. */
async function lerGerenciados(pasta: string): Promise<string[]> {
  try {
    const dado: unknown = JSON.parse(await readFile(join(pasta, MARCADOR), "utf8"));
    const lista = (dado as { gerenciados?: unknown } | null)?.gerenciados;
    if (!Array.isArray(lista)) return [];
    return lista.filter((n): n is string => typeof n === "string" && ARQUIVO_MOD.test(n));
  } catch {
    return [];
  }
}

async function gravarGerenciados(pasta: string, nomes: string[]): Promise<void> {
  const alvo = join(pasta, MARCADOR);
  const temporario = `${alvo}.${process.pid}.tmp`;
  try {
    await writeFile(temporario, JSON.stringify({ app: "SabreHosting", gerenciados: nomes.sort() }));
    await rename(temporario, alvo);
  } catch (erro) {
    await rm(temporario, { force: true });
    throw erro;
  }
}

const existe = (caminho: string) =>
  stat(caminho).then(
    () => true,
    () => false,
  );

export async function sincronizarMods(opcoes: {
  /** A lista do cartório, como veio (é revalidada aqui: host, nome do arquivo e hash). */
  lista: ModGrupo[];
  /** Pasta `mods` da instância ou do servidor. */
  pasta: string;
  lado: LadoMods;
}): Promise<ResultadoMods> {
  const { pasta, lado } = opcoes;
  const lista = validarModsGrupo({ mods: opcoes.lista }).filter(
    (m) => m.lado === "ambos" || m.lado === lado,
  );
  await mkdir(pasta, { recursive: true });
  const resultado: ResultadoMods = { baixados: [], mantidos: [], removidos: [], falhas: [] };
  const anteriores = await lerGerenciados(pasta);
  const nossos = new Set(anteriores);
  const queremos = new Set(lista.map((m) => m.arquivo));

  for (const m of lista) {
    const destino = join(pasta, m.arquivo);
    const jaTem = await existe(destino);
    if (jaTem && !nossos.has(m.arquivo)) {
      // Arquivo com o mesmo nome que não é nosso: se for idêntico ao do grupo, adota (ex.: parou antes de anotar);
      // se não for, é do amigo e fica como está.
      if ((await hashDoArquivo(destino, "sha512")) === m.sha512) {
        nossos.add(m.arquivo);
        resultado.mantidos.push(m.arquivo);
      } else {
        resultado.falhas.push({
          arquivo: m.arquivo,
          motivo: `Já existe um arquivo seu chamado ${m.arquivo} na pasta de mods; não mexi nele. Renomeie ou apague para usar o mod do grupo.`,
        });
      }
      continue;
    }
    try {
      const { doCache } = await baixarConferido({
        url: m.url,
        hashEsperado: { algoritmo: "sha512", valor: m.sha512 },
        destino,
        tamanhoMaximo: TAMANHO_MAXIMO,
        hostsPermitidos: [new URL(m.url).hostname], // redirect para outro host é recusado
      });
      nossos.add(m.arquivo);
      (doCache ? resultado.mantidos : resultado.baixados).push(m.arquivo);
    } catch (e) {
      // Se havia um nosso com hash velho, o baixarConferido o mantém até o novo conferir; só deixa de ser nosso se sumiu.
      if (!(await existe(destino))) nossos.delete(m.arquivo);
      resultado.falhas.push({
        arquivo: m.arquivo,
        motivo: e instanceof ErroDownload ? e.message : `Não consegui baixar ${m.arquivo}.`,
      });
    }
  }

  for (const antigo of anteriores) {
    if (queremos.has(antigo)) continue;
    await rm(join(pasta, antigo), { force: true });
    nossos.delete(antigo);
    resultado.removidos.push(antigo);
  }
  await gravarGerenciados(pasta, [...nossos]);
  // Sobras de download interrompido (`.parcial`) de arquivos que saíram da lista não valem nada.
  for (const nome of await readdir(pasta)) {
    if (nome.endsWith(".jar.parcial") && !queremos.has(nome.slice(0, -".parcial".length)))
      await rm(join(pasta, nome), { force: true });
  }
  return resultado;
}
