// Assistente de primeira vez (app-1.3b): Convite → EULA → Pasta. A janela nunca guarda o convite além do campo de
// texto e nunca recebe chave nem token: quem entra no grupo é o main.
import { executarOcupado } from "./executar-ocupado.js";
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
const abrirEula = $<HTMLButtonElement>("bv-eula-abrir");
const aceito = $<HTMLInputElement>("bv-eula-aceito");
const continuar = $<HTMLButtonElement>("bv-eula-continuar");
const pasta = $("bv-pasta");
const caminho = $<HTMLInputElement>("bv-pasta-caminho");
const escolher = $<HTMLButtonElement>("bv-pasta-escolher");
const concluir = $<HTMLButtonElement>("bv-concluir");
const status = $("bv-status");
const erro = $("bv-erro");
const explorar = $<HTMLButtonElement>("bv-explorar");
const faixa = $("faixa-demo");
const sairDemo = $<HTMLButtonElement>("faixa-demo-sair");

const ENTRAR = "Entrar no grupo";
const TENTAR_DE_NOVO = "Tentar de novo";
/** O botão de entrar vira "Tentar de novo" só quando o convite foi gasto e a conexão não terminou (appmel-1.14). */
function rotularEntrar(repetir: boolean): void {
  entrar.textContent = repetir ? TENTAR_DE_NOVO : ENTRAR;
}

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
let avisoOcupado = "";
function ocupar(sim: boolean): void {
  tela.setAttribute("aria-busy", String(sim));
  for (const b of [conferir, entrar, continuar, escolher, concluir, abrirEula, explorar]) {
    b.disabled = sim;
  }
  texto.disabled = caminho.disabled = aceito.disabled = sim;
  if (sim) mostrarStatus(avisoOcupado);
  else {
    // Só apaga o aviso de "carregando"; mensagens de resultado ("Você entrou…") ficam.
    if (status.textContent === avisoOcupado) mostrarStatus("");
    continuar.disabled = !aceito.checked;
  }
}

/** Toda ação passa por aqui: ocupa, e desocupa sempre (inclusive se a ponte lançar). */
function rodar(aviso: string, fazer: () => Promise<void>): void {
  avisoOcupado = aviso;
  mostrarErro("");
  void executarOcupado(ocupar, fazer, () =>
    mostrarErro("Não consegui fazer isso agora. Nada foi alterado. Tente de novo."),
  );
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
    mostrarContrato(await window.sabre.boasVindas.eula());
  }
  irPara(e.passo); // zera o erro: a mensagem de cofre vem depois
  if (e.cofreCorrompido) {
    mostrarErro("Seu acesso guardado neste PC não abre mais; peça um convite novo.");
  }
}

async function iniciar(): Promise<void> {
  let e: EstadoBoasVindas;
  try {
    e = await window.sabre.boasVindas.estado();
  } catch {
    return; // sem assistente: o app abre normalmente
  }
  faixa.hidden = !(!e.aberto && e.demonstracao); // a faixa fica fixa em todo o app, em demonstração
  if (e.aberto) await aberto(e);
}

function mostrarContrato(q: { texto: string; link: string }): void {
  eulaTexto.textContent = q.texto;
}

conferir.addEventListener("click", () => {
  rodar("Conferindo o convite…", async () => {
    caixa.hidden = true;
    rotularEntrar(false);
    const r = await window.sabre.boasVindas.conferirConvite(texto.value);
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
  const repetindo = entrar.textContent === TENTAR_DE_NOVO;
  const aviso = repetindo
    ? "Tentando de novo com o mesmo convite… aceite o pedido de administrador do Windows."
    : "Entrando no grupo… aceite o pedido de administrador do Windows.";
  rodar(aviso, async () => {
    const r = await window.sabre.boasVindas.entrar();
    if (!r.ok) {
      if (r.tentarDeNovo) rotularEntrar(true);
      else if (repetindo) {
        // Não dá mais para repetir (passou o prazo ou o grupo recusou): a mensagem pede convite novo.
        rotularEntrar(false);
        caixa.hidden = true;
        texto.value = "";
      }
      mostrarErro(r.mensagem);
      if (r.tentarDeNovo) entrar.focus();
      return;
    }
    rotularEntrar(false);
    texto.value = ""; // o convite já foi usado: não deixa o texto na janela
    caixa.hidden = true;
    mostrarContrato(await window.sabre.boasVindas.eula());
    irPara("eula");
    mostrarStatus(`Você entrou no grupo ${r.grupo}.`);
  });
});

abrirEula.addEventListener("click", () => {
  // O endereço do contrato é fixo no main: a janela só pede para abrir.
  rodar("", async () => void (await window.sabre.boasVindas.abrirEula()));
});

aceito.addEventListener("change", () => {
  continuar.disabled = !aceito.checked;
});

continuar.addEventListener("click", () => {
  rodar("Guardando o aceite…", async () => {
    const r = await window.sabre.boasVindas.aceitarEula(aceito.checked);
    if (!r.ok) return mostrarErro(r.mensagem);
    irPara("pasta");
  });
});

escolher.addEventListener("click", () => {
  rodar("", async () => {
    const p = await window.sabre.boasVindas.escolherPasta();
    if (p !== undefined) caminho.value = p;
  });
});

concluir.addEventListener("click", () => {
  rodar("Preparando a pasta…", async () => {
    const r = await window.sabre.boasVindas.concluir(caminho.value.trim());
    if (!r.ok) return mostrarErro(r.mensagem);
    location.reload(); // o app abre normal, já configurado
  });
});

explorar.addEventListener("click", () => {
  rodar("Abrindo a demonstração…", async () => {
    if (!(await window.sabre.boasVindas.explorar()))
      return mostrarErro("Não consegui abrir a demonstração.");
    location.reload(); // o app abre com os dados de mentira e a faixa
  });
});

sairDemo.addEventListener("click", () => {
  sairDemo.disabled = true;
  void window.sabre.boasVindas
    .sairDaDemonstracao()
    .catch(() => undefined)
    .then(() => location.reload()); // volta ao convite
});

void iniciar();
