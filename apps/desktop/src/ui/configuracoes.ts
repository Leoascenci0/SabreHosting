import type { CampoComErro, LeituraDaTela, PonteSabre } from "./ponte.js";
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
const descartar = $<HTMLButtonElement>("config-descartar");
const pendente = $("config-pendente");
const abas = [...form.querySelectorAll<HTMLButtonElement>('[role="tab"]')];
const botoesPadrao = [...form.querySelectorAll<HTMLButtonElement>("button.padrao")];
const voltar = $<HTMLButtonElement>("config-voltar");
const abrir = $<HTMLButtonElement>("ver-config");

const areaEndereco = $("cfg-endereco");
const campoEndereco = $<HTMLInputElement>("grupo-endereco");
const areaPasta = $("cfg-pasta-area");
const campoPasta = $<HTMLInputElement>("cfg-pasta");
const trocarPasta = $<HTMLButtonElement>("cfg-pasta-trocar");
const confPasta = $("cfg-pasta-confirmacao");
const perguntaPasta = $("cfg-pasta-pergunta");
const confirmarPasta = $<HTMLButtonElement>("cfg-pasta-confirmar");
const cancelarPasta = $<HTMLButtonElement>("cfg-pasta-cancelar");
const erroPasta = $("cfg-pasta-erro");
const avisoPasta = $("cfg-pasta-aviso");

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

let versaoAtual = "";
/** Cada seleção ganha um número: resposta atrasada de uma versão já trocada é descartada. */
let consulta = 0;

let emCurso = false;

let campoComErro: CampoComErro | undefined;

/** Em que aba mora cada campo que o main pode recusar (o erro leva a pessoa até ele). */
const ABA_DO_CAMPO: Record<CampoComErro, string> = {
  distancias: "servidor",
  intervalo: "backups",
  quantos: "backups",
  banda: "backups",
  historico: "backups",
  quantosHistorico: "backups",
};

/** Trocar de aba só mostra outra parte da mesma tela: o que foi digitado fica e nada é relido. */
function irParaAba(nome: string, focar = false): void {
  form.dataset["aba"] = nome;
  for (const a of abas) {
    const ativa = a.dataset["ir"] === nome;
    a.setAttribute("aria-selected", String(ativa));
    a.tabIndex = ativa ? 0 : -1;
    if (ativa && focar) a.focus();
  }
}
for (const [i, aba] of abas.entries()) {
  aba.addEventListener("click", () => irParaAba(aba.dataset["ir"] ?? "geral"));
  aba.addEventListener("keydown", (e) => {
    const destino = { ArrowRight: i + 1, ArrowLeft: i - 1, Home: 0, End: abas.length - 1 }[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    irParaAba(abas[(destino + abas.length) % abas.length]?.dataset["ir"] ?? "geral", true);
  });
}

/** Foto dos campos salvos: "Há alterações não salvas" é a diferença entre a tela e a foto. */
const valores = (): string =>
  JSON.stringify([
    windows.checked,
    visao.value,
    simulacao.value,
    intervalo.value,
    quantos.value,
    banda.value,
    historico.checked,
    historicoPasta.value,
    historicoQuantos.value,
  ]);
let foto: string | undefined;
let padroes: LeituraDaTela["padroes"] | undefined;

function atualizarBarra(): void {
  const mudou = foto !== undefined && valores() !== foto;
  pendente.hidden = !mudou;
  salvar.disabled = emCurso || !mudou;
  descartar.disabled = emCurso || !mudou;
}
form.addEventListener("input", atualizarBarra);
form.addEventListener("change", atualizarBarra);

for (const b of botoesPadrao) {
  b.addEventListener("click", () => {
    const campo = $<HTMLInputElement>(b.dataset["campo"] ?? "");
    const valor = padroes?.[b.dataset["padrao"] as keyof LeituraDaTela["padroes"]];
    if (valor === undefined) return;
    campo.value = String(valor);
    campo.dispatchEvent(new Event("input", { bubbles: true }));
    campo.focus();
  });
}

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
  for (const b of botoesPadrao) b.disabled = $<HTMLInputElement>(b.dataset["campo"] ?? "").disabled;
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
    voltar,
  ])
    el.disabled = ocupado;
  salvar.textContent = ocupado ? "Salvando…" : "Salvar";
  atualizarHistorico();
  atualizarBarra();
}

/** O endereço vem do estado do grupo; sem resposta do cartório, some em vez de mostrar campo vazio. */
async function carregarEndereco(): Promise<void> {
  try {
    const g = await window.sabre.grupo.estado();
    campoEndereco.value = g.endereco ?? "";
    areaEndereco.hidden = !g.endereco;
  } catch {
    areaEndereco.hidden = true;
  }
}

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

