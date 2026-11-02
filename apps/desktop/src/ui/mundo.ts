import type {
  AreaDoResetDaTela,
  BackupDaTela,
  EstadoMundo,
  PlanoDoResetDaTela,
  PonteSabre,
  RegiaoDaTela,
} from "./ponte.js";
import { dataEmPalavras } from "./ha-quanto.js";
import {
  areaDosCampos,
  camposDasRegioes,
  confirmaNome,
  situacaoDaTela,
  tamanhoCurto,
  textoDaPublicacao,
  textoDoPlano,
  textoPendencia,
  type CamposDaArea,
  type ModoDaArea,
} from "./mundo-regras.js";

declare global {
  interface Window {
    sabre: PonteSabre;
  }
}

// Aba Mundo (chunk-1.6): a tela só junta o que o amigo escolhe e mostra o que o main devolve. Plano, backup, troca
// e todas as recusas moram no main (`main/mundo.ts`); aqui o botão só liga e desliga e o texto vem pronto.
const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`falta #${id}`);
  return el as T;
};
const tela = $("tela-mundo");
const titulo = $("titulo-mundo");
const resultadoEl = $("mundo-resultado");
const erroEl = $("mundo-erro");
const soDono = $("mundo-so-dono");
const area = $("mundo-area");
const pendencia = $("mundo-pendencia");
const pendenciaTexto = $("mundo-pendencia-texto");
const descartar = $<HTMLButtonElement>("mundo-descartar");
const dimensao = $<HTMLSelectElement>("mundo-dimensao");
const camposRetangulo = $("mundo-campos-retangulo");
const camposRaio = $("mundo-campos-raio");
const grade = $("mundo-grade");
const gradeInfo = $("mundo-grade-vazio");
const verPrevia = $<HTMLButtonElement>("mundo-ver-previa");
const grande = $("mundo-grande");
const grandeTexto = $("mundo-grande-texto");
const grandeSim = $<HTMLButtonElement>("mundo-grande-sim");
const grandeNao = $<HTMLButtonElement>("mundo-grande-nao");
const previaEl = $("mundo-previa");
const previaTitulo = $("mundo-previa-titulo");
const previaLinhas = $("mundo-previa-linhas");
const resetar = $<HTMLButtonElement>("mundo-resetar");
const dica = $("mundo-dica");
const desfazer = $<HTMLButtonElement>("mundo-desfazer");
const desfazerInfo = $("mundo-desfazer-info");
const confirmacao = $("mundo-confirmacao");
const pergunta = $("mundo-pergunta");
const perguntaAviso = $("mundo-pergunta-aviso");
const nomeRotulo = $("mundo-nome-rotulo");
const nomeDigitado = $<HTMLInputElement>("mundo-nome-digitado");
const confirmar = $<HTMLButtonElement>("mundo-confirmar");
const cancelar = $<HTMLButtonElement>("mundo-cancelar");
const progresso = $("mundo-progresso");
const voltar = $<HTMLButtonElement>("voltar-mundo"); // escondido: a barra navega e aciona este botão

const campo = (id: string): HTMLInputElement => $<HTMLInputElement>(id);
const CAMPOS = ["x1", "z1", "x2", "z2", "x", "z", "raio"] as const;

/** Prévia que o main devolveu; o reset usa exatamente esta área, nunca os campos como estiverem depois. */
interface Previa {
  dimensao: string;
  area: AreaDoResetDaTela;
  confirmouGrande: boolean;
  plano: PlanoDoResetDaTela;
  podeResetar: boolean;
}
type Confirmando = "resetar" | "desfazer" | "desfazer-forte" | "descartar";

let estado: EstadoMundo | undefined;
let regioes: RegiaoDaTela[] = [];
let ultimoReset: BackupDaTela | undefined;
let tamanhoMundo: number | undefined;
let previa: Previa | undefined;
let confirmando: Confirmando | undefined;
let quemAbriu: HTMLElement | undefined;
let pedindoGrande: { dimensao: string; area: AreaDoResetDaTela } | undefined;
let emCurso = false;
let geracao = 0; // resposta atrasada de uma leitura antiga não sobrescreve a mais nova (S-06)
const marcadas = new Map<string, RegiaoDaTela>();

