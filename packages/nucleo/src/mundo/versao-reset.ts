/**
 * Versão nova do mundo depois do reset e "Desfazer o último reset" (chunk-1.4).
 *
 * Regras de ouro 1 a 5. Versão só vale com pacote enviado, então publicar é o mesmo par do importar:
 * `criarPacote` (servidor parado, trava) + `criarVersao` + `enviarPacote`. O pacote fica na pasta de backups, e assim a
 * versão local deste PC já é a nova (o espalhar não baixa nada). Cartório fora: grava `versao-pendente.json` ao lado
 * do mundo ANTES de registrar; `podeSubir` bloqueia o servidor e `retomarVersaoPendente` termina o serviço olhando o
 * que o cartório já tem (nunca registra duas vezes). O marcador vem do disco: entrada não confiável (S-07), só o NOME
 * do pacote (filho direto da pasta de backups) e os hashes valem. Desfazer restaura o `antes-de-resetar` mais recente
 * pelo `restaurarBackup` (que faz o backup do estado atual antes) e sobe N+1 com o conteúdo antigo: versão não volta.
 * Os erros têm texto fixo (sem caminho cru, S-14).
 */
import { existsSync } from "node:fs";
import { lstat, readFile, rm } from "node:fs/promises";
import { basename, join, resolve } from "node:path";
import { nomeDoBackup } from "../backup/agendador.js";
import { listarBackups, type BackupListado } from "../backup/listar.js";
import { criarPacote } from "../backup/pacote.js";
import {
  exigirMundoNaPastaDoServidor,
  exigirPodeTrocar,
  type OpcoesRestaurar,
} from "../backup/restaurar.js";
import type { ClienteCartorio } from "../cartorio/cliente.js";
import { hashDoArquivo } from "../integridade/hash.js";
import { MARCADOR_VERSAO_PENDENTE, gravarAtomico } from "../servidor/configurar.js";

export type ClienteVersao = Pick<
  ClienteCartorio,
  "criarVersao" | "enviarPacote" | "ultimoRegistrado" | "maisNova"
>;

export interface OpcoesVersaoReset extends Pick<
  OpcoesRestaurar,
  "temTrava" | "servidorParado" | "prazoTravaMs" | "agora"
> {
  pastaDoMundo: string;
  pastaBackups: string;
  /** Pai do mundo: é onde o marcador fica (e onde `podeSubir` o procura). */
  pastaDoServidor: string;
  cliente: ClienteVersao;
  /** Época da trava deste PC (o cartório recusa época velha). */
  epoca: number;
  /** Renova a trava agora (padrão: só confere `temTrava`). */
  renovarAgora?: () => Promise<boolean>;
  sinal?: AbortSignal;
}

export type Publicacao =
  { estado: "publicada"; versao: number } | { estado: "pendente"; versao: number; aviso: string };

export const AVISO_NAO_ESPALHADA =
  "A versão do mundo ainda não foi espalhada: o cartório não respondeu. O mundo mudou só neste PC; o app tenta de novo antes de hospedar.";

const ACAO = { parar: "publicar a versão do mundo", fazer: "publicar a versão do mundo" };
const SEM_TRAVA = "Este PC perdeu a trava de host; a versão não foi enviada.";
const NAO_BATE =
  "A versão do cartório não bate com a do reset pendente; nada foi registrado nem apagado. Avise o dono do grupo.";
const MARCADOR_RUIM =
  "O aviso da versão pendente está ilegível ou fora do esperado; nada foi alterado. Avise o dono do grupo.";
const PACOTE_RUIM =
  "O pacote da versão pendente não confere com o aviso; nada foi enviado nem apagado. Avise o dono do grupo.";
const SEM_CARTORIO =
  "Sem resposta do cartório; nada foi alterado. Tente de novo com o grupo no ar.";
const PENDENTE_BLOQUEIA =
  "O reset ainda não foi espalhado para os outros PCs; conclua isso antes de desfazer.";

class Recusa extends Error {}

const NOME_PACOTE = /^\d{4,}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-v\d+\.tar\.gz$/;
const SHA256 = /^[0-9a-f]{64}$/;
const inteiro = (v: unknown, min: number): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min;

interface Pendencia {
  formato: 1;
  versao: number;
  /** Só o nome do arquivo, dentro da pasta de backups. */
  pacote: string;
  sha256: string;
  tamanho: number;
  manifesto: { sha256: string; arquivos: number; bytes: number };
}

const caminhoDoMarcador = (pastaDoServidor: string) =>
  join(pastaDoServidor, MARCADOR_VERSAO_PENDENTE);

