// Início › "Importar mundo" (piloto-1.1c), agora em passo a passo (appui-1.6): 1 escolher o arquivo, 2 conferir o que foi
// achado, 3 confirmar. A janela só pede para o main abrir o seletor e confirmar: o caminho do .zip nunca passa por aqui,
// e a validação do .zip e a regra "só `true` vale" ficam no main.
import { marcarPasso } from "./passos.js";
import type { EscolhaDoZip, PonteSabre } from "./ponte.js";

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
const tela = $("tela-importar");
const abrir = $<HTMLButtonElement>("importar-abrir");
const rotuloPasso = $("importar-passo");
const bolinhas = $("importar-bolinhas");
const titulo = $("importar-titulo");
const passos = [1, 2, 3].map((n) => $(`importar-passo-${n}`));
const escolher = $<HTMLButtonElement>("importar-escolher");
const info = $("importar-info");
const avisos = $("importar-avisos");
const bloqueio = $("importar-bloqueio");
const continuar = $<HTMLButtonElement>("importar-continuar");
const trocar = $<HTMLButtonElement>("importar-trocar");
const explica = $("importar-explica");
const confirmar = $<HTMLButtonElement>("importar-confirmar");
const anterior = $<HTMLButtonElement>("importar-anterior");
const status = $("importar-status");
const erro = $("importar-erro");
const voltar = $<HTMLButtonElement>("importar-voltar"); // a barra lateral aciona este botão para sair
const verBackups = $<HTMLButtonElement>("ver-backups");
const verConfig = $<HTMLButtonElement>("ver-config");

const TOTAL = 3;
const TITULOS = [
  "Qual arquivo tem o mundo?",
  "É este o mundo?",
  "Importar este mundo para o grupo?",
] as const;

let ocupado = false;
let escolha: Extract<EscolhaDoZip, { ok: true }> | undefined;

function mostrarStatus(texto: string): void {
  status.textContent = texto;
  status.hidden = texto === "";
}

function mostrarErro(texto: string): void {
  erro.textContent = texto;
  erro.hidden = texto === "";
}

function ocupar(sim: boolean): void {
  ocupado = sim;
  tela.setAttribute("aria-busy", String(sim));
  for (const b of [escolher, continuar, trocar, confirmar, anterior, voltar]) b.disabled = sim;
  // Durante a importação o resto do Início também espera (não dá para hospedar nem sair no meio).
  verBackups.disabled = verConfig.disabled = sim;
  if (sim) inicio.dataset["importando"] = "";
  else delete inicio.dataset["importando"];
  window.dispatchEvent(new Event("sabre:importacao"));
}

/** Mostra o passo n (1 a 3): só ele aparece, o título nomeia a pergunta e o foco vai para o título. */
function irPara(n: 1 | 2 | 3): void {
  passos.forEach((p, i) => (p.hidden = i + 1 !== n));
  marcarPasso(rotuloPasso, bolinhas, n, TOTAL);
  titulo.textContent =
    n === 3 && escolha ? `Importar o mundo de "${escolha.nome}"?` : (TITULOS[n - 1] ?? "");
  mostrarErro("");
  titulo.focus();
}

function avisosDe(e: Extract<EscolhaDoZip, { ok: true }>): string[] {
  const lista: string[] = [];
  if (e.versaoMinecraft === "desconhecida") {
    lista.push(
      "Não deu para ler a versão do Minecraft deste mundo. Dá para importar, mas confira se é a mesma do grupo.",
    );
  }
  if (e.plugins) {
    lista.push(
      "Este mundo veio de um servidor com plugins. Os plugins não vêm junto: o mundo abre, mas o que eles faziam (proteções, lojas, comandos) fica de fora.",
    );
  }
  if (e.mods) {
    lista.push(
      "Este mundo usou mods. Sem os mesmos mods no grupo, blocos e itens deles podem sumir.",
    );
  }
  return lista;
}

