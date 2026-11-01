import type { BackupDaTela, PonteSabre } from "./ponte.js";
import { dataEmPalavras } from "./ha-quanto.js";

declare global {
  interface Window {
    sabre: PonteSabre;
  }
}

const $ = <T extends HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`falta #${id}`);
  return el as T;
};
const inicio = $("cartao");
const tela = $("tela-backups");
const detalhe = $("backups-detalhe");
const erro = $("backups-erro");
const avisoHistorico = $("backups-aviso-historico");
const lista = $("lista-backups");
const confirmacao = $("backups-confirmacao");
const pergunta = $("backups-pergunta");
const confirmar = $<HTMLButtonElement>("backups-confirmar");
const cancelar = $<HTMLButtonElement>("backups-cancelar");
const voltar = $<HTMLButtonElement>("voltar-backups"); // escondido: a barra lateral navega e aciona este botão
const titulo = $("titulo-backups");
const progresso = $("backups-progresso");
const vazio = $("backups-vazio");
const abrir = $<HTMLButtonElement>("ver-backups");

let escolhido: BackupDaTela | undefined;
let emCurso = false;
let bloqueado = false;
let botaoDoEscolhido: HTMLElement | undefined;
let resultado = ""; // "Pronto…" fica na tela até a próxima ação; a lista recarregada não o apaga

const dataDe = (iso: string): string => dataEmPalavras(iso) ?? "data desconhecida";

function tamanhoDe(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb < 1
    ? `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("pt-BR")} KB`
    : `${mb.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

function mostrarErro(texto: string): void {
  erro.textContent = texto;
  erro.hidden = texto === "";
}

function atualizarBotoes(): void {
  for (const b of lista.querySelectorAll("button")) b.disabled = bloqueado || emCurso;
  confirmar.disabled = cancelar.disabled = voltar.disabled = emCurso;
}

function desenhar(itens: BackupDaTela[]): void {
  lista.replaceChildren(
    ...itens.map((b) => {
      const li = document.createElement("li");
      const texto = document.createElement("span");
      const quando = document.createElement("span");
      quando.className = "quando";
      quando.textContent = dataDe(b.criadoEm);
      texto.append(quando);
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = `${tamanhoDe(b.tamanho)} · ${b.dePc}`;
      texto.append(meta);
      const botao = document.createElement("button");
      botao.type = "button";
      botao.className = "secundario";
      botao.textContent = "Restaurar";
      botao.setAttribute("aria-label", `Restaurar o backup de ${dataDe(b.criadoEm)}`);
      botao.addEventListener("click", () => {
        escolhido = b;
        botaoDoEscolhido = botao;
        pergunta.textContent = `Voltar o mundo para o backup de ${dataDe(b.criadoEm)} (${tamanhoDe(b.tamanho)})? O mundo de agora será trocado por ele.`;
        confirmacao.hidden = false;
        cancelar.focus();
      });
      li.append(texto, botao);
      return li;
    }),
  );
  atualizarBotoes();
}

async function carregar(): Promise<void> {
  try {
    const estado = await window.sabre.backups.listar();
    bloqueado = estado.bloqueado;
    desenhar(estado.itens);
    mostrarErro(estado.erro ?? "");
    avisoHistorico.textContent = estado.avisoHistorico ?? "";
    avisoHistorico.hidden = estado.avisoHistorico === undefined;
    vazio.hidden = estado.itens.length > 0 || Boolean(estado.erro);
    detalhe.textContent = estado.bloqueado
      ? "Pare o servidor para poder restaurar um backup."
      : resultado;
  } catch {
    mostrarErro("Não consegui ler a lista de backups.");
  }
}

abrir.addEventListener("click", () => {
  inicio.hidden = true;
  tela.hidden = false;
  confirmacao.hidden = true;
  resultado = "";
  void carregar();
  titulo.focus();
});
voltar.addEventListener("click", () => {
  tela.hidden = true;
  inicio.hidden = false;
  abrir.focus();
});
cancelar.addEventListener("click", () => {
  confirmacao.hidden = true;
  escolhido = undefined;
  botaoDoEscolhido?.focus();
});
confirmar.addEventListener("click", () => {
  const alvo = escolhido;
  if (!alvo || emCurso) return;
  emCurso = true;
  mostrarErro("");
  resultado = "";
  confirmacao.hidden = true;
  detalhe.textContent = "Restaurando o backup… não feche o app.";
  progresso.hidden = false;
  tela.setAttribute("aria-busy", "true");
  atualizarBotoes();
  window.sabre.backups
    .restaurar(alvo.nome)
    .then((r) => {
      if (r.ok) {
        resultado = `Pronto: o mundo voltou ao backup de ${dataDe(alvo.criadoEm)}.`;
      } else {
        mostrarErro(r.mensagem);
      }
    })
    .catch(() => mostrarErro("Não consegui restaurar agora. O mundo continua como estava."))
    .finally(() => {
      emCurso = false;
      escolhido = undefined;
      progresso.hidden = true;
      tela.setAttribute("aria-busy", "false");
      void carregar();
    });
});
window.sabre.inicio.aoProgresso(() => {
  if (!tela.hidden && !emCurso) void carregar();
});
