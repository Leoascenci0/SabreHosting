import type { CampoComErro, ModDaTela, PcDaTela, PonteSabre } from "./ponte.js";
import { rotuloConfirmarVersao } from "./rotulo-versao.js";

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
const quantos = $<HTMLInputElement>("cfg-quantos");
const banda = $<HTMLInputElement>("cfg-banda");
const historico = $<HTMLInputElement>("cfg-historico");
const historicoQuantos = $<HTMLInputElement>("cfg-historico-quantos");
const historicoPasta = $<HTMLInputElement>("cfg-historico-pasta");
const historicoEscolher = $<HTMLButtonElement>("cfg-historico-escolher");
const aviso = $("config-aviso");
const erro = $("config-erro");
const salvar = $<HTMLButtonElement>("config-salvar");
const voltar = $<HTMLButtonElement>("config-voltar");
const abrir = $<HTMLButtonElement>("ver-config");

const areaEndereco = $("cfg-endereco");
const campoEndereco = $<HTMLInputElement>("grupo-endereco");
const areaGrupo = $("cfg-grupo");
const listaGrupo = $("grupo-lista");
const confGrupo = $("grupo-confirmacao");
const perguntaGrupo = $("grupo-pergunta");
const confirmarGrupo = $<HTMLButtonElement>("grupo-confirmar");
const cancelarGrupo = $<HTMLButtonElement>("grupo-cancelar");
const avisoGrupo = $("grupo-aviso");
const erroGrupo = $("grupo-erro");

const areaVersao = $("cfg-versao-area");
const seletorVersao = $<HTMLSelectElement>("cfg-versao");
const dicaVersao = $("cfg-versao-dica");
const trocarVersao = $<HTMLButtonElement>("cfg-versao-trocar");
const confVersao = $("cfg-versao-confirmacao");
const perguntaVersao = $("cfg-versao-pergunta");
const confirmarVersao = $<HTMLButtonElement>("cfg-versao-confirmar");
const cancelarVersao = $<HTMLButtonElement>("cfg-versao-cancelar");
const erroVersao = $("cfg-versao-erro");
const avisoVersao = $("cfg-versao-aviso");

const listaMods = $("mods-lista");
const atualizandoMods = $("mods-atualizando");
const dicaMods = $("mods-dica");
const confMods = $("mods-confirmacao");
const perguntaMods = $("mods-pergunta");
const confirmarMods = $<HTMLButtonElement>("mods-confirmar");
const cancelarMods = $<HTMLButtonElement>("mods-cancelar");
const formMods = $("mods-adicionar");
const adicionarMods = $<HTMLButtonElement>("mods-adicionar-botao");
const avisoMods = $("mods-aviso");
const erroMods = $("mods-erro");
const camposMod = {
  nome: $<HTMLInputElement>("mods-nome"),
  versao: $<HTMLInputElement>("mods-versao"),
  arquivo: $<HTMLInputElement>("mods-arquivo"),
  url: $<HTMLInputElement>("mods-url"),
  sha512: $<HTMLInputElement>("mods-hash"),
  lado: $<HTMLSelectElement>("mods-lado"),
};
const LADO_MOD = { ambos: "jogo e servidor", cliente: "só o jogo", servidor: "só o servidor" };
let tirandoMod: ModDaTela | undefined;
let botaoDoMod: HTMLElement | undefined;
let consultaMods = 0;
let aguardaMods: ReturnType<typeof setTimeout> | undefined;

let versaoAtual = "";
/** Cada seleção ganha um número: resposta atrasada de uma versão já trocada é descartada. */
let consulta = 0;

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
  quantos.setAttribute("aria-invalid", marca("quantos"));
  banda.setAttribute("aria-invalid", marca("banda"));
  historicoPasta.setAttribute("aria-invalid", marca("historico"));
  historicoQuantos.setAttribute("aria-invalid", marca("quantosHistorico"));
}

/** A pasta e o botão só funcionam com a opção ligada; ocupado desliga tudo. */
function atualizarHistorico(): void {
  const livre = historico.checked && !emCurso;
  historicoPasta.disabled = !livre;
  historicoEscolher.disabled = !livre;
  historicoQuantos.disabled = !livre;
}

