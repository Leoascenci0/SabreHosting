import type { PcDaTela, PonteSabre } from "./ponte.js";
import { nomeNaRede } from "./nome-na-rede.js";

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
const tela = $("tela-grupo");
const soDono = $("grupo-so-dono");
const area = $("grupo-area");
const lista = $("grupo-lista");
const confirmacao = $("grupo-confirmacao");
const pergunta = $("grupo-pergunta");
const confirmar = $<HTMLButtonElement>("grupo-confirmar");
const cancelar = $<HTMLButtonElement>("grupo-cancelar");
const aviso = $("grupo-aviso");
const erro = $("grupo-erro");
const voltar = $<HTMLButtonElement>("grupo-voltar");
const conviteNome = $<HTMLInputElement>("convite-nome");
const conviteNomeFicou = $("convite-nome-ficou");
const conviteValidade = $<HTMLSelectElement>("convite-validade");
const conviteCriar = $<HTMLButtonElement>("convite-criar");
const conviteResultado = $("convite-resultado");
const conviteTexto = $<HTMLInputElement>("convite-texto");
const convitePrazo = $("convite-prazo");
const conviteCopiar = $<HTMLButtonElement>("convite-copiar");
const conviteCopiado = $("convite-copiado");
const conviteErro = $("convite-erro");
let anuncioCopia: ReturnType<typeof setTimeout> | undefined; // reescreve "Convite copiado." 100 ms depois de copiar

let tirando: PcDaTela | undefined;
let botaoDoTirado: HTMLElement | undefined;
/** Cada leitura ganha um número: resposta atrasada de uma tela já fechada é descartada. */
let consulta = 0;

function mostrarErro(texto: string): void {
  erro.textContent = texto;
  erro.hidden = texto === "";
}

function ocupar(ocupado: boolean): void {
  for (const b of area.querySelectorAll("button")) b.disabled = ocupado;
  voltar.disabled = ocupado;
  confirmar.textContent = ocupado ? "Tirando…" : "Tirar do grupo";
}

function desenhar(pcs: PcDaTela[]): void {
  lista.replaceChildren(
    ...pcs.map((pc, i) => {
      const li = document.createElement("li");
      const nome = document.createElement("span");
      nome.id = `grupo-pc-${i}`;
      nome.textContent = pc.dono ? `${pc.nome} (dono do grupo)` : pc.nome;
      li.append(nome);
      // O PC do dono não pode ser tirado (o cartório recusa): nem oferece o botão.
      if (!pc.dono) {
        const botao = document.createElement("button");
        botao.type = "button";
        botao.className = "secundario";
        botao.textContent = "Tirar do grupo";
        // O nome acessível é o texto visível; o PC do item vem como descrição.
        botao.setAttribute("aria-describedby", nome.id);
        botao.addEventListener("click", () => {
          tirando = pc;
          botaoDoTirado = botao;
          pergunta.textContent = `Tirar "${pc.nome}" do grupo?`;
          confirmacao.hidden = false;
          cancelar.focus();
        });
        li.append(botao);
      }
      return li;
    }),
  );
}

/** O texto do convite é credencial: só vive nesta tela e some ao sair, recarregar ou criar outro. */
function limparConvite(): void {
  conviteTexto.value = "";
  convitePrazo.textContent = "";
  conviteResultado.hidden = true;
  conviteCopiar.textContent = "Copiar";
  clearTimeout(anuncioCopia);
  conviteCopiado.textContent = "";
}

function mostrarErroConvite(texto: string): void {
  conviteErro.textContent = texto;
  conviteErro.hidden = texto === "";
}

conviteNome.addEventListener("input", () => {
  const ficou = nomeNaRede(conviteNome.value);
  conviteNomeFicou.textContent = ficou ? `Vai ficar como: ${ficou}` : "";
});

const FORMATO_PRAZO = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" });

