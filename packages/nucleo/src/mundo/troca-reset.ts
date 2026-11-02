/**
 * Marcador e recuperação da troca do reset (chunk-1.3). Fica em `TROCA-EM-ANDAMENTO.json` (o mesmo que `podeSubir`
 * olha), ao lado do mundo. Os caminhos de `.antigo`/`.resetando` NÃO são gravados: derivam de `rel` + `sufixo`, e o
 * marcador lido do disco é entrada não confiável (S-07): `rel` só passa no formato exato `[DIM-1 ou DIM1]/<tipo>/r.<x>.<z>.mca`
 * e `sufixo` só com letras, números e hífen, então nada fora das 3 pastas do mundo pode ser tocado.
 * Não importa `restaurar.ts` (que chama `recuperarReset`), para não haver ciclo.
 */
import { lstat, rename, rm } from "node:fs/promises";
import { basename, dirname, join, relative, resolve } from "node:path";
import { MARCADOR_TROCA, gravarAtomico } from "../servidor/configurar.js";

export interface ItemDoReset {
  /** Relativo à pasta do mundo, com "/". */
  rel: string;
  /** Região que ficou vazia: só sai (vai para `.antigo`), sem temporária. */
  apagar: boolean;
}
export interface MarcadorDoReset {
  tipo: "reset";
  /** Absoluto. */
  mundo: string;
  sufixo: string;
  /** `trocando`: dá para desfazer tudo; `concluido`: a troca acabou, só falta limpar (nunca desfazer parcial). */
  fase: "trocando" | "concluido";
  arquivos: ItemDoReset[];
}

const REL =
  /^(?:DIM-1\/|DIM1\/)?(?:region|entities|poi)\/r\.(?:0|-?[1-9]\d{0,8})\.(?:0|-?[1-9]\d{0,8})\.mca$/;
const SUFIXO = /^[0-9A-Za-z-]{1,40}$/;
const MAX_ITENS = 100_000;

export const caminhoAntigo = (mundo: string, rel: string, sufixo: string) =>
  join(mundo, `${rel}.antigo-${sufixo}`);
export const caminhoTemp = (mundo: string, rel: string, sufixo: string) =>
  join(mundo, `${rel}.resetando-${sufixo}`);
export const caminhoOriginal = (mundo: string, rel: string) => join(mundo, rel);

const apagar = (p: string) => rm(p, { force: true });

export const gravarMarcadorReset = (m: MarcadorDoReset) =>
  gravarAtomico(join(dirname(m.mundo), MARCADOR_TROCA), JSON.stringify(m));
export const apagarMarcadorReset = (m: Pick<MarcadorDoReset, "mundo">) =>
  apagar(join(dirname(m.mundo), MARCADOR_TROCA));

const ruim = () =>
  new Error(
    "O arquivo de aviso da troca do mundo está ilegível ou fora do esperado; nada foi alterado. " +
      "Confira a pasta do mundo e apague o arquivo de aviso só depois.",
  );

export const ehMarcadorDeReset = (j: unknown): boolean =>
  typeof j === "object" && j !== null && (j as { tipo?: unknown }).tipo === "reset";

/** Valida o que veio do disco; qualquer desvio vira erro fixo (sem repetir o conteúdo). */
export function lerMarcadorReset(
  j: unknown,
  pastaDoServidor: string,
  nomeDoMundo: string,
): MarcadorDoReset {
  const m = (j ?? {}) as Record<string, unknown>;
  const { mundo, sufixo, fase, arquivos } = m;
  if (typeof mundo !== "string" || resolve(mundo) !== mundo) throw ruim();
  if (
    relative(resolve(dirname(mundo)), resolve(pastaDoServidor)) !== "" ||
    mundo === dirname(mundo)
  )
    throw ruim();
  // Só o mundo configurado: marcador forjado apontando para outra pasta do servidor (mods, libraries…) não é obedecido.
  if (basename(mundo) !== nomeDoMundo) throw ruim();
  if (typeof sufixo !== "string" || !SUFIXO.test(sufixo)) throw ruim();
  if (fase !== "trocando" && fase !== "concluido") throw ruim();
  if (!Array.isArray(arquivos) || arquivos.length > MAX_ITENS) throw ruim();
  const vistos = new Set<string>();
  const itens: ItemDoReset[] = [];
  for (const a of arquivos as Record<string, unknown>[]) {
    if (typeof a?.["rel"] !== "string" || !REL.test(a["rel"]) || typeof a["apagar"] !== "boolean")
      throw ruim();
    if (vistos.has(a["rel"])) throw ruim();
    vistos.add(a["rel"]);
    itens.push({ rel: a["rel"], apagar: a["apagar"] });
  }
  return { tipo: "reset", mundo, sufixo, fase, arquivos: itens };
}

const existe = (p: string) =>
  lstat(p).then(
    () => true,
    (erro: NodeJS.ErrnoException) => {
      if (erro.code === "ENOENT") return false;
      throw erro;
    },
  );

/**
 * Devolve o mundo de antes ao lugar, item a item (estado de cada um decide o passo); nunca apaga um `.antigo` que
 * ainda é o único dono dos dados. Falta o original E o `.antigo` de um item que tinha temporária: dado perdido, lança
 * e MANTÉM o marcador (o servidor continua sem subir).
 */
export async function desfazerReset(
  m: MarcadorDoReset,
  renomear: (de: string, para: string) => Promise<void> = rename,
): Promise<void> {
  for (const { rel, apagar: sai } of [...m.arquivos].reverse()) {
    const original = caminhoOriginal(m.mundo, rel);
    const antigo = caminhoAntigo(m.mundo, rel, m.sufixo);
    const temp = caminhoTemp(m.mundo, rel, m.sufixo);
    const haAntigo = await existe(antigo);
    const haOriginal = await existe(original);
    if (haAntigo) {
      // O novo (já trocado) volta a ser temporária; os dados de antes ficam em .antigo até o rename final.
      if (haOriginal) await renomear(original, temp);
      await renomear(antigo, original);
    } else if (!haOriginal && !sai) {
      throw new Error(
        "A troca do reset parou no meio e um arquivo de região não foi encontrado. Nada foi apagado; " +
          "restaure o backup 'antes de resetar' pela tela de backups.",
      );
    }
    await apagar(temp);
  }
}

/** Fase concluída: só falta apagar o que sobrou do mundo de antes. */
export async function limparReset(m: MarcadorDoReset): Promise<void> {
  for (const { rel } of m.arquivos) {
    await apagar(caminhoAntigo(m.mundo, rel, m.sufixo));
    await apagar(caminhoTemp(m.mundo, rel, m.sufixo));
  }
}

/** Chamada por `recuperarTroca` quando o marcador é de reset. */
export async function recuperarReset(
  j: unknown,
  pastaDoServidor: string,
  nomeDoMundo: string,
  renomear?: (de: string, para: string) => Promise<void>,
): Promise<"limpou" | "desfez"> {
  const m = lerMarcadorReset(j, pastaDoServidor, nomeDoMundo);
  const desfeito = m.fase === "trocando";
  if (desfeito) await desfazerReset(m, renomear);
  else await limparReset(m);
  await apagarMarcadorReset(m);
  return desfeito ? "desfez" : "limpou";
}