async function lerPendencia(o: OpcoesVersaoReset): Promise<Pendencia | undefined> {
  let texto: string;
  try {
    texto = await readFile(caminhoDoMarcador(o.pastaDoServidor), "utf8");
  } catch (erro) {
    if ((erro as NodeJS.ErrnoException).code === "ENOENT") return undefined;
    throw new Recusa(MARCADOR_RUIM);
  }
  let j: Record<string, unknown>;
  try {
    j = JSON.parse(texto) as Record<string, unknown>;
  } catch {
    throw new Recusa(MARCADOR_RUIM);
  }
  const m = (j?.["manifesto"] ?? {}) as Record<string, unknown>;
  if (
    j?.["formato"] !== 1 ||
    !inteiro(j["versao"], 1) ||
    typeof j["pacote"] !== "string" ||
    !NOME_PACOTE.test(j["pacote"]) ||
    typeof j["sha256"] !== "string" ||
    !SHA256.test(j["sha256"]) ||
    !inteiro(j["tamanho"], 0) ||
    typeof m["sha256"] !== "string" ||
    !SHA256.test(m["sha256"]) ||
    !inteiro(m["arquivos"], 0) ||
    !inteiro(m["bytes"], 0)
  ) {
    throw new Recusa(MARCADOR_RUIM);
  }
  return j as unknown as Pendencia;
}

/** O pacote do aviso existe, é arquivo comum filho direto da pasta de backups e tem o hash do aviso. */
async function conferirPacote(o: OpcoesVersaoReset, p: Pendencia): Promise<string> {
  const caminho = join(resolve(o.pastaBackups), p.pacote);
  const info = await lstat(caminho).catch(() => undefined);
  if (!info?.isFile() || info.isSymbolicLink() || info.size !== p.tamanho)
    throw new Recusa(PACOTE_RUIM);
  if ((await hashDoArquivo(caminho)) !== p.sha256) throw new Recusa(PACOTE_RUIM);
  return caminho;
}

/** Registra (uma vez só) e envia. Cartório ou trava falhou: fica pendente. Versão que não bate: recusa. */
async function concluir(o: OpcoesVersaoReset, p: Pendencia, caminho: string): Promise<Publicacao> {
  const renovar = async () => {
    if (!(await (o.renovarAgora ?? o.temTrava)())) throw new Error(SEM_TRAVA);
  };
  try {
    const ultimo = await o.cliente.ultimoRegistrado();
    if (ultimo === p.versao - 1) {
      await renovar();
      const numero = await o.cliente.criarVersao(o.epoca, {
        manifestoSha256: p.manifesto.sha256,
        arquivos: p.manifesto.arquivos,
        bytes: p.manifesto.bytes,
      });
      if (numero !== p.versao) throw new Recusa(NAO_BATE);
    } else if (ultimo === p.versao) {
      // Já registrada por este PC (o envio caiu antes): só falta o pacote, se a nuvem ainda não o tem.
      const guardada = await o.cliente.maisNova();
      if (guardada?.numero === p.versao) {
        await rm(caminhoDoMarcador(o.pastaDoServidor), { force: true });
        return { estado: "publicada", versao: p.versao };
      }
    } else {
      throw new Recusa(NAO_BATE);
    }
    await renovar();
    await o.cliente.enviarPacote(
      p.versao,
      o.epoca,
      { caminho, sha256: p.sha256, tamanho: p.tamanho },
      o.sinal,
    );
  } catch (erro) {
    if (erro instanceof Recusa) throw erro;
    return { estado: "pendente", versao: p.versao, aviso: AVISO_NAO_ESPALHADA };
  }
  await rm(caminhoDoMarcador(o.pastaDoServidor), { force: true });
  return { estado: "publicada", versao: p.versao };
}

type OpcoesAdiar = Pick<
  OpcoesVersaoReset,
  "pastaDoMundo" | "pastaBackups" | "pastaDoServidor" | "servidorParado" | "agora"
> & {
  /** Se este PC não souber (sem cartório), vale 0: a época só enfeita o manifesto do pacote. */
  epoca?: number;
  /** Número a usar (o seguinte ao do cartório); sem ele, o seguinte à maior versão local. */
  versao?: number;
};

/** Faz o pacote do mundo atual (só lê, servidor parado) e grava o marcador ANTES de falar com o cartório. */
async function prepararPendencia(o: OpcoesAdiar): Promise<{ p: Pendencia; destino: string }> {
  const mundo = resolve(o.pastaDoMundo);
  exigirMundoNaPastaDoServidor(mundo, o.pastaDoServidor);
  if (!o.servidorParado())
    throw new Error(
      "O servidor está rodando; pare o servidor antes de publicar a versão do mundo.",
    );
  if (existsSync(caminhoDoMarcador(o.pastaDoServidor))) throw new Recusa(PENDENTE_BLOQUEIA);
  // Sem cartório não dá para saber o número: chuta o seguinte à maior versão local (a retomada confere).
  const versao =
    o.versao ?? Math.max(0, ...(await listarBackups(o.pastaBackups)).map((b) => b.versao)) + 1;
  const destino = join(
    resolve(o.pastaBackups),
    nomeDoBackup((o.agora ?? (() => new Date()))(), versao),
  );
  if (existsSync(destino))
    throw new Error("Já existe um backup com esse nome; não escrevi por cima.");
  const feito = await criarPacote(mundo, destino, { versao, epoca: o.epoca ?? 0 });
  const p: Pendencia = {
    formato: 1,
    versao,
    pacote: basename(destino),
    sha256: feito.sha256,
    tamanho: feito.tamanho,
    manifesto: feito.manifesto,
  };
  await gravarAtomico(caminhoDoMarcador(o.pastaDoServidor), JSON.stringify(p)).catch(
    (erro: unknown) => {
      throw new Error(
        "Não consegui registrar a versão pendente ao lado do mundo; o reset foi feito, mas a versão não foi espalhada.",
        { cause: erro },
      );
    },
  );
  return { p, destino };
}

