import type { EstadoInicio, PonteSabre } from "./ponte.js";

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
const cartao = $("cartao");
const status = $("status");
const detalhe = $("detalhe");
const aviso = $("aviso");
const erro = $("erro");
const principal = $<HTMLButtonElement>("principal");
const parar = $<HTMLButtonElement>("parar");
const tentar = $<HTMLButtonElement>("tentar");
const confirmacao = $("confirmacao");
const confirmarParar = $<HTMLButtonElement>("confirmar-parar");
const cancelarParar = $<HTMLButtonElement>("cancelar-parar");

const MOTIVOS = {
  rede: "Sem conexão com o grupo. Confira a internet e tente de novo.",
  servidor: "O grupo não está respondendo agora. Tente de novo em instantes.",
  acesso: "Este PC ainda não entrou no grupo.",
} as const;

let atual: EstadoInicio = { tipo: "carregando" };
let ocupado: string | undefined;
let copiadoAte: ReturnType<typeof setTimeout> | undefined;
let ocupadoRemoto: string | undefined; // parada em curso iniciada por fora da tela (ex.: Sair na bandeja)
const SEM_ENDERECO = "Endereço do grupo ainda não configurado";
const COPIADO = "Endereço copiado. Cole no Minecraft para entrar.";
const AVISO_MS = 4000;

function mostrarAviso(texto: string): void {
  clearTimeout(copiadoAte);
  aviso.textContent = texto;
  if (texto !== "") copiadoAte = setTimeout(() => mostrarAviso(""), AVISO_MS);
}

function mostrarErro(mensagem: string): void {
  erro.textContent = mensagem;
  erro.hidden = mensagem === "";
}

function desenhar(): void {
  const e = atual;
  cartao.dataset["estado"] = e.tipo;
  cartao.setAttribute(
    "aria-busy",
    String(e.tipo === "carregando" || ocupado !== undefined || (e.tipo === "eu" && !!e.parando)),
  );
  ocupadoRemoto = undefined;
  let bloqueado = false;
  principal.hidden = parar.hidden = tentar.hidden = true;
  principal.dataset["acao"] = "";
  switch (e.tipo) {
    case "carregando":
      status.textContent = "Verificando o servidor…";
      detalhe.textContent = "";
      break;
    case "sem-cartorio":
      status.textContent = "Sem conexão com o grupo";
      detalhe.textContent = MOTIVOS[e.motivo];
      tentar.hidden = false;
      break;
    case "ninguem":
      if (e.atualizando !== undefined) {
        // Hospedar fica fechado até o mundo chegar à versão mais nova; Jogar não depende disto.
        status.textContent = `Atualizando seu mundo… ${e.atualizando}%`;
        detalhe.textContent = "Hospedar volta quando terminar.";
        principal.textContent = "Hospedar";
        principal.hidden = false;
        bloqueado = true; // botão visível e desabilitado: o amigo vê o motivo em vez de o botão sumir
        break;
      }
      status.textContent = "Ninguém está hospedando";
      detalhe.textContent = e.aviso ?? "Você pode ligar o servidor neste PC.";
      principal.textContent = "Hospedar";
      principal.dataset["acao"] = "hospedar";
      principal.hidden = false;
      break;
    case "orfao":
      status.textContent = "O servidor anterior não parou";
      detalhe.textContent = "Feche o Java no Gerenciador de Tarefas ou reinicie o PC.";
      tentar.hidden = false;
      break;
    case "outro":
      status.textContent = `Servidor no PC do ${e.nomePc}`;
      detalhe.textContent =
        (e.endereco ? `Endereço: ${e.endereco}` : SEM_ENDERECO) +
        (e.atualizando !== undefined ? ` · Atualizando seu mundo… ${e.atualizando}%` : "") +
        (e.aviso !== undefined ? ` · ${e.aviso}` : "");
      principal.textContent = "Jogar";
      principal.dataset["acao"] = "jogar";
      principal.hidden = e.endereco === "";
      break;
    case "eu":
      status.textContent = "Você está hospedando";
      detalhe.textContent = e.endereco ? `Endereço: ${e.endereco}` : SEM_ENDERECO;
      principal.textContent = "Jogar";
      principal.dataset["acao"] = "jogar";
      principal.hidden = e.endereco === "";
      parar.hidden = false;
      if (e.parando) ocupadoRemoto = "Parando o servidor…";
      break;
  }
  const emCurso = ocupado ?? ocupadoRemoto;
  if (emCurso !== undefined) {
    // Ação demorada: texto de progresso e nenhum botão clicável de novo.
    principal.hidden = false;
    principal.textContent = emCurso;
    parar.hidden = true;
  }
  for (const b of [principal, parar, tentar, confirmarParar, cancelarParar]) {
    b.disabled =
      emCurso !== undefined ||
      cartao.dataset["importando"] !== undefined ||
      (bloqueado && b === principal);
  }
}

// Importar mundo (importar.ts) liga/desliga a trava dos botões do servidor e avisa por aqui.
window.addEventListener("sabre:importacao", () => desenhar());

async function atualizar(): Promise<void> {
  try {
    atual = await window.sabre.inicio.estado();
  } catch {
    atual = { tipo: "sem-cartorio", motivo: "servidor" };
  }
  desenhar();
}

async function agir(texto: string, fazer: () => Promise<void>): Promise<void> {
  if (ocupado !== undefined) return;
  ocupado = texto;
  mostrarAviso("");
  mostrarErro("");
  desenhar();
  try {
    await fazer();
  } catch {
    mostrarErro("Não consegui fazer isso agora. Tente de novo em instantes.");
  }
  ocupado = undefined;
  await atualizar();
}

principal.addEventListener("click", () => {
  if (principal.dataset["acao"] === "hospedar") {
    void agir("Subindo o servidor…", async () => {
      const r = await window.sabre.inicio.hospedar();
      if (!r.ok) mostrarErro(r.mensagem);
    });
  } else if (principal.dataset["acao"] === "jogar") {
    void agir("Abrindo o jogo…", async () => {
      const r = await window.sabre.inicio.jogar();
      mostrarAviso(
        r.aberto ? "Abrindo o Minecraft no servidor…" : r.aviso ? `${r.aviso} ${COPIADO}` : COPIADO,
      );
    });
  }
});
parar.addEventListener("click", () => {
  confirmacao.hidden = false;
  cancelarParar.focus();
});
cancelarParar.addEventListener("click", () => {
  confirmacao.hidden = true;
  parar.focus();
});
confirmarParar.addEventListener("click", () => {
  confirmacao.hidden = true;
  void agir("Parando o servidor…", async () => {
    const r = await window.sabre.inicio.parar();
    if (!r.ok) mostrarErro(r.mensagem);
  });
});
tentar.addEventListener("click", () => {
  atual = { tipo: "carregando" };
  desenhar();
  void atualizar();
});
window.sabre.inicio.aoProgresso(() => void atualizar());

window.sabre
  .versao()
  .then((versao) => {
    $("versao").textContent = `Versão ${versao}`;
  })
  .catch(() => undefined);
desenhar();
void atualizar();
