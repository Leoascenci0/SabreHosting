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
import {
  MARCADOR_RESTAURACAO,
  MARCADOR_TROCA,
  MARCADOR_VERSAO_PENDENTE,
  gravarAtomico,
} from "../servidor/configurar.js";

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
  | { estado: "publicada"; versao: number }
  | { estado: "pendente"; versao: number; aviso: string }
  /** Outro PC já guardou essa versão com outro conteúdo: não apaga nem força; o servidor segue bloqueado. */
  | { estado: "conflito"; versao: number; aviso: string };

export const AVISO_NAO_ESPALHADA =
  "A versão do mundo ainda não foi espalhada: o cartório não respondeu. O mundo mudou só neste PC; o app tenta de novo antes de hospedar.";

export const AVISO_CONFLITO =
  "Outro PC já publicou essa versão do mundo com outro conteúdo. Este PC continua sem hospedar; avise o dono do grupo.";

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
const SEM_LISTA = "Não consegui ler a lista de backups; nada foi alterado.";
const SEM_PACOTE = "Não consegui montar o pacote do mundo; nada foi enviado.";
const TROCA_ABERTA =
  "A troca do mundo ainda não foi recuperada; abra o SabreHosting de novo para recuperar antes de publicar a versão.";
const PENDENTE_BLOQUEIA =
  "O reset ainda não foi espalhado para os outros PCs; conclua isso antes de desfazer.";

class Recusa extends Error {}

const NOME_PACOTE = /^\d{4,}-\d{2}-\d{2}T\d{2}-\d{2}-\d{2}-\d{3}Z-v\d+\.tar\.gz$/;
const SHA256 = /^[0-9a-f]{64}$/;
const inteiro = (v: unknown, min: number): v is number =>
  typeof v === "number" && Number.isSafeInteger(v) && v >= min;

/** O mundo vai ser (ou foi) trocado e ainda não há pacote: gravado ANTES da troca, vale para queda no meio. */
interface PendenciaTroca {
  formato: 1;
  fase: "mundo-trocando";
}

interface Pendencia {
  formato: 1;
  fase: "pacote";
  versao: number;
  /** Só o nome do arquivo, dentro da pasta de backups. */
  pacote: string;
  sha256: string;
  tamanho: number;
  manifesto: { sha256: string; arquivos: number; bytes: number };
}

const caminhoDoMarcador = (pastaDoServidor: string) =>
  join(pastaDoServidor, MARCADOR_VERSAO_PENDENTE);

