import { tamanhoDe } from "./backups-resumo.js";
import type {
  AreaDoResetDaTela,
  EstadoMundo,
  PlanoDoResetDaTela,
  PublicacaoDaTela,
} from "./ponte.js";

// Regras puras da aba Mundo (chunk-1.6), sem tela. O plano, o backup, a troca e as recusas moram no main: aqui só
// se converte o que o amigo digita em área, se escreve a prévia em palavras e se decide o que a tela mostra.

export type ModoDaArea = "retangulo" | "raio";
export interface CamposDaArea {
  x1: string;
  z1: string;
  x2: string;
  z2: string;
  x: string;
  z: string;
  raio: string;
}
export type AreaLida = { ok: true; area: AreaDoResetDaTela } | { ok: false; mensagem: string };

const LIMITE_BLOCO = 29_999_984; // borda do mundo do Minecraft; o main revalida
const INTEIRO = /^-?\d{1,9}$/;
const SO_NUMERO =
  "Preencha todos os campos da área com número inteiro, em blocos (ex.: 0, -250, 1200).";
/** Uma região do disco junta 32 x 32 chunks = 512 x 512 blocos. */
const BLOCOS_DA_REGIAO = 512;

const lido = (t: string): number | undefined => {
  const limpo = t.trim();
  if (!INTEIRO.test(limpo)) return undefined;
  const n = Number(limpo);
  return Math.abs(n) <= LIMITE_BLOCO ? n + 0 : undefined; // `+ 0` tira o -0
};
const chunkDoBloco = (b: number): number => Math.floor(b / 16);

/** Campos em blocos → área do main (retângulo em chunks; raio em blocos). */
export function areaDosCampos(modo: ModoDaArea, c: CamposDaArea): AreaLida {
  if (modo === "raio") {
    const [x, z, raio] = [lido(c.x), lido(c.z), lido(c.raio)];
    if (x === undefined || z === undefined || raio === undefined)
      return { ok: false, mensagem: SO_NUMERO };
    if (raio < 1) return { ok: false, mensagem: "O raio precisa ser de pelo menos 1 bloco." };
    return { ok: true, area: { tipo: "raio", x, z, raio } };
  }
  const [x1, z1, x2, z2] = [lido(c.x1), lido(c.z1), lido(c.x2), lido(c.z2)];
  if (x1 === undefined || z1 === undefined || x2 === undefined || z2 === undefined)
    return { ok: false, mensagem: SO_NUMERO };
  return {
    ok: true,
    area: {
      tipo: "retangulo",
      x1: chunkDoBloco(x1),
      z1: chunkDoBloco(z1),
      x2: chunkDoBloco(x2),
      z2: chunkDoBloco(z2),
    },
  };
}

/** Regiões clicadas na grade → campos do retângulo (em blocos): o menor retângulo que contém todas. */
export function camposDasRegioes(
  marcadas: ReadonlyArray<{ x: number; z: number }>,
): Pick<CamposDaArea, "x1" | "z1" | "x2" | "z2"> {
  const xs = marcadas.map((r) => r.x);
  const zs = marcadas.map((r) => r.z);
  return {
    x1: String(Math.min(...xs) * BLOCOS_DA_REGIAO),
    z1: String(Math.min(...zs) * BLOCOS_DA_REGIAO),
    x2: String(Math.max(...xs) * BLOCOS_DA_REGIAO + BLOCOS_DA_REGIAO - 1),
    z2: String(Math.max(...zs) * BLOCOS_DA_REGIAO + BLOCOS_DA_REGIAO - 1),
  };
}

const chunks = (n: number): string =>
  `${n.toLocaleString("pt-BR")} ${n === 1 ? "chunk" : "chunks"}`;
const SETOR = 4096;

/** "2,2 GB" a partir de 1 GB; abaixo disso KB/MB. */
export function tamanhoCurto(bytes: number): string {
  const gb = bytes / 1024 ** 3;
  return gb >= 1
    ? `${gb.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} GB`
    : tamanhoDe(bytes);
}

export interface TextoDoPlano {
  titulo: string;
  linhas: string[];
  podeResetar: boolean;
}

/**
 * Prévia em palavras simples. Zerar o cabeçalho de um chunk não encolhe o `.mca`: só a região que sai inteira libera
 * o arquivo; o resto vira espaço que o jogo reaproveita ("setores reaproveitáveis" no núcleo). Número sempre com a
 * comparação (o mundo todo) ou, sem ela, a razão.
 */
