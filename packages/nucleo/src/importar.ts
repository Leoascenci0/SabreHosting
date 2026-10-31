/**
 * Importar o mundo de um `.zip` baixado da hospedagem antiga (piloto-1.1a: só o núcleo, sem tela).
 *
 * O zip vem de fora, então é entrada NÃO confiável (S-07): primeiro uma passada só de leitura da lista de entradas
 * recusa tudo que é suspeito, SEM gravar um byte; só depois extrai para uma pasta temporária nova, filha direta da
 * pasta de trabalho, conferindo cada destino. O zip nunca é lido inteiro na memória (yauzl lê entrada a entrada).
 * O pacote sai de `criarPacote` (regras 2 e 3 intactas: só lê a pasta extraída) e a versão é entregue a `enviar`.
 *
 * `importarNoCartorio` (piloto-1.1c) liga isso ao cartório: pega a trava de host NORMAL (regra 1; nunca contorna),
 * registra a versão seguinte (N+1, nunca sobrescreve nem apaga) e manda o pacote para a nuvem; solta a trava sempre.
 * Nada aqui toca a pasta do mundo deste PC.
 */
import { createWriteStream } from "node:fs";
import { mkdir, mkdtemp, rm } from "node:fs/promises";
import { dirname, join, relative, resolve, sep } from "node:path";
import { Transform } from "node:stream";
import { pipeline } from "node:stream/promises";
import yauzl, { type Entry, type ZipFile } from "yauzl";
import { caminhoSeguro } from "./backup/manifesto.js";
import { criarPacote, type PacoteCriado } from "./backup/pacote.js";
import type { ClienteCartorio } from "./cartorio/cliente.js";
import { Renovador, type OpcoesRenovador } from "./cartorio/renovador.js";
import { lerVersaoDoLevelDat } from "./nbt.js";

export interface LimitesDaImportacao {
  /** Teto de bytes descompactados (declarados e, de novo, os realmente lidos). */
  maxBytes: number;
  maxEntradas: number;
}

/** Padrões sensatos para um mundo de amigos; reversíveis (o app poderá oferecer na tela, 1.1c). */
export const LIMITES_PADRAO: LimitesDaImportacao = {
  maxBytes: 8 * 1024 ** 3,
  maxEntradas: 200_000,
};

/** O que dá para saber do zip só lendo (nada gravado): a tela mostra antes de o amigo confirmar. */
export interface AnaliseDoZip {
  arquivos: number;
  /** Versão do Minecraft lida do level.dat; 'desconhecida' só AVISA (não bloqueia). */
  versaoMinecraft: string;
  /** Pistas de que o mundo veio de servidor com plugins ou mods (a tela avisa). */
  indicios: { plugins: boolean; mods: boolean };
}

export interface ImportacaoPronta {
  versao: number;
  sha256: string;
  tamanho: number;
  arquivos: number;
  /** Versão do Minecraft lida do level.dat; 'desconhecida' só AVISA (não bloqueia). */
  versaoMinecraft: string;
  /** Pistas de que o mundo veio de servidor com plugins ou mods (a tela 1.1c avisa). */
  indicios: { plugins: boolean; mods: boolean };
}

export interface OpcoesDeImportacao {
  /** Pasta onde nasce a temporária (`importar-XXXX`); precisa existir. */
  pastaDeTrabalho: string;
  /** Época da trava de host (o cartório recusa época velha). */
  epoca: number;
  /** Número que vai no manifesto: o que o cartório vai dar (N+1). Padrão: 1. */
  versao?: number;
  /** Entrega a versão (POST /versoes + PUT /versoes/N/pacote). Se lançar, nada fica em disco. */
  enviar: (pacote: PacoteCriado) => Promise<void>;
  limites?: Partial<LimitesDaImportacao>;
}

const recusa = (motivo: string) =>
  new Error(`Zip do mundo recusado: ${motivo} Nada foi importado nem alterado.`);

const abrir = (zip: string): Promise<ZipFile> =>
  new Promise((ok, falha) =>
    yauzl.open(
      zip,
      { lazyEntries: true, validateEntrySizes: true, strictFileNames: true },
      (erro, z) => (erro ? falha(erro) : ok(z)),
    ),
  );