function ocupar(ocupado: boolean): void {
  emCurso = ocupado;
  tela.setAttribute("aria-busy", String(ocupado));
  for (const el of [
    windows,
    visao,
    simulacao,
    intervalo,
    quantos,
    banda,
    historico,
    historicoPasta,
    historicoQuantos,
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
    campoEndereco.value = g.endereco ?? "";
    areaEndereco.hidden = !g.endereco; // sem resposta do cartório, some em vez de mostrar campo vazio
    areaGrupo.hidden = !g.dono;
    if (g.dono) {
      desenharGrupo(g.pcs);
      if (g.erro) mostrarErroGrupo(g.erro);
    }
  } catch {
    areaEndereco.hidden = true;
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

function mostrarErroMods(texto: string): void {
  erroMods.textContent = texto;
  erroMods.hidden = texto === "";
}

function ocuparMods(ocupado: boolean): void {
  for (const b of [adicionarMods, confirmarMods, cancelarMods]) b.disabled = ocupado;
  for (const b of listaMods.querySelectorAll("button")) b.disabled = ocupado;
  adicionarMods.textContent = ocupado ? "Adicionando…" : "Adicionar à lista";
  confirmarMods.textContent = ocupado ? "Tirando…" : "Tirar da lista";
}

function desenharMods(mods: ModDaTela[], dono: boolean): void {
  if (mods.length === 0) {
    const vazio = document.createElement("li");
    vazio.textContent = "Nenhum mod na lista ainda.";
    listaMods.replaceChildren(vazio);
    return;
  }
  listaMods.replaceChildren(
    ...mods.map((m) => {
      const li = document.createElement("li");
      const nome = document.createElement("span");
      nome.textContent = `${m.nome} ${m.versao} (${LADO_MOD[m.lado]})`;
      li.append(nome);
      if (dono) {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "secundario";
        botao.textContent = "Tirar da lista";
        botao.addEventListener("click", () => {
          tirandoMod = m;
          botaoDoMod = botao;
          perguntaMods.textContent = `Tirar "${m.nome}" da lista de mods do grupo?`;
          confMods.hidden = false;
          cancelarMods.focus();
        });
        li.append(botao);
      }
      return li;
    }),
  );
}

async function carregarMods(): Promise<void> {
  const minha = ++consultaMods;
  clearTimeout(aguardaMods);
  try {
    const e = await window.sabre.mods.estado();
    if (minha !== consultaMods) return; // resposta de uma consulta já substituída
    formMods.hidden = !e.dono;
    dicaMods.hidden = false;
    atualizandoMods.hidden = !e.atualizando;
    desenharMods(e.mods, e.dono);
    if (e.erro) mostrarErroMods(e.erro);
    else if (e.aviso) avisoMods.textContent = e.aviso;
    // Atualizando no arranque: olha de novo até acabar, para o amigo ver o resultado.
    if (e.atualizando) aguardaMods = setTimeout(() => void carregarMods(), 1500);
  } catch {
    mostrarErroMods("Não consegui ler a lista de mods agora.");
  }
}

cancelarMods.addEventListener("click", () => {
  confMods.hidden = true;
  tirandoMod = undefined;
  botaoDoMod?.focus();
});
confirmarMods.addEventListener("click", () => {
  const alvo = tirandoMod;
  if (!alvo) return;
  ocuparMods(true);
  mostrarErroMods("");
  avisoMods.textContent = "";
  atualizandoMods.hidden = false;
  window.sabre.mods
    .tirar(alvo.arquivo)
    .then(async (r) => {
      confMods.hidden = true;
      tirandoMod = undefined;
      if (r.ok) avisoMods.textContent = r.aviso ?? `${alvo.nome} saiu da lista de mods.`;
      else mostrarErroMods(r.mensagem);
    })
    .catch(() => mostrarErroMods("Não consegui tirar o mod agora. Atualize a lista para conferir."))
    .finally(() => {
      ocuparMods(false);
      void carregarMods();
    });
});
adicionarMods.addEventListener("click", () => {
  ocuparMods(true);
  mostrarErroMods("");
  avisoMods.textContent = "";
  atualizandoMods.hidden = false;
  window.sabre.mods
    .adicionar({
      nome: camposMod.nome.value,
      versao: camposMod.versao.value,
      arquivo: camposMod.arquivo.value,
      url: camposMod.url.value,
      sha512: camposMod.sha512.value,
      lado: camposMod.lado.value as ModDaTela["lado"],
    })
    .then((r) => {
      if (r.ok) {
        for (const c of Object.values(camposMod)) if (c !== camposMod.lado) c.value = "";
        avisoMods.textContent = r.aviso ?? "Mod adicionado e atualizado neste PC.";
      } else mostrarErroMods(r.mensagem);
    })
    .catch(() => mostrarErroMods("Não consegui adicionar o mod agora. Nada foi alterado."))
    .finally(() => {
      ocuparMods(false);
      void carregarMods();
    });
});

function mostrarErroVersao(texto: string): void {
  erroVersao.textContent = texto;
  erroVersao.hidden = texto === "";
}

function ocuparVersao(ocupado: boolean): void {
  seletorVersao.disabled = ocupado;
  trocarVersao.disabled = ocupado || seletorVersao.value === versaoAtual;
  confirmarVersao.disabled = ocupado;
  cancelarVersao.disabled = ocupado;
  confirmarVersao.textContent = rotuloConfirmarVersao(ocupado);
}

/** As opções só são buscadas quando o dono seleciona a versão (cada busca vai à internet). */
async function mostrarOpcoes(): Promise<void> {
  const minha = ++consulta;
  const v = seletorVersao.value;
  confVersao.hidden = true;
  trocarVersao.disabled = v === versaoAtual;
  dicaVersao.textContent = "Consultando o que esta versão roda…";
  try {
    const o = await window.sabre.versoes.opcoes(v);
    if (minha !== consulta) return;
    dicaVersao.textContent = o.ok ? o.texto : o.mensagem;
  } catch {
    if (minha === consulta) dicaVersao.textContent = "Não consegui consultar esta versão agora.";
  }
}

async function carregarVersao(): Promise<void> {
  confVersao.hidden = true;
  mostrarErroVersao("");
  try {
    const e = await window.sabre.versoes.estado();
    areaVersao.hidden = !e.dono;
    if (!e.dono) return;
    if (e.erro) return mostrarErroVersao(e.erro);
    versaoAtual = e.atual;
    // A atual pode não estar na lista (manifesto fora do ar ou versão antiga): entra para a tela não mentir.
    const ids = e.versoes.includes(e.atual) ? e.versoes : [e.atual, ...e.versoes];
    seletorVersao.replaceChildren(
      ...ids.map(
        (id) => new Option(id === e.atual ? `${id} (a de hoje)` : id, id, false, id === e.atual),
      ),
    );
    await mostrarOpcoes();
  } catch {
    areaVersao.hidden = true;
  }
}

seletorVersao.addEventListener("change", () => void mostrarOpcoes());
trocarVersao.addEventListener("click", () => {
  perguntaVersao.textContent = `Trocar a versão do Minecraft de ${versaoAtual} para ${seletorVersao.value}?`;
  confVersao.hidden = false;
  cancelarVersao.focus();
});
cancelarVersao.addEventListener("click", () => {
  confVersao.hidden = true;
  trocarVersao.focus();
});
confirmarVersao.addEventListener("click", () => {
  const alvo = seletorVersao.value;
  ocuparVersao(true);
  mostrarErroVersao("");
  avisoVersao.textContent = "";
  window.sabre.versoes
    .gravar(alvo)
    .then(async (r) => {
      confVersao.hidden = true;
      if (r.ok) {
        await carregarVersao();
        avisoVersao.textContent = `Pronto: o grupo agora usa a versão ${alvo}.`;
      } else mostrarErroVersao(r.mensagem);
    })
    .catch(() => mostrarErroVersao("Não consegui trocar a versão agora. Nada foi alterado."))
    .finally(() => {
      ocuparVersao(false);
      trocarVersao.focus();
    });
});

async function carregar(): Promise<void> {
  void carregarGrupo();
  void carregarVersao();
  void carregarMods();
  aviso.textContent = "Carregando…";
  try {
    const c = await window.sabre.configuracoes.ler();
    windows.checked = c.abrirComWindows;
    visao.value = String(c.distanciaVisao);
    simulacao.value = String(c.distanciaSimulacao);
    intervalo.value = String(c.intervaloBackupMin);
    quantos.value = String(c.quantosGuardar);
    banda.value = String(c.limiteBandaMBs);
    historicoQuantos.value = String(c.quantosGuardarHistorico);
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
      quantosGuardar: quantos.value === "" ? Number.NaN : Number(quantos.value),
      limiteBandaMBs: banda.value === "" ? Number.NaN : Number(banda.value),
      quantosGuardarHistorico:
        historicoQuantos.value === "" ? Number.NaN : Number(historicoQuantos.value),
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
        quantos,
        banda,
        quantosHistorico: historicoQuantos.disabled ? historico : historicoQuantos,
        historico: historicoPasta.disabled ? historico : historicoPasta,
      };
      (campoComErro ? alvo[campoComErro] : erro.hidden ? salvar : visao).focus();
    });
});