const nome = (): string => (estado?.dono === true ? estado.nome : "");
const emDemonstracao = (): boolean => situacaoDaTela(estado).demonstracao === true;
const modo = (): ModoDaArea =>
  $<HTMLInputElement>("mundo-modo-raio").checked ? "raio" : "retangulo";
const lerCampos = (): CamposDaArea => {
  const c = {} as Record<(typeof CAMPOS)[number], string>;
  for (const k of CAMPOS) c[k] = campo(`mundo-${k}`).value;
  return c;
};

function mostrarErro(texto: string): void {
  erroEl.textContent = texto;
  erroEl.hidden = texto === "";
}

function atualizar(): void {
  const sit = situacaoDaTela(estado);
  soDono.hidden = sit.visao !== "so-dono";
  area.hidden = sit.visao !== "controles";
  if (sit.visao !== "controles") return;
  const motivo = sit.motivoDesligado;
  const pend = sit.pendencia;
  pendencia.hidden = pend === undefined || pend === "nenhuma";
  if (pend === "aguardando" || pend === "conflito")
    pendenciaTexto.textContent = textoPendencia(pend);
  // Descartar só existe no conflito; com o servidor ligado fica desligado (o main também recusa).
  descartar.hidden = pend !== "conflito";
  descartar.disabled = emCurso || (estado?.dono === true && estado.servidorLigado);
  const demo = sit.demonstracao === true;
  // Em demonstração os botões ligam de propósito: o clique mostra a recusa do main (que nunca escreve).
  resetar.disabled = emCurso || (!demo && (motivo !== undefined || !previa?.podeResetar));
  dica.textContent =
    motivo ??
    (demo
      ? "Isso é só uma demonstração: nada é apagado."
      : previa?.podeResetar
        ? ""
        : "Veja a prévia antes de resetar.");
  desfazer.disabled = emCurso || (!demo && (motivo !== undefined || ultimoReset === undefined));
  desfazerInfo.textContent =
    motivo ??
    (ultimoReset
      ? `Último reset: backup “Antes de resetar” de ${dataEmPalavras(ultimoReset.criadoEm) ?? "data desconhecida"}.`
      : demo
        ? ""
        : "Ainda não há reset para desfazer.");
  verPrevia.disabled = emCurso;
  dimensao.disabled = emCurso;
  for (const k of CAMPOS) campo(`mundo-${k}`).disabled = emCurso;
  for (const b of grade.querySelectorAll("button")) b.disabled = emCurso;
  confirmar.disabled = emCurso || !confirmaNome(nomeDigitado.value, nome());
  cancelar.disabled = emCurso;
  tela.setAttribute("aria-busy", String(emCurso));
  progresso.hidden = !emCurso;
}

function desenharGrade(): void {
  const lista = regioes;
  const xs = lista.map((r) => r.x);
  const zs = lista.map((r) => r.z);
  const largura = lista.length ? Math.max(...xs) - Math.min(...xs) + 1 : 0;
  const altura = lista.length ? Math.max(...zs) - Math.min(...zs) + 1 : 0;
  // Posição de verdade só enquanto cabe na janela; mundo muito espalhado vira lista que quebra linha.
  const espacial = largura > 0 && largura <= 12 && altura <= 12;
  grade.classList.toggle("espacial", espacial);
  grade.style.gridTemplateColumns = espacial ? `repeat(${largura}, var(--celula-regiao))` : "";
  grade.replaceChildren(
    ...lista.map((r) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "regiao";
      const chave = `${r.x},${r.z}`;
      b.setAttribute("aria-pressed", String(marcadas.has(chave)));
      b.setAttribute(
        "aria-label",
        `Região ${r.x}, ${r.z}, com ${r.chunks.toLocaleString("pt-BR")} ${r.chunks === 1 ? "chunk" : "chunks"}`,
      );
      b.textContent = `${r.x}, ${r.z}`;
      if (espacial) {
        b.style.gridColumn = String(r.x - Math.min(...xs) + 1);
        b.style.gridRow = String(r.z - Math.min(...zs) + 1);
      }
      b.addEventListener("click", () => marcar(r, b));
      return b;
    }),
  );
  gradeInfo.hidden = false;
  gradeInfo.textContent =
    lista.length === 0
      ? "Ainda não há regiões salvas nesta dimensão."
      : `${lista.length} ${lista.length === 1 ? "região salva" : "regiões salvas"}${
          tamanhoMundo === undefined ? "" : `; o mundo todo tem ${tamanhoCurto(tamanhoMundo)}`
        }.`;
}

