import { AREAS, areaDeTela, proximoIndice, type Area } from "./navegacao-regras.js";

// Barra lateral fixa: não troca telas por conta própria; só aperta os botões que cada tela já tem
// (abrir/voltar), para o comportamento de cada área continuar o mesmo.
const barra = document.getElementById("barra");
const telas = ["cartao", "tela-backups", "tela-config", "tela-boas-vindas"]
  .map((id) => document.getElementById(id))
  .filter((el): el is HTMLElement => el !== null);
const botoes = new Map<Area, HTMLButtonElement>(
  AREAS.map(
    (a) => [a, document.querySelector<HTMLButtonElement>(`[data-area="${a}"]`)] as const,
  ).filter((par): par is [Area, HTMLButtonElement] => par[1] !== null),
);
const VOLTAR: Record<string, string> = {
  "tela-backups": "voltar-backups",
  "tela-config": "config-voltar",
};
const ABRIR: Partial<Record<Area, string>> = {
  backups: "ver-backups",
  grupo: "ver-config",
  configuracoes: "ver-config",
};

let atual: Area | undefined;

function telaVisivel(): HTMLElement | undefined {
  return telas.find((t) => !t.hidden);
}

function marcar(): void {
  const tela = telaVisivel();
  atual = tela ? areaDeTela(tela.id, atual) : undefined;
  if (barra) barra.hidden = atual === undefined;
  for (const [area, b] of botoes) {
    const ativo = area === atual;
    if (ativo) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
    b.tabIndex = ativo || (atual === undefined && area === "inicio") ? 0 : -1;
  }
}

function ir(destino: Area): void {
  const tela = telaVisivel();
  if (!tela || areaDeTela(tela.id, atual) === undefined) return;
  const igual = destino === atual;
  if (igual && destino !== "grupo") return;
  const sair = VOLTAR[tela.id];
  // Já na tela certa (Grupo <-> Configurações): não volta ao Início, só troca o item marcado.
  const mesmaTela =
    tela.id === "tela-config" && (destino === "grupo" || destino === "configuracoes");
  if (!mesmaTela && sair) document.getElementById(sair)?.click();
  const abrir = ABRIR[destino];
  if (!mesmaTela && abrir) document.getElementById(abrir)?.click();
  atual = destino;
  if (destino === "grupo") {
    const grupo = document.getElementById("cfg-grupo");
    if (grupo && !grupo.hidden) grupo.scrollIntoView({ block: "start" });
    else document.getElementById("tela-config")?.scrollIntoView({ block: "start" });
  } else if (mesmaTela) {
    document.getElementById("tela-config")?.scrollIntoView({ block: "start" });
  }
  marcar();
}

for (const [area, b] of botoes) {
  b.addEventListener("click", () => ir(area));
  b.addEventListener("keydown", (e) => {
    const lista = [...botoes.keys()];
    const prox = proximoIndice(lista.indexOf(area), lista.length, e.key);
    if (prox === undefined) return;
    e.preventDefault();
    const alvo = lista[prox];
    const botao = alvo ? botoes.get(alvo) : undefined;
    if (botao) {
      for (const outro of botoes.values()) outro.tabIndex = outro === botao ? 0 : -1;
      botao.focus();
    }
  });
}

const observador = new MutationObserver(marcar);
for (const t of telas) observador.observe(t, { attributes: true, attributeFilter: ["hidden"] });
marcar();