async function lerPendencia(
  pastaDoServidor: string,
): Promise<Pendencia | PendenciaTroca | undefined> {
  let texto: string;
  try {
    texto = await readFile(caminhoDoMarcador(pastaDoServidor), "utf8");
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
  if (j?.["formato"] === 1 && j["fase"] === "mundo-trocando") {
    return { formato: 1, fase: "mundo-trocando" };
  }
  const m = (j?.["manifesto"] ?? {}) as Record<string, unknown>;
  if (
    j?.["formato"] !== 1 ||
    j["fase"] !== "pacote" ||
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
  const hash = await hashDoArquivo(caminho).catch(() => undefined); // sem o erro cru: traz caminho
  if (hash !== p.sha256) throw new Recusa(PACOTE_RUIM);
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
        // Regra 5: só é o mesmo mundo se o hash do manifesto guardado é o nosso; outro PC pode ter publicado N+1.
        if (guardada.manifestoSha256 !== p.manifesto.sha256) {
          return { estado: "conflito", versao: p.versao, aviso: AVISO_CONFLITO };
        }
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

const listar = (pasta: string) =>
  listarBackups(pasta).catch((erro: unknown) => {
    throw new Error(SEM_LISTA, { cause: erro });
  });

/** Faz o pacote do mundo atual (só lê, servidor parado) e grava o marcador ANTES de falar com o cartório. */
async function prepararPendencia(o: OpcoesAdiar): Promise<{ p: Pendencia; destino: string }> {
  const mundo = resolve(o.pastaDoMundo);
  exigirMundoNaPastaDoServidor(mundo, o.pastaDoServidor);
  if (!o.servidorParado())
    throw new Error(
      "O servidor está rodando; pare o servidor antes de publicar a versão do mundo.",
    );
  // Só o marcador "mundo-trocando" (o do próprio fluxo) deixa passar; versão pendente de verdade recusa.
  const antes = await lerPendencia(o.pastaDoServidor);
  if (antes !== undefined && antes.fase !== "mundo-trocando") throw new Recusa(PENDENTE_BLOQUEIA);
  // Sem cartório não dá para saber o número: chuta o seguinte à maior versão local (a retomada confere).
  const versao =
    o.versao ?? Math.max(0, ...(await listar(o.pastaBackups)).map((b) => b.versao)) + 1;
  const destino = join(
    resolve(o.pastaBackups),
    nomeDoBackup((o.agora ?? (() => new Date()))(), versao),
  );
  if (existsSync(destino))
    throw new Error("Já existe um backup com esse nome; não escrevi por cima.");
  const feito = await criarPacote(mundo, destino, { versao, epoca: o.epoca ?? 0 }).catch(
    (erro: unknown) => {
      throw new Error(SEM_PACOTE, { cause: erro });
    },
  );
  const p: Pendencia = {
    formato: 1,
    fase: "pacote",
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

/**
 * ANTES de trocar o mundo (reset ou desfazer): grava o marcador "mundo-trocando". Queda ou falha depois da troca deixa
 * o servidor bloqueado e a retomada publica o mundo que estiver lá. Recusa se já há versão pendente.
 */
export async function marcarMundoTrocando(o: { pastaDoServidor: string }): Promise<void> {
  if ((await lerPendencia(o.pastaDoServidor)) !== undefined) throw new Recusa(PENDENTE_BLOQUEIA);
  const marca: PendenciaTroca = { formato: 1, fase: "mundo-trocando" };
  await gravarAtomico(caminhoDoMarcador(o.pastaDoServidor), JSON.stringify(marca)).catch(
    (erro: unknown) => {
      throw new Error("Não consegui registrar a troca do mundo; o mundo não foi alterado.", {
        cause: erro,
      });
    },
  );
}

/**
 * Saída do beco (conflito ou número que não bate): remove SÓ o marcador. Nunca apaga mundo nem backup; o mundo local
 * segue com o backup antes-de-resetar e a regra 5 manda depois (versão velha atualiza pelo espalhar). Quem liga a isto
 * (tela, confirmação do dono) é o 1.5/1.6.
 */
export async function descartarPendencia(o: { pastaDoServidor: string }): Promise<void> {
  await rm(caminhoDoMarcador(o.pastaDoServidor), { force: true }).catch((erro: unknown) => {
    throw new Error("Não consegui apagar o aviso da versão pendente.", { cause: erro });
  });
}

/** Antes de Hospedar/espalhar: termina a publicação de um reset que ficou pendente. */
export async function retomarVersaoPendente(
  o: OpcoesVersaoReset,
): Promise<{ estado: "nada" } | Publicacao> {
  const p = await lerPendencia(o.pastaDoServidor);
  if (p === undefined) return { estado: "nada" };
  if (p.fase === "mundo-trocando") {
    await exigirPodeTrocar(o, ACAO);
    // Só depois da recuperação: com troca parada no meio o mundo na pasta pode estar pela metade.
    if (
      existsSync(join(o.pastaDoServidor, MARCADOR_TROCA)) ||
      existsSync(join(o.pastaDoServidor, MARCADOR_RESTAURACAO))
    ) {
      throw new Recusa(TROCA_ABERTA);
    }
    return publicarVersaoDoMundo(o);
  }
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
  if ((await lerPendencia(o.pastaDoServidor)) !== undefined) throw new Recusa(PENDENTE_BLOQUEIA);
  const { alvo, posteriores } = acharUltimoReset(await listar(o.pastaBackups));
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
  await marcarMundoTrocando(o); // antes da troca: queda ou falha daqui em diante deixa o servidor bloqueado
  await o.restaurar(alvo.nome);
  try {
    return { feito: true, plano, publicacao: await publicarVersaoDoMundo(o) };
  } catch (erro) {
    if (erro instanceof Recusa) throw erro;
    // O mundo já trocou: guarda o pacote e o marcador com versão para a retomada (não precisa de trava).
    return { feito: true, plano, publicacao: await adiarVersaoDoMundo(o) };
  }
}