function marcar(r: RegiaoDaTela, botao: HTMLElement): void {
  const chave = `${r.x},${r.z}`;
  if (marcadas.has(chave)) marcadas.delete(chave);
  else marcadas.set(chave, r);
  botao.setAttribute("aria-pressed", String(marcadas.has(chave)));
  if (marcadas.size > 0) {
    const c = camposDasRegioes([...marcadas.values()]);
    $<HTMLInputElement>("mundo-modo-retangulo").checked = true;
    trocarModo();
    for (const k of ["x1", "z1", "x2", "z2"] as const) campo(`mundo-${k}`).value = c[k];
  }
  areaMudou();
}

function trocarModo(): void {
  camposRetangulo.hidden = modo() !== "retangulo";
  camposRaio.hidden = modo() !== "raio";
}

/** Qualquer mudança na escolha apaga a prévia: o botão Resetar só vale para a área que foi vista. */
function areaMudou(): void {
  previa = undefined;
  pedindoGrande = undefined;
  previaEl.hidden = true;
  grande.hidden = true;
  fecharConfirmacao(false);
  atualizar();
}

async function carregarRegioes(): Promise<void> {
  const minha = ++geracao;
  try {
    const r = await window.sabre.mundo.regioes(dimensao.value);
    if (minha !== geracao) return;
    if (r.ok) {
      regioes = r.regioes;
      tamanhoMundo = r.tamanhoMundo;
      marcadas.clear();
      desenharGrade();
    } else {
      regioes = [];
      desenharGrade();
      gradeInfo.textContent = r.mensagem;
    }
  } catch {
    if (minha !== geracao) return;
    regioes = [];
    desenharGrade();
    gradeInfo.textContent = "Não consegui ler as regiões agora.";
  }
}

async function carregar(): Promise<void> {
  try {
    const novo = await window.sabre.mundo.estado();
    estado = novo;
    atualizar();
    if (situacaoDaTela(novo).visao !== "controles") return;
    const [, backups] = await Promise.all([
      carregarRegioes(),
      window.sabre.backups.listar().catch(() => undefined),
    ]);
    const resets = (backups?.itens ?? []).filter((b) => b.origem === "antes-de-resetar");
    ultimoReset = resets.sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))[0];
  } catch {
    mostrarErro("Não consegui ler o estado do mundo agora.");
  }
  atualizar();
}

function comecar(texto: string): void {
  emCurso = true;
  mostrarErro("");
  resultadoEl.textContent = texto;
  atualizar();
}
function terminar(): void {
  emCurso = false;
  atualizar();
  void carregar();
}

verPrevia.addEventListener("click", () => void pedirPrevia(false));
async function pedirPrevia(confirmouGrande: boolean): Promise<void> {
  if (emCurso) return;
  mostrarErro("");
  resultadoEl.textContent = "";
  previa = undefined;
  previaEl.hidden = true;
  grande.hidden = true;
  const lida = areaDosCampos(modo(), lerCampos());
  if (!lida.ok) return mostrarErro(lida.mensagem);
  const dim = dimensao.value;
  comecar("Calculando a prévia…");
  try {
    const r = await window.sabre.mundo.planejar(dim, lida.area, confirmouGrande);
    resultadoEl.textContent = "";
    if (r.ok) {
      const t = textoDoPlano(r.plano, tamanhoMundo);
      previa = {
        dimensao: dim,
        area: lida.area,
        confirmouGrande,
        plano: r.plano,
        podeResetar: t.podeResetar,
      };
      previaTitulo.textContent = t.titulo;
      previaLinhas.replaceChildren(
        ...t.linhas.map((l) => Object.assign(document.createElement("li"), { textContent: l })),
      );
      previaEl.hidden = false;
    } else if (r.chunksNaArea !== undefined && !confirmouGrande) {
      // Área acima do teto sem confirmar (1.024 chunks / raio de 1.000 blocos): pergunta, mostrando o número.
      pedindoGrande = { dimensao: dim, area: lida.area };
      grandeTexto.textContent = `Essa área é grande: cobre ${r.chunksNaArea.toLocaleString("pt-BR")} chunks (sem perguntar, vale até 1.024 chunks ou raio de 1.000 blocos). Quer ver a prévia mesmo assim?`;
      grande.hidden = false;
      grandeSim.focus();
    } else mostrarErro(r.mensagem);
  } catch {
    mostrarErro("Não consegui calcular a prévia agora. Nada foi alterado.");
  }
  emCurso = false;
  atualizar();
}
grandeSim.addEventListener("click", () => {
  const pedido = pedindoGrande;
  if (!pedido || emCurso) return;
  void pedirPrevia(true);
});
grandeNao.addEventListener("click", () => {
  grande.hidden = true;
  pedindoGrande = undefined;
  campo("mundo-x1").focus();
});