/** Percorre as entradas uma a uma; `porEntrada` pode lançar para abortar. Sempre fecha o zip. */
async function percorrer(
  zip: string,
  porEntrada: (e: Entry, ler: () => Promise<NodeJS.ReadableStream>) => Promise<void>,
): Promise<void> {
  const z = await abrir(zip).catch((erro: unknown) => {
    throw new Error("Esse arquivo não parece ser um .zip válido.", { cause: erro });
  });
  try {
    await new Promise<void>((fim, falha) => {
      // Erro da própria biblioteca (nome com "..", absoluto, "\\", tamanho que não bate): vira recusa em pt-BR.
      z.once("error", (erro: Error) =>
        falha(
          erro.message.startsWith("Zip do mundo recusado")
            ? erro
            : new Error(
                `Zip do mundo recusado: entrada com caminho inseguro ou tamanho adulterado (${erro.message}). Nada foi importado nem alterado.`,
                { cause: erro },
              ),
        ),
      );
      z.once("end", fim);
      z.on("entry", (e: Entry) => {
        const ler = () =>
          new Promise<NodeJS.ReadableStream>((ok, no) =>
            z.openReadStream(e, (erro, s) => (erro ? no(erro) : ok(s))),
          );
        porEntrada(e, ler).then(() => z.readEntry(), falha);
      });
      z.readEntry();
    });
  } finally {
    z.close();
  }
}

const ehLink = (e: Entry) => ((e.externalFileAttributes >>> 16) & 0o170000) === 0o120000;

/** Passada 1: só olha a lista. Devolve os caminhos a extrair; lança na primeira entrada suspeita. */
async function conferirLista(zip: string, lim: LimitesDaImportacao): Promise<string[]> {
  const nomes: string[] = [];
  const vistos = new Set<string>();
  const pastas = new Set<string>();
  let total = 0;
  let entradas = 0;
  await percorrer(zip, async (e) => {
    if (++entradas > lim.maxEntradas) {
      throw recusa(`tem entradas demais (mais de ${lim.maxEntradas}).`);
    }
    if (ehLink(e)) throw recusa(`"${e.fileName}" é um link simbólico.`);
    const dir = e.fileName.endsWith("/");
    const nome = dir ? e.fileName.slice(0, -1) : e.fileName;
    if (!caminhoSeguro(nome)) {
      throw recusa(
        `o caminho ${JSON.stringify(e.fileName)} é inseguro (nome ou caminho inválido).`,
      );
    }
    const chave = nome.normalize("NFC").toLowerCase();
    if (dir) {
      pastas.add(chave);
      return;
    }
    if (vistos.has(chave)) {
      throw recusa(`"${nome}" aparece duas vezes (repetido, mesmo ignorando maiúsculas).`);
    }
    vistos.add(chave);
    total += e.uncompressedSize;
    if (total > lim.maxBytes) {
      throw recusa(`o tamanho total passa do limite de ${lim.maxBytes} bytes.`);
    }
    nomes.push(nome);
  });
  // Um nome não pode ser arquivo e pasta ao mesmo tempo (em qualquer ordem).
  for (const chave of vistos) {
    const partes = chave.split("/");
    for (let i = 1; i < partes.length; i++) {
      if (vistos.has(partes.slice(0, i).join("/"))) {
        throw recusa(`"${chave}" está dentro de algo que também é arquivo.`);
      }
    }
    if (pastas.has(chave)) throw recusa(`"${chave}" é arquivo e pasta ao mesmo tempo.`);
  }
  if (nomes.length === 0) throw recusa("o zip está vazio: nenhum arquivo dentro.");
  return nomes;
}

/** Pasta de topo única que contém TODO o zip (ex.: `world/`), ou "" quando o zip já começa no mundo. */
function prefixoDaRaiz(nomes: string[]): string {
  if (nomes.includes("level.dat")) return "";
  const topo = nomes.find((n) => n.endsWith("/level.dat"))?.split("/")[0];
  return topo !== undefined && nomes.every((n) => n.startsWith(`${topo}/`)) ? `${topo}/` : "";
}

/** Lê o level.dat direto do zip (antes de extrair), com teto de bytes; ausente ou estranho = 'desconhecida'. */
async function lerVersao(zip: string, prefixo: string): Promise<string> {
  const alvo = `${prefixo}level.dat`;
  const teto = 16 * 1024 * 1024;
  let versao: string | undefined;
  await percorrer(zip, async (e, ler) => {
    if (e.fileName !== alvo || e.uncompressedSize > teto) return;
    const partes: Buffer[] = [];
    let lidos = 0;
    for await (const p of await ler()) {
      lidos += (p as Buffer).length;
      if (lidos > teto) return; // o declarado mentiu: ignora, não importa
      partes.push(p as Buffer);
    }
    versao = lerVersaoDoLevelDat(Buffer.concat(partes))?.nome;
  });
  return versao ?? "desconhecida";
}