export function textoDoPlano(
  p: PlanoDoResetDaTela,
  tamanhoMundo: number | undefined,
): TextoDoPlano {
  if (p.chunksExistentes === 0)
    return {
      titulo: "Não existe nenhum chunk nessa área.",
      linhas: ["Nada será apagado. Escolha outra área."],
      podeResetar: false,
    };
  const reaproveitavel = p.setoresReaproveitaveis * SETOR;
  const total = p.bytesLiberados + reaproveitavel;
  const comparacao =
    tamanhoMundo === undefined
      ? "(o tamanho do mundo todo não está disponível agora)"
      : `de ${tamanhoCurto(tamanhoMundo)} no mundo todo`;
  const linhas = [`Libera cerca de ${tamanhoCurto(total)} ${comparacao}.`];
  if (reaproveitavel > 0)
    linhas.push(
      `${tamanhoCurto(reaproveitavel)} disso fica livre dentro dos arquivos para o jogo reaproveitar; o arquivo só diminui quando a região inteira é apagada.`,
    );
  if (p.regioesApagadasInteiras > 0)
    linhas.push(
      `${p.regioesApagadasInteiras} ${p.regioesApagadasInteiras === 1 ? "região sai inteira" : "regiões saem inteiras"} (${tamanhoCurto(p.bytesLiberados)}).`,
    );
  linhas.push("Um backup é feito antes.");
  return { titulo: `Vai apagar ${chunks(p.chunksExistentes)}.`, linhas, podeResetar: true };
}

/** Confirma apagar: o dono digita o nome do mundo; só o nome exato vale (espaço nas pontas não conta, caixa conta). */
export function confirmaNome(digitado: string, nome: string): boolean {
  return nome !== "" && digitado.trim() === nome;
}

export const DICA_SERVIDOR_LIGADO = "Pare o servidor para resetar";
const DICA_PENDENTE = "Conclua o reset anterior antes de resetar de novo";

export interface Situacao {
  visao: "carregando" | "so-dono" | "controles";
  demonstracao?: boolean;
  /** Por que Resetar e Desfazer estão desligados (a dica fica visível, não só no `title`). */
  motivoDesligado?: string;
  pendencia?: "nenhuma" | "aguardando" | "conflito";
  nome?: string;
}

export function situacaoDaTela(e: EstadoMundo | undefined): Situacao {
  if (e === undefined) return { visao: "carregando" };
  if (!e.dono)
    return e.demonstracao === true
      ? { visao: "controles", demonstracao: true } // mostra e deixa o main recusar (nunca escreve)
      : { visao: "so-dono" };
  const motivoDesligado = e.servidorLigado
    ? DICA_SERVIDOR_LIGADO
    : e.pendencia === "nenhuma"
      ? undefined
      : DICA_PENDENTE;
  return { visao: "controles", motivoDesligado, pendencia: e.pendencia, nome: e.nome };
}

const SEM_TERMO = {
  aguardando:
    "Há um reset feito neste PC que ainda não foi enviado ao grupo. O que fazer: deixe o app aberto com internet e clique em Hospedar; ele tenta enviar antes de ligar o servidor. Até lá, ninguém hospeda daqui e não dá para resetar de novo.",
  conflito:
    "O mundo daqui e o do grupo divergiram: o grupo recebeu mudanças que este PC não tem. Nada é apagado: o backup “Antes de resetar” continua na lista de Backups. Para voltar a hospedar, descarte este aviso; este PC passa a seguir a versão mais nova do grupo e o reset feito aqui pode ser substituído por ela.",
} as const;

export const textoPendencia = (p: "aguardando" | "conflito"): string => SEM_TERMO[p];

/** Resultado de um reset (ou de desfazer) em palavras; `aviso` vem do main, em texto fixo. */
export function textoDaPublicacao(
  pub: PublicacaoDaTela,
  chunksApagados: number | undefined,
  /** Nome, na lista de Backups, do backup que ficou do estado de antes ("Antes de resetar" ou "Antes de restaurar"). */
  backupDeAntes = "Antes de resetar",
): string {
  const feito =
    chunksApagados === undefined
      ? "Pronto neste PC."
      : `Pronto neste PC: ${chunks(chunksApagados)} apagados.`;
  if (pub.estado === "publicada")
    return `${feito} A versão ${pub.versao} do mundo já foi enviada ao grupo. O backup de antes está na lista de Backups (“${backupDeAntes}”).`;
  if (pub.estado === "pendente")
    return `${feito} Falta enviar a versão ao grupo: ${pub.aviso} ${SEM_TERMO.aguardando}`;
  return `${feito} ${SEM_TERMO.conflito}`;
}
