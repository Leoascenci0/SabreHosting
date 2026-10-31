// Assistente de primeira vez (app-1.3b): Convite → EULA → Pasta. A janela nunca guarda o convite além do campo de
// texto e nunca recebe chave nem token: quem entra no grupo é o main.
import type { EstadoBoasVindas, PonteSabre } from "./ponte.js";

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
const tela = $("tela-boas-vindas");
const passoTexto = $("bv-passo");
const convite = $("bv-convite");
const texto = $<HTMLInputElement>("bv-texto");
const conferir = $<HTMLButtonElement>("bv-conferir");
const caixa = $("bv-entrar-caixa");
const pergunta = $("bv-entrar-pergunta");
const entrar = $<HTMLButtonElement>("bv-entrar");
const eula = $("bv-eula");
const eulaTexto = $("bv-eula-texto");
const eulaLink = $("bv-eula-link");
const aceito = $<HTMLInputElement>("bv-eula-aceito");
const continuar = $<HTMLButtonElement>("bv-eula-continuar");
const pasta = $("bv-pasta");
const caminho = $<HTMLInputElement>("bv-pasta-caminho");
const escolher = $<HTMLButtonElement>("bv-pasta-escolher");
const concluir = $<HTMLButtonElement>("bv-concluir");
const status = $("bv-status");
const erro = $("bv-erro");

const ROTULOS = {
  convite: "Passo 1 de 3 · Convite",
  eula: "Passo 2 de 3 · Contrato da Mojang",
  pasta: "Passo 3 de 3 · Pasta",
} as const;

function mostrarStatus(t: string): void {
  status.textContent = t;
  status.hidden = t === "";
}
function mostrarErro(t: string): void {
  erro.textContent = t;
  erro.hidden = t === "";
}
function ocupar(sim: boolean, aviso = ""): void {
  tela.setAttribute("aria-busy", String(sim));
  for (const b of [conferir, entrar, continuar, escolher, concluir]) b.disabled = sim;
  texto.disabled = caminho.disabled = aceito.disabled = sim;
  mostrarStatus(sim ? aviso : "");
  if (!sim) continuar.disabled = !aceito.checked;
}

function irPara(passo: "convite" | "eula" | "pasta"): void {
  convite.hidden = passo !== "convite";
  eula.hidden = passo !== "eula";
  pasta.hidden = passo !== "pasta";
  passoTexto.textContent = ROTULOS[passo];
  mostrarErro("");
}

async function aberto(e: Extract<EstadoBoasVindas, { aberto: true }>): Promise<void> {
  $("cartao").hidden = true;
  tela.hidden = false;
  caminho.value = e.pastaPadrao;
  if (e.passo !== "convite") {
    const q = await window.sabre.boasVindas.eula();
    eulaTexto.textContent = q.texto;
    eulaLink.textContent = `Contrato: ${q.link}`;
  }
  irPara(e.passo);
}

async function iniciar(): Promise<void> {
  let e: EstadoBoasVindas;
  try {
    e = await window.sabre.boasVindas.estado();
  } catch {
    return; // sem assistente: o app abre normalmente
  }
  if (e.aberto) await aberto(e);
}

async function falhou(fazer: () => Promise<void>): Promise<void> {
  try {
    await fazer();
  } catch {
    mostrarErro("Não consegui fazer isso agora. Nada foi alterado. Tente de novo.");
  }
}

conferir.addEventListener("click", () => {
  void falhou(async () => {
    ocupar(true, "Conferindo o convite…");
    mostrarErro("");
    caixa.hidden = true;
    const r = await window.sabre.boasVindas.conferirConvite(texto.value);
    ocupar(false);
    if (!r.ok) return mostrarErro(r.mensagem);
    const vence = new Date(r.venceEm).toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });
    pergunta.textContent = `Entrar no grupo ${r.grupo}? (convite vale até ${vence})`;
    caixa.hidden = false;
    entrar.focus();
  });
});

entrar.addEventListener("click", () => {
  void falhou(async () => {
    ocupar(true, "Entrando no grupo… aceite o pedido de administrador do Windows.");
    mostrarErro("");
    const r = await window.sabre.boasVindas.entrar();
    ocupar(false);
    if (!r.ok) return mostrarErro(r.mensagem);
    texto.value = ""; // o convite já foi usado: não deixa o texto na janela
    caixa.hidden = true;
    const q = await window.sabre.boasVindas.eula();
    eulaTexto.textContent = q.texto;
    eulaLink.textContent = `Contrato: ${q.link}`;
    irPara("eula");
    mostrarStatus(`Você entrou no grupo ${r.grupo}.`);
  });
});

aceito.addEventListener("change", () => {
  continuar.disabled = !aceito.checked;
});

continuar.addEventListener("click", () => {
  void falhou(async () => {
    ocupar(true, "Guardando o aceite…");
    const r = await window.sabre.boasVindas.aceitarEula(aceito.checked);
    ocupar(false);
    if (!r.ok) return mostrarErro(r.mensagem);
    irPara("pasta");
  });
});

escolher.addEventListener("click", () => {
  void falhou(async () => {
    const p = await window.sabre.boasVindas.escolherPasta();
    if (p !== undefined) caminho.value = p;
  });
});

concluir.addEventListener("click", () => {
  void falhou(async () => {
    ocupar(true, "Preparando a pasta…");
    const r = await window.sabre.boasVindas.concluir(caminho.value.trim());
    if (!r.ok) {
      ocupar(false);
      return mostrarErro(r.mensagem);
    }
    location.reload(); // o app abre normal, já configurado
  });
});

void iniciar();