/** Lê só a configuração (o Descartar usa esta); grupo, versão e mods não são relidos. */
async function carregarConfig(): Promise<void> {
  aviso.textContent = "Carregando…";
  try {
    const c = await window.sabre.configuracoes.ler();
    padroes = c.padroes;
    windows.checked = c.abrirComWindows;
    visao.value = String(c.distanciaVisao);
    simulacao.value = String(c.distanciaSimulacao);
    intervalo.value = String(c.intervaloBackupMin);
    quantos.value = String(c.quantosGuardar);
    banda.value = String(c.limiteBandaMBs);
    historicoQuantos.value = String(c.quantosGuardarHistorico);
    historico.checked = c.historicoLongoLigado;
    historicoPasta.value = c.historicoLongoPasta;
    for (const b of botoesPadrao) {
      const nome = form.querySelector(`label[for="${b.dataset["campo"]}"]`)?.textContent ?? "";
      b.setAttribute("aria-label", `Padrão: ${nome}`);
      b.title = `Voltar para ${String(c.padroes[b.dataset["padrao"] as keyof typeof c.padroes])}`;
    }
    foto = valores();
    atualizarHistorico();
    aviso.textContent = "";
  } catch {
    aviso.textContent = "";
    mostrarErro("Não consegui ler as configurações.");
  }
  atualizarBarra();
}

async function carregar(): Promise<void> {
  void carregarEndereco();
  void carregarVersao();
  await carregarConfig();
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

// Pasta do SabreHosting: escolher → confirmar → o main revalida, grava e reinicia o app.
let pastaEscolhida = "";
function mostrarErroPasta(t: string): void {
  erroPasta.textContent = t;
  erroPasta.hidden = t === "";
}
function fecharConfirmacaoPasta(): void {
  confPasta.hidden = true;
  trocarPasta.disabled = false;
}
async function carregarPasta(): Promise<void> {
  fecharConfirmacaoPasta();
  mostrarErroPasta("");
  avisoPasta.hidden = true;
  try {
    const { pasta } = await window.sabre.pasta.estado();
    areaPasta.hidden = pasta === undefined;
    campoPasta.value = pasta ?? "";
  } catch {
    areaPasta.hidden = true;
  }
}
trocarPasta.addEventListener("click", () => {
  trocarPasta.disabled = true;
  mostrarErroPasta("");
  window.sabre.configuracoes
    .escolherPasta()
    .then((pasta) => {
      if (pasta === undefined) return fecharConfirmacaoPasta();
      pastaEscolhida = pasta;
      perguntaPasta.textContent = `Usar a pasta ${pasta}?`;
      confPasta.hidden = false;
      confirmarPasta.focus();
    })
    .catch(() => {
      fecharConfirmacaoPasta();
      mostrarErroPasta("Não consegui abrir o seletor de pasta agora.");
    });
});
cancelarPasta.addEventListener("click", () => {
  fecharConfirmacaoPasta();
  trocarPasta.focus();
});
confirmarPasta.addEventListener("click", () => {
  confirmarPasta.disabled = cancelarPasta.disabled = true;
  window.sabre.pasta
    .trocar(pastaEscolhida)
    .then((r) => {
      if (r.ok) {
        campoPasta.value = pastaEscolhida;
        confPasta.hidden = true;
        avisoPasta.textContent = `Pasta trocada. O mundo antigo continua em ${r.anterior}. O SabreHosting vai reiniciar.`;
        avisoPasta.hidden = false;
      } else {
        fecharConfirmacaoPasta();
        mostrarErroPasta(r.mensagem);
      }
    })
    .catch(() => {
      fecharConfirmacaoPasta();
      mostrarErroPasta("Não consegui trocar a pasta agora. Nada foi alterado.");
    })
    .finally(() => {
      confirmarPasta.disabled = cancelarPasta.disabled = false;
    });
});

abrir.addEventListener("click", () => {
  inicio.hidden = true;
  tela.hidden = false;
  mostrarErro("");
  irParaAba("geral");
  void carregar();
  void carregarPasta();
  windows.focus();
});
voltar.addEventListener("click", () => {
  tela.hidden = true;
  inicio.hidden = false;
  abrir.focus();
});
descartar.addEventListener("click", () => {
  if (emCurso) return;
  mostrarErro("");
  void carregarConfig();
});
form.addEventListener("submit", (evento) => {
  evento.preventDefault();
  if (emCurso || salvar.disabled) return;
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
      if (r.ok) {
        aviso.textContent = "Salvo.";
        foto = valores();
      } else {
        mostrarErro(r.mensagem, r.campo);
        if (r.campo) irParaAba(ABA_DO_CAMPO[r.campo]);
      }
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
