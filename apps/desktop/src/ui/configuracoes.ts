import type { CampoComErro, PcDaTela, PonteSabre } from "./ponte.js";

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
const historico = $<HTMLInputElement>("cfg-historico");
const historicoPasta = $<HTMLInputElement>("cfg-historico-pasta");
const historicoEscolher = $<HTMLButtonElement>("cfg-historico-escolher");
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

let campoComErro: CampoComErro | undefined;

/** O campo marcado vem do `campo` do app, nunca do texto da mensagem. */
function mostrarErro(texto: string, campo?: CampoComErro): void {
  erro.textContent = texto;
  erro.hidden = texto === "";
  campoComErro = texto === "" ? undefined : campo;
  const marca = (c: CampoComErro): string => String(campoComErro === c);
  visao.setAttribute("aria-invalid", marca("distancias"));
  simulacao.setAttribute("aria-invalid", marca("distancias"));
  intervalo.setAttribute("aria-invalid", marca("intervalo"));
  historicoPasta.setAttribute("aria-invalid", marca("historico"));
}

/** A pasta e o botão só funcionam com a opção ligada; ocupado desliga tudo. */
function atualizarHistorico(): void {
  const livre = historico.checked && !emCurso;
  historicoPasta.disabled = !livre;
  historicoEscolher.disabled = !livre;
}

function ocupar(ocupado: boolean): void {
  emCurso = ocupado;
  tela.setAttribute("aria-busy", String(ocupado));
  for (const el of [
    windows,
    visao,
    simulacao,
    intervalo,
    historico,
    historicoPasta,
    salvar,
    voltar,
  ])
    el.disabled = ocupado;
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
        // Sem aria-label: o nome acessível é o texto visível; o PC é o do item da lista.
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
      if (r.ok) {
        avisoGrupo.textContent = `${alvo.nome} saiu do grupo. Para voltar, precisa de um novo convite.`;
        // O botão clicado sumiu com o redesenho: leva o foco ao aviso.
        avisoGrupo.tabIndex = -1;
        avisoGrupo.focus();
      } else mostrarErroGrupo(r.mensagem);
    })
    .catch(() => mostrarErroGrupo("Não consegui tirar o PC agora. Atualize a lista para conferir."))
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
    historico.checked = c.historicoLongoLigado;
    historicoPasta.value = c.historicoLongoPasta;
    atualizarHistorico();
    aviso.textContent = "";
  } catch {
    aviso.textContent = "";
    mostrarErro("Não consegui ler as configurações.");
  }
}

historico.addEventListener("change", atualizarHistorico);
historicoEscolher.addEventListener("click", () => {
  historicoEscolher.disabled = true;
  window.sabre.configuracoes
    .escolherPasta()
    .then((pasta) => {
      if (pasta !== undefined) {
        historicoPasta.value = pasta;
        mostrarErro("");
      }
    })
    .catch(() => mostrarErro("Não consegui abrir o seletor de pasta agora.", "historico"))
    .finally(() => {
      atualizarHistorico();
      historicoEscolher.focus();
    });
});

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
      historicoLongoLigado: historico.checked,
      historicoLongoPasta: historicoPasta.value,
    })
    .then((r) => {
      if (r.ok) aviso.textContent = "Salvo.";
      else mostrarErro(r.mensagem, r.campo);
    })
    .catch(() => mostrarErro("Não consegui salvar agora. Nada foi alterado."))
    .finally(() => {
      ocupar(false);
      const alvo = {
        distancias: visao,
        intervalo,
        historico: historicoPasta.disabled ? historico : historicoPasta,
      };
      (campoComErro ? alvo[campoComErro] : erro.hidden ? salvar : visao).focus();
    });
});