/** Mostra o bloco de confirmação; o dono digita o nome do mundo e só então o botão de perigo liga. */
function abrirConfirmacao(
  tipo: Confirmando,
  texto: string,
  rotulo: string,
  aviso?: string,
  origem?: HTMLElement,
): void {
  confirmando = tipo;
  quemAbriu = origem ?? quemAbriu;
  pergunta.textContent = texto;
  perguntaAviso.textContent = aviso ?? "";
  perguntaAviso.hidden = aviso === undefined;
  nomeRotulo.textContent = `Digite o nome do mundo (${nome()}) para confirmar`;
  nomeDigitado.value = "";
  confirmar.textContent = rotulo;
  confirmacao.hidden = false;
  atualizar();
  nomeDigitado.focus();
}
function fecharConfirmacao(devolverFoco: boolean): void {
  const ia = quemAbriu;
  confirmando = undefined;
  confirmacao.hidden = true;
  nomeDigitado.value = "";
  if (devolverFoco) ia?.focus();
}

nomeDigitado.addEventListener("input", atualizar);
nomeDigitado.addEventListener("keydown", (e) => {
  if (e.key === "Enter" && !confirmar.disabled) confirmar.click();
});
confirmacao.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && !emCurso) {
    e.preventDefault();
    fecharConfirmacao(true);
    atualizar();
  }
});
cancelar.addEventListener("click", () => {
  fecharConfirmacao(true);
  atualizar();
});

const AGORA = (): string => dataEmPalavras(new Date().toISOString()) ?? "agora";

resetar.addEventListener("click", () => {
  if (emCurso) return;
  if (emDemonstracao()) return void tentarNaDemonstracao("resetar");
  if (!previa?.podeResetar) return;
  const n = previa.plano.chunksExistentes;
  abrirConfirmacao(
    "resetar",
    `Apagar ${n.toLocaleString("pt-BR")} ${n === 1 ? "chunk" : "chunks"} do mundo “${nome()}”? Um backup é feito agora (${AGORA()}) e dá para voltar com “Desfazer o último reset”.`,
    "Resetar a área",
    undefined,
    resetar,
  );
});

desfazer.addEventListener("click", () => {
  if (emCurso) return;
  if (emDemonstracao()) return void tentarNaDemonstracao("desfazer");
  if (!ultimoReset) return;
  // A 1ª confirmação é sempre da tela: o núcleo só devolve o plano (sem trocar nada) quando há jogo depois do reset.
  abrirConfirmacao(
    "desfazer",
    `Desfazer o último reset? O mundo “${nome()}” volta ao backup de ${dataEmPalavras(ultimoReset.criadoEm) ?? "data desconhecida"} (feito antes de resetar). O estado de agora é guardado num backup antes da troca.`,
    "Desfazer o reset",
    undefined,
    desfazer,
  );
});

descartar.addEventListener("click", () => {
  if (emCurso) return;
  abrirConfirmacao(
    "descartar",
    `Descartar o aviso do mundo “${nome()}”? Nenhum arquivo do mundo nem backup é apagado; este PC passa a seguir a versão mais nova do grupo.`,
    "Descartar o aviso",
    undefined,
    descartar,
  );
});

/** Demonstração: o clique chega ao main, que recusa com o texto de sempre e nunca escreve. */
async function tentarNaDemonstracao(qual: "resetar" | "desfazer"): Promise<void> {
  mostrarErro("");
  const lida = areaDosCampos(modo(), lerCampos());
  const r =
    qual === "desfazer"
      ? await window.sabre.mundo.desfazer(false).catch(() => undefined)
      : lida.ok
        ? await window.sabre.mundo.resetar(dimensao.value, lida.area).catch(() => undefined)
        : undefined;
  if (!lida.ok && qual === "resetar") mostrarErro(lida.mensagem);
  else if (r && !r.ok) mostrarErro(r.mensagem);
}

