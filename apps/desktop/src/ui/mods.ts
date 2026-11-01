import type { ModDaTela, PonteSabre } from "./ponte.js";

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
const grupo = $("tela-grupo");
const tela = $("tela-mods");
const abrir = $<HTMLButtonElement>("ver-mods");
const voltar = $<HTMLButtonElement>("mods-voltar");
const lista = $("mods-lista");
const atualizando = $("mods-atualizando");
const confirmacao = $("mods-confirmacao");
const pergunta = $("mods-pergunta");
const confirmar = $<HTMLButtonElement>("mods-confirmar");
const cancelar = $<HTMLButtonElement>("mods-cancelar");
const areaDono = $("mods-dono");
const novo = $<HTMLButtonElement>("mods-novo");
const form = $<HTMLFormElement>("mods-adicionar");
const rotuloPasso = $("mods-passo");
const anterior = $<HTMLButtonElement>("mods-anterior");
const proximo = $<HTMLButtonElement>("mods-proximo");
const enviar = $<HTMLButtonElement>("mods-adicionar-botao");
const descartar = $<HTMLButtonElement>("mods-descartar");
const avancado = $<HTMLDetailsElement>("mods-avancado");
const aviso = $("mods-aviso");
const erro = $("mods-erro");
const campos = {
  nome: $<HTMLInputElement>("mods-nome"),
  versao: $<HTMLInputElement>("mods-versao"),
  arquivo: $<HTMLInputElement>("mods-arquivo"),
  url: $<HTMLInputElement>("mods-url"),
  sha512: $<HTMLInputElement>("mods-hash"),
  lado: $<HTMLSelectElement>("mods-lado"),
};
const LADO_MOD = { ambos: "jogo e servidor", cliente: "só o jogo", servidor: "só o servidor" };
/** Passos curtos: o que precisa estar preenchido para seguir (a conferência de verdade fica no app). */
const PASSOS = [
  { campos: [campos.nome, campos.versao], falta: "Digite o nome e a versão do mod." },
  { campos: [campos.arquivo], falta: "Digite o nome do arquivo do mod." },
  { campos: [campos.url], falta: "Cole o link de download do mod." },
];

let tirando: ModDaTela | undefined;
let botaoDoMod: HTMLElement | undefined;
let consulta = 0;
let aguarda: ReturnType<typeof setTimeout> | undefined;
let passo = 0;

function mostrarErro(texto: string): void {
  erro.textContent = texto;
  erro.hidden = texto === "";
}

function mostrarPasso(n: number): void {
  passo = n;
  for (const p of form.querySelectorAll<HTMLElement>(".passo"))
    p.hidden = p.dataset["passo"] !== String(n + 1);
  rotuloPasso.textContent = `Passo ${n + 1} de ${PASSOS.length}`;
  anterior.hidden = n === 0;
  proximo.hidden = n === PASSOS.length - 1;
  enviar.hidden = n !== PASSOS.length - 1;
}

function fecharFormulario(): void {
  form.hidden = true;
  novo.hidden = false;
  for (const c of Object.values(campos)) if (c !== campos.lado) c.value = "";
  campos.lado.value = "ambos";
  avancado.open = false;
  mostrarPasso(0);
}

function ocupar(ocupado: boolean): void {
  tela.setAttribute("aria-busy", String(ocupado));
  for (const b of [novo, anterior, proximo, enviar, descartar, confirmar, cancelar, voltar])
    b.disabled = ocupado;
  for (const b of lista.querySelectorAll("button")) b.disabled = ocupado;
  enviar.textContent = ocupado ? "Adicionando…" : "Adicionar à lista";
  confirmar.textContent = ocupado ? "Tirando…" : "Tirar da lista";
}

function desenhar(mods: ModDaTela[], dono: boolean): void {
  if (mods.length === 0) {
    const vazio = document.createElement("li");
    vazio.textContent = dono
      ? "Nenhum mod na lista ainda. Use “Adicionar mod” para começar."
      : "Nenhum mod na lista ainda.";
    lista.replaceChildren(vazio);
    return;
  }
  lista.replaceChildren(
    ...mods.map((m, i) => {
      const li = document.createElement("li");
      const texto = document.createElement("span");
      texto.id = `mods-item-${i}`;
      texto.textContent = m.nome;
      const meta = document.createElement("span");
      meta.className = "meta";
      meta.textContent = `versão ${m.versao} · vale para ${LADO_MOD[m.lado]}`;
      texto.append(meta);
      li.append(texto);
      if (dono) {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "secundario";
        botao.textContent = "Tirar da lista";
        botao.setAttribute("aria-describedby", texto.id);
        botao.addEventListener("click", () => {
          tirando = m;
          botaoDoMod = botao;
          pergunta.textContent = `Tirar "${m.nome}" da lista de mods do grupo?`;
          confirmacao.hidden = false;
          cancelar.focus();
        });
        li.append(botao);
      }
      return li;
    }),
  );
}

