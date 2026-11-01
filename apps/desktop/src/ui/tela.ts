import { haQuanto } from "./ha-quanto.js";
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
const copiarEndereco = $<HTMLButtonElement>("copiar-endereco");
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

type Tom = "ligado" | "desligado" | "troca" | "atencao";

function texto(id: string, valor: string | undefined): void {
  const fato = $(`fato-${id}`);
  fato.hidden = valor === undefined;
  if (valor !== undefined) $(`${id === "versao" ? "versao-mundo" : id}-valor`).textContent = valor;
}

/** As linhas do painel só aparecem quando há dado (nunca "0" ou "ninguém" inventado). */
function desenharFatos(e: EstadoInicio): void {
  const painel = e.tipo === "ninguem" || e.tipo === "outro" || e.tipo === "eu" ? e : undefined;
  const endereco = e.tipo === "outro" || e.tipo === "eu" ? e.endereco : "";
  $("fato-endereco").hidden = endereco === "";
  $("endereco-valor").textContent = endereco;
  texto(
    "jogadores",
    e.tipo === "eu" && !e.parando
      ? e.jogadores === undefined
        ? undefined
        : e.jogadores.length === 0
          ? "Ninguém por enquanto"
          : e.jogadores.join(", ")
      : e.tipo === "outro"
        ? "Não dá para ver quem está jogando daqui"
        : undefined,
  );
  texto("backup", painel?.ultimoBackup ? haQuanto(painel.ultimoBackup) : undefined);
  texto("versao", painel?.versaoMundo !== undefined ? String(painel.versaoMundo) : undefined);
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
  let tom: Tom = "desligado";
  principal.hidden = parar.hidden = tentar.hidden = true;
  principal.dataset["acao"] = "";
  switch (e.tipo) {
    case "carregando":
      status.textContent = "Verificando o servidor…";
      detalhe.textContent = "";
      break;
    case "sem-cartorio":
      tom = "atencao";
      status.textContent = "Sem conexão com o grupo";
      detalhe.textContent = MOTIVOS[e.motivo];
      tentar.hidden = false;
      break;
    case "ninguem": {
      const trabalho =
        e.atualizando !== undefined
          ? `Atualizando seu mundo… ${e.atualizando}%`
          : e.trabalho === "restaurando"
            ? "Restaurando um backup…"
            : e.trabalho === "trocando-versao"
              ? "Trocando a versão do Minecraft…"
              : undefined;
      if (trabalho !== undefined) {
        // Hospedar fica fechado até terminar; Jogar não depende disto.
        tom = "troca";
        status.textContent = trabalho;
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
    }
    case "orfao":
      tom = "atencao";
      status.textContent = "O servidor anterior não parou";
      detalhe.textContent = "Feche o Java no Gerenciador de Tarefas ou reinicie o PC.";
      tentar.hidden = false;
      break;
    case "outro":
      tom = "ligado";
      status.textContent = `Servidor no PC do ${e.nomePc}`;
      detalhe.textContent =
        e.endereco === ""
          ? SEM_ENDERECO
          : [
              e.atualizando !== undefined ? `Atualizando seu mundo… ${e.atualizando}%` : "",
              e.aviso ?? "",
            ]
              .filter((t) => t !== "")
              .join(" · ") || "Copie o endereço ou toque em Jogar.";
      principal.textContent = "Jogar";
      principal.dataset["acao"] = "jogar";
      principal.hidden = e.endereco === "";
      break;
    case "eu":
      tom = e.parando ? "troca" : "ligado";
      status.textContent = "Você está hospedando";
      detalhe.textContent = e.endereco ? "Seus amigos já podem entrar." : SEM_ENDERECO;
      principal.textContent = "Jogar";
      principal.dataset["acao"] = "jogar";
      principal.hidden = e.endereco === "";
      parar.hidden = false;
      if (e.parando) ocupadoRemoto = "Parando o servidor…";
      break;
  }
  $("estado").dataset["tom"] = tom;
  desenharFatos(e);
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

copiarEndereco.addEventListener("click", () => {
  const valor = $("endereco-valor").textContent ?? "";
  navigator.clipboard
    .writeText(valor)
    .then(() => mostrarAviso("Endereço copiado."))
    .catch(() => mostrarAviso("Não consegui copiar. Selecione o endereço e copie com Ctrl+C."));
});

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