confirmar.addEventListener("click", () => {
  const tipo = confirmando;
  if (!tipo || emCurso || !confirmaNome(nomeDigitado.value, nome())) return;
  fecharConfirmacao(false);
  if (tipo === "resetar") void fazerReset();
  else if (tipo === "descartar") void fazerDescartar();
  else void fazerDesfazer(tipo === "desfazer-forte");
});

async function fazerReset(): Promise<void> {
  const p = previa;
  if (!p) return;
  comecar("Resetando… faz o backup e troca os arquivos. Não feche o app.");
  try {
    const r = await window.sabre.mundo.resetar(p.dimensao, p.area, p.confirmouGrande);
    resultadoEl.textContent = "";
    if (r.ok) {
      resultadoEl.textContent = textoDaPublicacao(r.publicacao, r.chunksApagados);
      areaMudou();
    } else mostrarErro(r.mensagem);
  } catch {
    mostrarErro(
      "Não consegui confirmar o reset. Veja a lista de Backups e reabra o app antes de tentar de novo.",
    );
  }
  terminar();
}

async function fazerDesfazer(forte: boolean): Promise<void> {
  comecar("Desfazendo o reset… não feche o app.");
  try {
    const r = await window.sabre.mundo.desfazer(forte);
    resultadoEl.textContent = "";
    if (!r.ok) mostrarErro(r.mensagem);
    else if (!r.feito) {
      // Foi jogado depois do reset: desfazer some com isso; só segue com a 2ª confirmação do dono.
      emCurso = false;
      abrirConfirmacao(
        "desfazer-forte",
        `Desfazer o último reset do mundo “${nome()}”?`,
        "Desfazer mesmo assim",
        "Atenção: o mundo foi jogado depois desse reset. Desfazer faz o que foi jogado desde então sumir do mundo (fica guardado num backup “Antes de restaurar”).",
        desfazer,
      );
      return;
    } else {
      resultadoEl.textContent = textoDaPublicacao(r.publicacao, undefined, "Antes de restaurar");
    }
  } catch {
    mostrarErro(
      "Não consegui confirmar o desfazer. Veja a lista de Backups e reabra o app antes de tentar de novo.",
    );
  }
  terminar();
}

async function fazerDescartar(): Promise<void> {
  comecar("Descartando o aviso…");
  try {
    const r = await window.sabre.mundo.descartarPendencia(true);
    resultadoEl.textContent = "";
    if (r.ok)
      resultadoEl.textContent = "Aviso descartado. Nenhum arquivo do mundo nem backup foi apagado.";
    else mostrarErro(r.mensagem);
  } catch {
    mostrarErro("Não consegui descartar o aviso agora. Nada foi alterado.");
  }
  terminar();
}

for (const k of CAMPOS)
  campo(`mundo-${k}`).addEventListener("input", () => {
    marcadas.clear();
    for (const b of grade.querySelectorAll("button")) b.setAttribute("aria-pressed", "false");
    areaMudou();
  });
for (const id of ["mundo-modo-retangulo", "mundo-modo-raio"])
  $(id).addEventListener("change", () => {
    trocarModo();
    areaMudou();
  });
dimensao.addEventListener("change", () => {
  areaMudou();
  void carregarRegioes();
});

// Abrir a aba (a barra aciona o botão escondido) recarrega tudo; o resto do tempo a tela só reage ao main.
let estavaEscondida = true;
new MutationObserver(() => {
  if (tela.hidden) {
    estavaEscondida = true;
    return;
  }
  if (!estavaEscondida) return;
  estavaEscondida = false;
  mostrarErro("");
  resultadoEl.textContent = "";
  fecharConfirmacao(false);
  areaMudou();
  void carregar();
  titulo.focus();
}).observe(tela, { attributes: true, attributeFilter: ["hidden"] });
voltar.addEventListener("click", () => {
  tela.hidden = true;
  $("cartao").hidden = false;
});
window.sabre.inicio.aoProgresso(() => {
  if (!tela.hidden && !emCurso) void carregar();
});
trocarModo();
