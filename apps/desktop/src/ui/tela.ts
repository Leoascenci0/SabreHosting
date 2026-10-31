import type { PonteSabre } from "./ponte.js";

declare global {
  interface Window {
    sabre: PonteSabre;
  }
}

const campo = document.getElementById("versao");
if (campo) {
  window.sabre
    .versao()
    .then((versao) => {
      campo.textContent = `Versão ${versao}`;
    })
    .catch(() => undefined);
}