/** Passada 2: extrai conferindo cada destino e contando os bytes REALMENTE lidos (o declarado não vale). */
async function extrair(
  zip: string,
  mundo: string,
  lim: LimitesDaImportacao,
  prefixo: string,
): Promise<void> {
  let lidos = 0;
  await percorrer(zip, async (e, ler) => {
    if (e.fileName.endsWith("/")) return;
    const destino = resolve(mundo, ...e.fileName.slice(prefixo.length).split("/"));
    const rel = relative(mundo, destino);
    if (
      rel === "" ||
      rel.startsWith("..") ||
      resolve(mundo, rel) !== destino ||
      rel.includes(`..${sep}`)
    ) {
      throw recusa(`"${e.fileName}" sairia da pasta de destino.`);
    }
    await mkdir(dirname(destino), { recursive: true });
    const contar = new Transform({
      transform(parte: Buffer, _c, pronto) {
        lidos += parte.length;
        if (lidos > lim.maxBytes) {
          pronto(recusa(`o conteúdo real passa do limite de ${lim.maxBytes} bytes (zip inflado).`));
        } else pronto(null, parte);
      },
    });
    await pipeline(await ler(), contar, createWriteStream(destino, { flags: "wx" }));
  });
}

async function analisar(zip: string, lim: LimitesDaImportacao) {
  const nomes = await conferirLista(zip, lim); // nada gravado até aqui
  const prefixo = prefixoDaRaiz(nomes);
  const versaoMinecraft = await lerVersao(zip, prefixo); // ainda só leitura
  const dentro = nomes.map((n) => n.slice(prefixo.length));
  const indicios = {
    plugins: dentro.some((n) => n.startsWith("plugins/")),
    mods: dentro.some((n) => /^mods\/[^/]+\.jar$/i.test(n)),
  };
  return { prefixo, analise: { arquivos: nomes.length, versaoMinecraft, indicios } };
}

/** Só leitura: confere o zip inteiro (recusa o hostil) e diz versão e avisos, sem gravar um byte. */
export async function analisarZip(
  zip: string,
  limites?: Partial<LimitesDaImportacao>,
): Promise<AnaliseDoZip> {
  return (await analisar(zip, { ...LIMITES_PADRAO, ...limites })).analise;
}

export async function importarMundoZip(
  zip: string,
  o: OpcoesDeImportacao,
): Promise<ImportacaoPronta> {
  const lim = { ...LIMITES_PADRAO, ...o.limites };
  const versao = o.versao ?? 1;
  const { prefixo, analise } = await analisar(zip, lim);
  const base = await mkdtemp(join(o.pastaDeTrabalho, "importar-"));
  try {
    const mundo = join(base, "mundo");
    await mkdir(mundo);
    await extrair(zip, mundo, lim, prefixo);
    const pacote = await criarPacote(mundo, join(base, "mundo.tar.gz"), {
      versao,
      epoca: o.epoca,
    });
    await o.enviar(pacote);
    return { versao, sha256: pacote.sha256, tamanho: pacote.tamanho, ...analise };
  } finally {
    await rm(base, { recursive: true, force: true }); // só a pasta que esta chamada criou
  }
}

/** O que `importarNoCartorio` usa do cliente do cartório. */
export type ClienteDeImportacao = Pick<
  ClienteCartorio,
  | "eu"
  | "estadoTrava"
  | "pegar"
  | "renovar"
  | "soltar"
  | "numeroMaisNovo"
  | "criarVersao"
  | "enviarPacote"
>;

export interface OpcoesNoCartorio {
  cliente: ClienteDeImportacao;
  pastaDeTrabalho: string;
  /**
   * O amigo confirmou que o mundo importado vira a versão mais nova de um grupo que JÁ tem mundo (decisão 2: só o
   * dono pode). Sem isso, grupo com versão recusa.
   */
  aceitarVersaoNova?: boolean;
  limites?: Partial<LimitesDaImportacao>;
  /** Só para os testes: relógios do renovador. */
  relogioDaTrava?: Pick<OpcoesRenovador, "agora" | "agoraParede" | "relogio" | "margemMs">;
}

