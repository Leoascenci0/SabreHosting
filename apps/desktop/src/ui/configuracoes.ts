import type { PcDaTela, PonteSabre } from "./ponte.js";

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
const intervalo = $<HTMLInputElement>("cfg-intervalo");
const aviso = $("config-aviso");
const erro = $("config-erro");
const salvar = $<HTMLButtonElement>("config-salvar");
const voltar = $<HTMLButtonElement>("config-voltar");
const abrir = $<HTMLButtonElement>("ver-config");

const areaGrupo = $("cfg-grupo");
const listaGrupo = $("grupo-lista");
const confGrupo = $("grupo-confirmacao");
const perguntaGrupo = $("grupo-pergunta");
const confirmarGrupo = $<HTMLButtonElement>("grupo-confirmar");
const cancelarGrupo = $<HTMLButtonElement>("grupo-cancelar");
const avisoGrupo = $("grupo-aviso");
const erroGrupo = $("grupo-erro");

let emCurso = false;
let tirando: PcDaTela | undefined;
let botaoDoTirado: HTMLElement | undefined;

function mostrarErro(texto: string): void {
  erro.textContent = texto;
  erro.hidden = texto === "";
  for (const campo of [visao, simulacao, intervalo]) {
    campo.setAttribute("aria-invalid", String(texto !== ""));
  }
}

function ocupar(ocupado: boolean): void {
  emCurso = ocupado;
  tela.setAttribute("aria-busy", String(ocupado));
  for (const el of [windows, visao, simulacao, intervalo, salvar, voltar]) el.disabled = ocupado;
  salvar.textContent = ocupado ? "Salvando…" : "Salvar";
}

function mostrarErroGrupo(texto: string): void {
  erroGrupo.textContent = texto;
  erroGrupo.hidden = texto === "";
}

function ocuparGrupo(ocupado: boolean): void {
  for (const b of areaGrupo.querySelectorAll("button")) b.disabled = ocupado;
  confirmarGrupo.textContent = ocupado ? "Tirando…" : "Tirar do grupo";
}

function desenharGrupo(pcs: PcDaTela[]): void {
  listaGrupo.replaceChildren(
    ...pcs.map((pc) => {
      const li = document.createElement("li");
      const nome = document.createElement("span");
      nome.textContent = pc.dono ? `${pc.nome} (dono do grupo)` : pc.nome;
      li.append(nome);
      // O PC do dono não pode ser tirado (o cartório recusa): nem oferece o botão.
      if (!pc.dono) {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "secundario";
        botao.textContent = "Tirar PC do grupo";
        botao.setAttribute("aria-label", `Tirar ${pc.nome} do grupo`);
        botao.addEventListener("click", () => {
          tirando = pc;
          botaoDoTirado = botao;
          perguntaGrupo.textContent = `Tirar "${pc.nome}" do grupo?`;
          confGrupo.hidden = false;
          cancelarGrupo.focus();
        });
        li.append(botao);
      }
      return li;
    }),
  );
}

async function carregarGrupo(): Promise<void> {
  confGrupo.hidden = true;
  tirando = undefined;
  mostrarErroGrupo("");
  try {
    const g = await window.sabre.grupo.estado();
    areaGrupo.hidden = !g.dono;
    if (g.dono) {
      desenharGrupo(g.pcs);
      if (g.erro) mostrarErroGrupo(g.erro);
    }
  } catch {
    areaGrupo.hidden = true; // sem resposta do app: não mostra uma área que talvez não valha
  }
}

cancelarGrupo.addEventListener("click", () => {
  confGrupo.hidden = true;
  tirando = undefined;
  botaoDoTirado?.focus();
});
confirmarGrupo.addEventListener("click", () => {
  const alvo = tirando;
  if (!alvo) return;
  ocuparGrupo(true);
  mostrarErroGrupo("");
  avisoGrupo.textContent = "";
  window.sabre.grupo
    .tirar(alvo.id)
    .then(async (r) => {
      confGrupo.hidden = true;
      tirando = undefined;
      await carregarGrupo();
      if (r.ok)
        avisoGrupo.textContent = `${alvo.nome} saiu do grupo. Para voltar, precisa de um novo convite.`;
      else mostrarErroGrupo(r.mensagem);
    })
    .catch(() => mostrarErroGrupo("Não consegui tirar o PC agora. Nada foi alterado."))
    .finally(() => ocuparGrupo(false));
});

async function carregar(): Promise<void> {
  void carregarGrupo();
  aviso.textContent = "Carregando…";
  try {
    const c = await window.sabre.configuracoes.ler();
    windows.checked = c.abrirComWindows;
    visao.value = String(c.distanciaVisao);
    simulacao.value = String(c.distanciaSimulacao);
    intervalo.value = String(c.intervaloBackupMin);
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
      intervaloBackupMin: intervalo.value === "" ? Number.NaN : Number(intervalo.value),
    })
    .then((r) => {
      if (r.ok) aviso.textContent = "Salvo.";
      else mostrarErro(r.mensagem);
    })
    .catch(() => mostrarErro("Não consegui salvar agora. Nada foi alterado."))
    .finally(() => {
      ocupar(false);
      (erro.hidden ? salvar : erro.textContent?.includes("backup") ? intervalo : visao).focus();
    });
});
