import { spawn } from "node:child_process";
import { join } from "node:path";
import type { ExecArquivo } from "./prism.js";
import { temMarcadorSabre } from "./instancia.js";

export interface OpcoesAbrirJogo {
  /** Caminho do prismlauncher.exe (de `detectarPrism`). */
  exe: string;
  /** Nome da pasta da instância do grupo dentro das instâncias do Prism. */
  idInstancia: string;
  /** `host:porta` do proxy. */
  endereco: string;
  /** Pasta de instâncias do Prism (de `detectarPrism`). O marcador é `<pastaInstancias>/<idInstancia>/SabreHosting`. */
  pastaInstancias: string;
  exec?: ExecArquivo;
  temMarcador?: (pasta: string) => Promise<boolean>;
}

/** Dispara o Prism sem shell e sem esperar o fim (ele fica aberto com o jogo); falha ao iniciar rejeita. */
const dispararReal: ExecArquivo = (arquivo, args) =>
  new Promise((ok, falha) => {
    const filho = spawn(arquivo, [...args], {
      shell: false,
      detached: true,
      stdio: "ignore",
      windowsHide: true,
    });
    filho.once("error", falha);
    filho.once("spawn", () => {
      filho.unref();
      ok("");
    });
  });

export type ResultadoAbrir = { ok: true } | { ok: false; mensagem: string };

const ENDERECO_OK = /^[A-Za-z0-9][A-Za-z0-9.-]*:(\d{1,5})$/;
/** Sem separador de caminho e sem começar por "-" (não vira opção da linha de comando). */
const ID_OK = /^[^\\/\u0000-\u001f-][^\\/\u0000-\u001f]*$/;

/**
 * Abre a instância do grupo no Prism já entrando no servidor (`--launch` e `--server`, opções documentadas do
 * Prism). Prism já aberto: a própria CLI entrega o pedido à janela em uso. Sem shell, argumentos em lista, entradas
 * validadas antes; só abre instância com o marcador do SabreHosting.
 */
export async function abrirJogo(op: OpcoesAbrirJogo): Promise<ResultadoAbrir> {
  const porta = Number(ENDERECO_OK.exec(op.endereco)?.[1]);
  if (!(porta >= 1 && porta <= 65535) || op.endereco.includes("..")) {
    return {
      ok: false,
      mensagem: "O endereço do servidor não é válido. Confira nas configurações do grupo.",
    };
  }
  if (!ID_OK.test(op.idInstancia) || op.idInstancia === "." || op.idInstancia === "..") {
    return { ok: false, mensagem: "O nome da instância do grupo não é válido." };
  }
  // Marcador derivado do MESMO id que vai para o Prism: id de outra instância não tem marcador e é recusado.
  const pastaMarcador = join(op.pastaInstancias, op.idInstancia, "SabreHosting");
  if (!(await (op.temMarcador ?? temMarcadorSabre)(pastaMarcador))) {
    return {
      ok: false,
      mensagem: "A instância do grupo ainda não foi criada pelo SabreHosting. Crie-a primeiro.",
    };
  }
  try {
    await (op.exec ?? dispararReal)(op.exe, ["--launch", op.idInstancia, "--server", op.endereco]);
    return { ok: true };
  } catch {
    return {
      ok: false,
      mensagem: "Não consegui abrir o Prism. Confira se ele está instalado e tente de novo.",
    };
  }
}