/** Sem vez de hospedar (cartório fora): guarda o pacote e o marcador; a retomada publica depois. */
export async function adiarVersaoDoMundo(o: OpcoesAdiar): Promise<Publicacao> {
  const { p } = await prepararPendencia(o);
  return { estado: "pendente", versao: p.versao, aviso: AVISO_NAO_ESPALHADA };
}

/** Pacote do mundo atual (servidor parado, trava) vira a versão N+1 no cartório. Cartório fora = pendente. */
export async function publicarVersaoDoMundo(o: OpcoesVersaoReset): Promise<Publicacao> {
  await exigirPodeTrocar(o, ACAO);
  const versao = await o.cliente.ultimoRegistrado().then(
    (u) => u + 1,
    () => undefined,
  );
  const { p, destino } = await prepararPendencia({
    ...o,
    ...(versao === undefined ? {} : { versao }),
  });
  return concluir(o, p, destino);
}

/** Antes de Hospedar/espalhar: termina a publicação de um reset que ficou pendente. */
export async function retomarVersaoPendente(
  o: OpcoesVersaoReset,
): Promise<{ estado: "nada" } | Publicacao> {
  const p = await lerPendencia(o);
  if (p === undefined) return { estado: "nada" };
  const caminho = await conferirPacote(o, p);
  await exigirPodeTrocar(o, ACAO);
  return concluir(o, p, caminho);
}

export interface PlanoDoDesfazer {
  nome: string;
  criadoEm: string;
  versao: number;
  /** Há backup mais novo (além do pacote do reset) ou versão do cartório mais nova: desfazer some com o que foi jogado. */
  jogadoDepois: boolean;
}

export interface OpcoesDesfazer extends OpcoesVersaoReset {
  /** Quem vai ao ar com `jogadoDepois` precisa ter confirmado (a tela do 1.6 mostra o aviso). */
  confirmado?: boolean;
  /** Restaura o backup pelo nome (o `restaurarBackup` do núcleo, que faz o backup do estado atual antes). */
  restaurar: (nome: string) => Promise<void>;
}

export type Desfeito =
  | { feito: false; plano: PlanoDoDesfazer }
  | { feito: true; plano: PlanoDoDesfazer; publicacao: Publicacao };

function acharUltimoReset(lista: BackupListado[]): {
  alvo: BackupListado;
  posteriores: BackupListado[];
} {
  const i = lista.findIndex((b) => b.origem === "antes-de-resetar"); // lista: mais novo primeiro
  const alvo = lista[i];
  if (alvo === undefined) throw new Recusa("Não há reset para desfazer.");
  const posteriores = lista.slice(0, i);
  if (posteriores.some((b) => b.origem === "antes-de-restaurar")) {
    throw new Recusa(
      "Esse reset já foi desfeito (ou o mundo foi restaurado depois). Use a lista de Backups para voltar mais.",
    );
  }
  return { alvo, posteriores };
}

export async function desfazerUltimoReset(o: OpcoesDesfazer): Promise<Desfeito> {
  exigirMundoNaPastaDoServidor(resolve(o.pastaDoMundo), o.pastaDoServidor);
  await exigirPodeTrocar(o, { parar: "desfazer o reset", fazer: "desfazer o reset" });
  if (existsSync(caminhoDoMarcador(o.pastaDoServidor))) throw new Recusa(PENDENTE_BLOQUEIA);
  const { alvo, posteriores } = acharUltimoReset(await listarBackups(o.pastaBackups));
  // O pacote da própria publicação do reset é o mais antigo depois do alvo (servidor parado: nada o antecede).
  const publicado = posteriores.at(-1);
  const doReset =
    publicado?.origem === "automatico" && publicado.versao > alvo.versao ? publicado : undefined;
  const ultimo = await o.cliente.ultimoRegistrado().catch(() => {
    throw new Recusa(SEM_CARTORIO);
  });
  const jogadoDepois =
    posteriores.length > (doReset ? 1 : 0) || ultimo > (doReset?.versao ?? alvo.versao);
  const plano: PlanoDoDesfazer = {
    nome: alvo.nome,
    criadoEm: alvo.criadoEm,
    versao: alvo.versao,
    jogadoDepois,
  };
  if (jogadoDepois && o.confirmado !== true) return { feito: false, plano };
  await o.restaurar(alvo.nome);
  return { feito: true, plano, publicacao: await publicarVersaoDoMundo(o) };
}