const NADA_ALTERADO = "Nada foi importado nem alterado.";
const SEM_TRAVA = `Este PC perdeu a vez de mexer no mundo do grupo no meio da importação. ${NADA_ALTERADO}`;

/** Regra do grupo (decisão 2): sem versão, qualquer PC importa a 1ª; com versão, só o dono e com confirmação. */
function conferirPermissao(n: number | null, dono: boolean, aceitar: boolean): void {
  if (n === null) return;
  if (!dono) {
    throw new Error(
      `Só o dono do grupo pode importar um mundo quando o grupo já tem um (versão ${n}). ${NADA_ALTERADO}`,
    );
  }
  if (!aceitar) {
    throw new Error(
      `O grupo já tem um mundo (versão ${n}). Confirme para o importado virar a versão mais nova. ${NADA_ALTERADO}`,
    );
  }
}

/**
 * Importa o zip como a próxima versão do grupo. Ordem: confere quem pode → pega a trava de host (recusa se está com
 * outro PC ou com ESTE PC hospedando) → relê a versão mais nova com a trava → extrai, empacota com o número N+1 →
 * registra a versão → manda o pacote (a nuvem confere hash e tamanho). Perdeu a trava: o envio cai. Solta sempre.
 */
export async function importarNoCartorio(
  zip: string,
  o: OpcoesNoCartorio,
): Promise<ImportacaoPronta> {
  const { cliente } = o;
  const aceitar = o.aceitarVersaoNova === true;
  const eu = await cliente.eu();
  const trava = await cliente.estadoTrava();
  if (trava.dono?.id === eu.id) {
    // Pegar de novo trocaria a época e derrubaria o servidor deste mesmo PC.
    throw new Error(
      `Este PC está hospedando agora. Pare o servidor antes de importar. ${NADA_ALTERADO}`,
    );
  }
  conferirPermissao(await cliente.numeroMaisNovo(), eu.dono, aceitar);

  let epoca: number | undefined;
  const perdeu = new AbortController();
  const renovador = new Renovador({
    cliente: {
      pegar: async () => {
        const r = await cliente.pegar();
        if (r.ok) epoca = r.epoca;
        return r;
      },
      renovar: (e, sinal) => cliente.renovar(e, sinal),
      soltar: (e) => cliente.soltar(e),
    },
    aoPerder: () => perdeu.abort(),
    ...o.relogioDaTrava,
  });
  await renovador.pegar().catch((erro: unknown) => {
    const motivo = erro instanceof Error ? ` (${erro.message})` : "";
    throw new Error(
      `Outro PC está mexendo no mundo do grupo agora${motivo}. Importe quando ninguém estiver hospedando. ${NADA_ALTERADO}`,
      { cause: erro },
    );
  });
  try {
    if (epoca === undefined) throw new Error(SEM_TRAVA);
    const comTrava = epoca;
    // Com a trava ninguém mais registra versão: N+1 é certo daqui até o envio.
    const n = await cliente.numeroMaisNovo();
    conferirPermissao(n, eu.dono, aceitar);
    const proxima = (n ?? 0) + 1;
    return await importarMundoZip(zip, {
      pastaDeTrabalho: o.pastaDeTrabalho,
      epoca: comTrava,
      versao: proxima,
      ...(o.limites ? { limites: o.limites } : {}),
      enviar: async (pacote) => {
        if (!(await renovador.renovarAgora())) throw new Error(SEM_TRAVA);
        const numero = await cliente.criarVersao(comTrava, {
          manifestoSha256: pacote.manifesto.sha256,
          arquivos: pacote.manifesto.arquivos,
          bytes: pacote.manifesto.bytes,
        });
        if (numero !== proxima) {
          throw new Error(
            `O cartório deu a versão ${numero}, mas o pacote foi feito para a ${proxima}; o pacote não foi enviado. Avise o dono do grupo.`,
          );
        }
        if (!(await renovador.renovarAgora())) throw new Error(SEM_TRAVA);
        await cliente.enviarPacote(numero, comTrava, pacote, perdeu.signal);
      },
    });
  } finally {
    // Sempre: para o relógio e devolve a trava (falhar ao soltar não esconde o resultado; o prazo vence sozinho).
    await renovador.soltar().catch(() => undefined);
  }
}