conviteCriar.addEventListener("click", () => {
  if (conviteCriar.disabled) return;
  limparConvite();
  mostrarErroConvite("");
  if (!nomeNaRede(conviteNome.value)) {
    mostrarErroConvite("Digite o nome do PC convidado (letras ou números).");
    conviteNome.focus();
    return;
  }
  conviteCriar.disabled = true;
  conviteCriar.textContent = "Criando…";
  window.sabre.grupo
    .criarConvite(conviteNome.value, Number(conviteValidade.value))
    .then((r) => {
      if (!r.ok) return mostrarErroConvite(r.mensagem);
      conviteTexto.value = r.convite;
      convitePrazo.textContent = `Para o PC "${r.nomeNaRede}". Vale até ${FORMATO_PRAZO.format(r.venceEm)}.`;
      conviteResultado.hidden = false;
      conviteNome.value = "";
      conviteNomeFicou.textContent = "";
      conviteTexto.focus();
      conviteTexto.select();
    })
    .catch(() =>
      mostrarErroConvite("Não consegui criar o convite agora. Nenhum convite foi criado."),
    )
    .finally(() => {
      conviteCriar.disabled = false;
      conviteCriar.textContent = "Criar convite";
    });
});

conviteCopiar.addEventListener("click", () => {
  navigator.clipboard
    .writeText(conviteTexto.value)
    .then(() => {
      conviteCopiar.textContent = "Copiado";
      // Região role="status": o leitor de tela anuncia. Limpa e reescreve a cada cópia, para uma segunda cópia
      // seguida (mesmo texto) também mudar a região.
      clearTimeout(anuncioCopia); // cópia seguida: só o anúncio mais novo fica
      conviteCopiado.textContent = "";
      anuncioCopia = setTimeout(() => {
        conviteCopiado.textContent = "Convite copiado.";
      }, 100);
    })
    .catch(() => {
      conviteTexto.select(); // sem permissão para copiar: o texto fica selecionado para Ctrl+C
      mostrarErroConvite("Não consegui copiar sozinho. O texto está selecionado: use Ctrl+C.");
    });
});

async function carregar(): Promise<void> {
  const minha = ++consulta;
  confirmacao.hidden = true;
  tirando = undefined;
  mostrarErro("");
  tela.setAttribute("aria-busy", "true");
  try {
    const g = await window.sabre.grupo.estado();
    if (minha !== consulta) return; // a tela já fechou ou foi aberta de novo
    area.hidden = !g.dono;
    soDono.hidden = g.dono;
    if (g.dono) {
      desenhar(g.pcs);
      if (g.erro) mostrarErro(g.erro);
    }
  } catch {
    if (minha !== consulta) return;
    area.hidden = true; // sem resposta do app: não mostra uma área que talvez não valha
    soDono.hidden = true;
    mostrarErro("Não consegui ler o grupo agora.");
  }
  if (minha === consulta) tela.setAttribute("aria-busy", "false");
}

cancelar.addEventListener("click", () => {
  confirmacao.hidden = true;
  tirando = undefined;
  botaoDoTirado?.focus();
});
confirmar.addEventListener("click", () => {
  const alvo = tirando;
  if (!alvo) return;
  ocupar(true);
  mostrarErro("");
  aviso.textContent = "";
  window.sabre.grupo
    .tirar(alvo.id)
    .then(async (r) => {
      confirmacao.hidden = true;
      tirando = undefined;
      await carregar();
      if (r.ok) {
        aviso.textContent = `${alvo.nome} saiu do grupo. Para voltar, precisa de um novo convite.`;
        // O botão clicado sumiu com o redesenho: leva o foco ao aviso.
        aviso.tabIndex = -1;
        aviso.focus();
      } else mostrarErro(r.mensagem);
    })
    .catch(() => mostrarErro("Não consegui tirar o PC agora. Atualize a lista para conferir."))
    .finally(() => ocupar(false));
});

// A barra lateral pede a tela pelo evento; ao aparecer lê o estado, ao sumir apaga o convite da memória.
document.addEventListener("sabre:abrir", (e) => {
  if ((e as CustomEvent<string>).detail !== "grupo") return;
  inicio.hidden = true;
  tela.hidden = false;
});
new MutationObserver(() => {
  if (tela.hidden) {
    limparConvite();
    mostrarErroConvite("");
    aviso.textContent = "";
    consulta++; // descarta leitura em andamento
  } else void carregar();
}).observe(tela, { attributes: true, attributeFilter: ["hidden"] });

voltar.addEventListener("click", () => {
  tela.hidden = true;
  inicio.hidden = false;
});
