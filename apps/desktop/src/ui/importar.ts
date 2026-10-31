// Tela Backups › "Importar mundo" (piloto-1.1c). A janela só pede para o main abrir o seletor e confirmar: o caminho do
// .zip nunca passa por aqui.
import type { EscolhaDoZip, PonteSabre } from "./ponte.js";

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
const tela = $("tela-backups");
const abrir = $<HTMLButtonElement>("importar-abrir");
const status = $("importar-status");
const erro = $("importar-erro");
const painel = $("importar-painel");
const titulo = $("importar-titulo");
const info = $("importar-info");
const avisos = $("importar-avisos");
const explica = $("importar-explica");
const confirmar = $<HTMLButtonElement>("importar-confirmar");
const cancelar = $<HTMLButtonElement>("importar-cancelar");
const voltar = $<HTMLButtonElement>("voltar-backups");
const abrirBackups = $<HTMLButtonElement>("ver-backups");

let ocupado = false;

function mostrarStatus(texto: string): void {
  status.textContent = texto;
  status.hidden = texto === "";
}

function mostrarErro(texto: string): void {
  erro.textContent = texto;
  erro.hidden = texto === "";
}

function ocupar(sim: boolean): void {
  ocupado = sim;
  abrir.disabled = confirmar.disabled = cancelar.disabled = voltar.disabled = sim;
  tela.setAttribute("aria-busy", String(sim));
}

function fecharPainel(): void {
  painel.hidden = true;
  delete painel.dataset["substitui"];
}

function avisosDe(e: Extract<EscolhaDoZip, { ok: true }>): string[] {
  const lista: string[] = [];
  if (e.versaoMinecraft === "desconhecida") {
    lista.push(
      "Não deu para ler a versão do Minecraft deste mundo. Dá para importar, mas confira se é a mesma do grupo.",
    );
  }
  if (e.plugins) {
    lista.push(
      "Este mundo veio de um servidor com plugins. Os plugins não vêm junto: o mundo abre, mas o que eles faziam (proteções, lojas, comandos) fica de fora.",
    );
  }
  if (e.mods) {
    lista.push(
      "Este mundo usou mods. Sem os mesmos mods no grupo, blocos e itens deles podem sumir.",
    );
  }
  return lista;
}

function desenhar(e: Extract<EscolhaDoZip, { ok: true }>): void {
  titulo.textContent = `Importar o mundo de "${e.nome}"?`;
  const versao =
    e.versaoMinecraft === "desconhecida"
      ? "versão do Minecraft desconhecida"
      : `Minecraft ${e.versaoMinecraft}`;
  info.textContent = `${versao} · ${e.arquivos.toLocaleString("pt-BR")} arquivos`;
  avisos.replaceChildren(
    ...avisosDe(e).map((texto) => {
      const li = document.createElement("li");
      li.textContent = texto;
      return li;
    }),
  );
  avisos.hidden = avisos.childElementCount === 0;
  if (e.versaoNoGrupo === null) {
    explica.textContent =
      "Ele vira o mundo do grupo e fica guardado na nuvem. O mundo que está neste PC não muda.";
    confirmar.textContent = "Importar";
    confirmar.className = "principal";
    confirmar.hidden = false;
  } else if (e.dono) {
    painel.dataset["substitui"] = "";
    explica.textContent =
      "Isto vira a versão mais nova do grupo; o mundo atual continua guardado nos backups.";
    confirmar.textContent = "Importar e virar a versão mais nova";
    confirmar.className = "perigo";
    confirmar.hidden = false;
  } else {
    explica.textContent =
      "O grupo já tem um mundo. Só o dono do grupo pode importar outro mundo no lugar dele.";
    confirmar.hidden = true;
  }
  painel.hidden = false;
  cancelar.focus();
}

abrir.addEventListener("click", () => {
  if (ocupado) return;
  fecharPainel();
  mostrarErro("");
  mostrarStatus("Conferindo o arquivo…");
  ocupar(true);
  window.sabre.importar
    .escolherZip()
    .then((e) => {
      mostrarStatus("");
      if (e.ok) desenhar(e);
      else if ("mensagem" in e) mostrarErro(e.mensagem);
    })
    .catch(() => {
      mostrarStatus("");
      mostrarErro("Não consegui abrir o arquivo agora. Nada foi alterado.");
    })
    .finally(() => {
      ocupar(false);
      if (!painel.hidden) cancelar.focus();
    });
});

cancelar.addEventListener("click", () => {
  if (ocupado) return;
  fecharPainel();
  abrir.focus();
});

confirmar.addEventListener("click", () => {
  if (ocupado) return;
  fecharPainel();
  mostrarErro("");
  mostrarStatus("Importando o mundo… pode levar alguns minutos. Deixe o app aberto.");
  ocupar(true);
  window.sabre.importar
    .executar(true)
    .then((r) => {
      if (r.ok) mostrarStatus(`Pronto: o mundo importado virou a versão ${r.versao} do grupo.`);
      else {
        mostrarStatus("");
        mostrarErro(r.mensagem);
      }
    })
    .catch(() => {
      mostrarStatus("");
      mostrarErro("Não consegui importar agora. Nada foi alterado.");
    })
    .finally(() => {
      ocupar(false);
      abrir.focus();
    });
});

// Abrir a tela Backups de novo começa limpo (o resultado da última importação não fica pendurado).
abrirBackups.addEventListener("click", () => {
  if (ocupado) return;
  fecharPainel();
  mostrarErro("");
  mostrarStatus("");
});
