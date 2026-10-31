import type { PonteSabre } from "./ponte.js";

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
const tela = $("tela-config");
const form = $<HTMLFormElement>("config-form");
const windows = $<HTMLInputElement>("cfg-windows");
const visao = $<HTMLInputElement>("cfg-visao");
const simulacao = $<HTMLInputElement>("cfg-simulacao");
const aviso = $("config-aviso");
const erro = $("config-erro");
const salvar = $<HTMLButtonElement>("config-salvar");
const voltar = $<HTMLButtonElement>("config-voltar");
const abrir = $<HTMLButtonElement>("ver-config");

let emCurso = false;

function mostrarErro(texto: string): void {
  erro.textContent = texto;
  erro.hidden = texto === "";
  for (const campo of [visao, simulacao]) {
    campo.setAttribute("aria-invalid", String(texto !== ""));
  }
}

function ocupar(ocupado: boolean): void {
  emCurso = ocupado;
  tela.setAttribute("aria-busy", String(ocupado));
  for (const el of [windows, visao, simulacao, salvar, voltar]) el.disabled = ocupado;
  salvar.textContent = ocupado ? "Salvando…" : "Salvar";
}

async function carregar(): Promise<void> {
  aviso.textContent = "Carregando…";
  try {
    const c = await window.sabre.configuracoes.ler();
    windows.checked = c.abrirComWindows;
    visao.value = String(c.distanciaVisao);
    simulacao.value = String(c.distanciaSimulacao);
    aviso.textContent = "";
  } catch {
    aviso.textContent = "";
    mostrarErro("Não consegui ler as configurações.");
  }
}

abrir.addEventListener("click", () => {
  inicio.hidden = true;
  tela.hidden = false;
  mostrarErro("");
  void carregar();
  windows.focus();
});
voltar.addEventListener("click", () => {
  tela.hidden = true;
  inicio.hidden = false;
  abrir.focus();
});
form.addEventListener("submit", (evento) => {
  evento.preventDefault();
  if (emCurso) return;
  mostrarErro("");
  aviso.textContent = "";
  ocupar(true);
  window.sabre.configuracoes
    .salvar({
      abrirComWindows: windows.checked,
      // Campo vazio vira NaN: o servidor do app recusa com a mensagem da faixa.
      distanciaVisao: visao.value === "" ? Number.NaN : Number(visao.value),
      distanciaSimulacao: simulacao.value === "" ? Number.NaN : Number(simulacao.value),
    })
    .then((r) => {
      if (r.ok) aviso.textContent = "Salvo.";
      else mostrarErro(r.mensagem);
    })
    .catch(() => mostrarErro("Não consegui salvar agora. Nada foi alterado."))
    .finally(() => {
      ocupar(false);
      (erro.hidden ? salvar : visao).focus();
    });
});
