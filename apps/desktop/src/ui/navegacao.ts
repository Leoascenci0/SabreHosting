import { AREAS, areaDeTela, proximoIndice, type Area } from "./navegacao-regras.js";

// Barra lateral fixa: não troca telas por conta própria; só aperta os botões que cada tela já tem
// (abrir/voltar), para o comportamento de cada área continuar o mesmo.
const barra = document.getElementById("barra");
const telas = [
  "cartao",
  "tela-backups",
  "tela-grupo",
  "tela-mods",
  "tela-config",
  "tela-importar",
  "tela-boas-vindas",
]
  .map((id) => document.getElementById(id))
  .filter((el): el is HTMLElement => el !== null);
const botoes = new Map<Area, HTMLButtonElement>(
  AREAS.map(
    (a) => [a, document.querySelector<HTMLButtonElement>(`[data-area="${a}"]`)] as const,
  ).filter((par): par is [Area, HTMLButtonElement] => par[1] !== null),
);
const VOLTAR: Record<string, string> = {
  "tela-backups": "voltar-backups",
  "tela-grupo": "grupo-voltar",
  "tela-mods": "mods-voltar", // volta ao Grupo; o Grupo se fecha com o próprio "Voltar"
  "tela-config": "config-voltar",
  "tela-importar": "importar-voltar", // volta ao Início; o botão fica travado durante a importação
};
const ABRIR: Partial<Record<Area, string>> = {
  backups: "ver-backups",
  configuracoes: "ver-config",
};

let atual: Area | undefined;

function telaVisivel(): HTMLElement | undefined {
  return telas.find((t) => !t.hidden);
}

function marcar(): void {
  const tela = telaVisivel();
  atual = tela ? areaDeTela(tela.id) : undefined;
  if (barra) barra.hidden = atual === undefined;
  for (const [area, b] of botoes) {
    const ativo = area === atual;
    if (ativo) b.setAttribute("aria-current", "page");
    else b.removeAttribute("aria-current");
    b.tabIndex = ativo || (atual === undefined && area === "inicio") ? 0 : -1;
  }
}

function ir(destino: Area): void {
  let tela = telaVisivel();
  if (!tela || areaDeTela(tela.id) === undefined) return;
  // Dentro de Mods, "Grupo" na barra volta à tela do Grupo.
  if (destino === atual && tela.id !== "tela-mods" && tela.id !== "tela-importar") return;
  if (tela.id === "tela-importar") {
    // Importar é subtela do Início: sair dele é o "Voltar" da própria tela. Importando, o botão está travado e a barra espera.
    document.getElementById(VOLTAR["tela-importar"] ?? "")?.click();
    tela = telaVisivel();
    if (destino === "inicio" || !tela || tela.id === "tela-importar") return marcar();
  }
  if (tela.id === "tela-mods") {
    document.getElementById(VOLTAR["tela-mods"] ?? "")?.click();
    tela = telaVisivel();
    if (destino === "grupo" || !tela) return marcar();
  }
  document.getElementById(VOLTAR[tela.id] ?? "")?.click();
  const abrir = ABRIR[destino];
  if (abrir) document.getElementById(abrir)?.click();
  // Grupo não tem botão no Início: a tela própria escuta o pedido da barra.
  if (destino === "grupo")
    document.dispatchEvent(new CustomEvent("sabre:abrir", { detail: "grupo" }));
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