/** Passo 2: o que foi achado. Grupo com mundo e PC comum para aqui, com o motivo e sem botão de continuar. */
function desenhar(e: Extract<EscolhaDoZip, { ok: true }>): void {
  escolha = e;
  const versao =
    e.versaoMinecraft === "desconhecida"
      ? "versão do Minecraft desconhecida"
      : `Minecraft ${e.versaoMinecraft}`;
  info.textContent = `Mundo de "${e.nome}": ${versao} · ${e.arquivos.toLocaleString("pt-BR")} arquivos`;
  avisos.replaceChildren(
    ...avisosDe(e).map((texto) => {
      const li = document.createElement("li");
      li.textContent = texto;
      return li;
    }),
  );
  avisos.hidden = avisos.childElementCount === 0;
  const bloqueado = e.versaoNoGrupo !== null && !e.dono;
  bloqueio.hidden = !bloqueado;
  bloqueio.textContent = bloqueado
    ? "O grupo já tem um mundo. Só o dono do grupo pode importar outro mundo no lugar dele. Escolha outro arquivo ou volte ao Início."
    : "";
  continuar.hidden = bloqueado;
  if (e.versaoNoGrupo === null) {
    explica.textContent =
      "Ele vira o mundo do grupo e fica guardado na nuvem. O mundo que está neste PC não muda.";
    confirmar.textContent = "Importar";
    confirmar.className = "principal";
  } else {
    // Dono sobre um mundo que já existe: confirmação forte (botão de perigo).
    explica.textContent =
      "Isto vira a versão mais nova do grupo; o mundo atual continua guardado nos backups.";
    confirmar.textContent = "Importar e virar a versão mais nova";
    confirmar.className = "perigo";
  }
  irPara(2);
}

function abrirTela(): void {
  escolha = undefined;
  mostrarStatus("");
  inicio.hidden = true;
  tela.hidden = false;
  rotuloPasso.hidden = bolinhas.hidden = false;
  irPara(1);
}

function fecharTela(): void {
  escolha = undefined;
  tela.hidden = true;
  inicio.hidden = false;
  abrir.focus();
}

abrir.addEventListener("click", () => {
  if (!ocupado) abrirTela();
});

voltar.addEventListener("click", () => {
  if (!ocupado) fecharTela();
});

/** Passo 1 → 2: o main abre o seletor e confere o .zip; só avança se ele aprovar. */
escolher.addEventListener("click", () => {
  if (ocupado) return;
  mostrarErro("");
  mostrarStatus("Conferindo o arquivo…");
  ocupar(true);
  window.sabre.importar
    .escolherZip()
    .then((e) => {
      mostrarStatus("");
      if (e.ok) desenhar(e);
      else if ("mensagem" in e) mostrarErro(e.mensagem); // quem cancelou o seletor volta ao passo 1 sem mensagem
    })
    .catch(() => {
      mostrarStatus("");
      mostrarErro("Não consegui abrir o arquivo agora. Nada foi alterado. Tente escolher de novo.");
    })
    .finally(() => {
      ocupar(false);
      if (passos[0]?.hidden === false) escolher.focus(); // seletor cancelado ou erro: fica no passo 1
    });
});

trocar.addEventListener("click", () => {
  if (ocupado) return;
  escolha = undefined;
  irPara(1);
});

continuar.addEventListener("click", () => {
  if (!ocupado) irPara(3);
});

anterior.addEventListener("click", () => {
  if (!ocupado) irPara(2);
});

confirmar.addEventListener("click", () => {
  if (ocupado) return;
  mostrarErro("");
  mostrarStatus("Importando o mundo… pode levar alguns minutos. Deixe o app aberto.");
  ocupar(true);
  let deuCerto = false;
  window.sabre.importar
    .executar(true)
    .then((r) => {
      deuCerto = r.ok;
      if (r.ok) {
        // Pronto: some o passo a passo e fica só o resultado e o botão de voltar.
        passos.forEach((p) => (p.hidden = true));
        rotuloPasso.hidden = bolinhas.hidden = true;
        titulo.textContent = "Mundo importado";
        mostrarStatus(`Pronto: o mundo importado virou a versão ${r.versao} do grupo.`);
        escolha = undefined;
      } else {
        mostrarStatus("");
        mostrarErro(r.mensagem);
      }
    })
    .catch(() => {
      mostrarStatus("");
      mostrarErro("Não consegui importar agora. Nada foi alterado. Tente de novo.");
    })
    .finally(() => {
      ocupar(false);
      (deuCerto ? voltar : confirmar).focus(); // com erro o passo 3 continua, pronto para tentar de novo
    });
});