// `preservarMensagens`: true quando a leitura vem de uma ação (adicionar/tirar) ou da espera de "atualizando";
// nesses casos o aviso e o erro da ação que acabou de rodar não podem sumir.
async function carregar(preservarMensagens = false): Promise<void> {
  const minha = ++consulta;
  clearTimeout(aguarda);
  try {
    const e = await window.sabre.mods.estado();
    if (minha !== consulta) return; // resposta de uma consulta já substituída
    areaDono.hidden = !e.dono;
    atualizando.hidden = !e.atualizando;
    desenhar(e.mods, e.dono);
    // Leitura de tela: o que sobrou de antes (aviso que o problema já resolveu, erro de leitura) sai.
    if (!preservarMensagens) {
      mostrarErro("");
      aviso.textContent = "";
    }
    // Erro da ação que acabou de rodar não sai para dar lugar à falha de leitura que veio logo depois.
    if (e.erro && !(preservarMensagens && !erro.hidden)) mostrarErro(e.erro);
    if (e.aviso) aviso.textContent = e.aviso;
    // Atualizando no arranque: olha de novo até acabar, para o amigo ver o resultado.
    if (e.atualizando) aguarda = setTimeout(() => void carregar(true), 1500);
  } catch {
    // Só o erro de ação visível é preservado: releitura depois de ação bem-sucedida, ou da espera de "atualizando",
    // mostra a falha de leitura em vez de ficar em silêncio com a lista velha.
    if (!preservarMensagens || erro.hidden) mostrarErro("Não consegui ler a lista de mods agora.");
  }
}

cancelar.addEventListener("click", () => {
  confirmacao.hidden = true;
  tirando = undefined;
  botaoDoMod?.focus();
});
confirmar.addEventListener("click", () => {
  const alvo = tirando;
  if (!alvo) return;
  ocupar(true);
  mostrarErro("");
  aviso.textContent = "";
  atualizando.hidden = false;
  window.sabre.mods
    .tirar(alvo.arquivo)
    .then((r) => {
      confirmacao.hidden = true;
      tirando = undefined;
      if (r.ok) aviso.textContent = r.aviso ?? `${alvo.nome} saiu da lista de mods.`;
      else mostrarErro(r.mensagem);
    })
    .catch(() => mostrarErro("Não consegui tirar o mod agora. Atualize a lista para conferir."))
    .finally(() => {
      ocupar(false);
      void carregar(true);
    });
});

novo.addEventListener("click", () => {
  novo.hidden = true;
  form.hidden = false;
  mostrarErro("");
  mostrarPasso(0);
  campos.nome.focus();
});
descartar.addEventListener("click", () => {
  fecharFormulario();
  mostrarErro("");
  novo.focus();
});
anterior.addEventListener("click", () => {
  mostrarErro("");
  mostrarPasso(Math.max(0, passo - 1));
});
proximo.addEventListener("click", () => {
  const vazio = PASSOS[passo]?.campos.find((c) => c.value.trim() === "");
  if (vazio) {
    mostrarErro(PASSOS[passo]?.falta ?? "");
    vazio.focus();
    return;
  }
  mostrarErro("");
  mostrarPasso(passo + 1);
  form.querySelector<HTMLElement>(`[data-passo="${passo + 1}"] input`)?.focus();
});
form.addEventListener("submit", (evento) => {
  evento.preventDefault();
  if (enviar.disabled || passo !== PASSOS.length - 1) return;
  if (campos.url.value.trim() === "") {
    mostrarErro(PASSOS[2]?.falta ?? "");
    campos.url.focus();
    return;
  }
  ocupar(true);
  mostrarErro("");
  aviso.textContent = "";
  atualizando.hidden = false;
  window.sabre.mods
    .adicionar({
      nome: campos.nome.value,
      versao: campos.versao.value,
      arquivo: campos.arquivo.value,
      url: campos.url.value,
      sha512: campos.sha512.value,
      lado: campos.lado.value as ModDaTela["lado"],
    })
    .then((r) => {
      if (r.ok) {
        fecharFormulario();
        aviso.textContent = r.aviso ?? "Mod adicionado e atualizado neste PC.";
      } else {
        mostrarErro(r.mensagem);
        // O código de conferência mora em "Avançado": se faltou, abre para a pessoa ver onde preencher.
        if (campos.sha512.value.trim() === "") avancado.open = true;
      }
    })
    .catch(() => mostrarErro("Não consegui adicionar o mod agora. Nada foi alterado."))
    .finally(() => {
      ocupar(false);
      void carregar(true);
    });
});

abrir.addEventListener("click", () => {
  grupo.hidden = true;
  tela.hidden = false;
});
voltar.addEventListener("click", () => {
  tela.hidden = true;
  grupo.hidden = false;
  abrir.focus();
});
// Ao aparecer lê a lista; ao sumir solta o que ficou pela metade.
new MutationObserver(() => {
  if (tela.hidden) {
    consulta++;
    clearTimeout(aguarda);
    confirmacao.hidden = true;
    tirando = undefined;
    fecharFormulario();
    mostrarErro("");
    aviso.textContent = "";
  } else {
    void carregar();
    mostrarPasso(0);
  }
}).observe(tela, { attributes: true, attributeFilter: ["hidden"] });
mostrarPasso(0);
