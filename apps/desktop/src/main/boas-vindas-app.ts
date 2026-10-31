import { dialog, ipcMain, safeStorage } from "electron";
import type { BrowserWindow, IpcMainInvokeEvent } from "electron";
import { join } from "node:path";
import { criarCliente } from "@sabrehosting/nucleo/cartorio/cliente";
import { gerarChavesDoPc, IP_DO_HUB } from "@sabrehosting/nucleo/rede/wireguard";
import { criarBoasVindas, type BoasVindas, type DepsBoasVindas } from "./boas-vindas.js";
import { criarCofreSeguro } from "./cofre.js";
import { criarEntradaNoGrupo } from "./entrada-no-grupo.js";

export interface OpcoesBoasVindasDoApp {
  dados: string;
  janela(): BrowserWindow | null;
  /** Barra mensagem que não veio da nossa página (mesma regra das outras telas). */
  permitir(evento: IpcMainInvokeEvent): void;
}

/** Peças de verdade: cofre do Windows, WireGuard com administrador e seletor de pasta. */
function depsReais(op: OpcoesBoasVindasDoApp): DepsBoasVindas {
  return {
    dados: op.dados,
    agora: Date.now,
    gerarChaves: gerarChavesDoPc,
    cofreDisponivel: () => safeStorage.isEncryptionAvailable(),
    cofre: criarCofreSeguro(safeStorage, join(op.dados, "cofre-token.bin")),
    entrar: criarEntradaNoGrupo({ pastaRede: join(op.dados, "rede") }),
    lerGrupo: (token, porta) =>
      criarCliente({
        url: `http://${IP_DO_HUB}:${porta}`,
        cofre: { guardar: async () => {}, ler: async () => token },
      }).grupo(),
    pastaPadrao: () => join(process.env["LOCALAPPDATA"] ?? op.dados, "SabreHosting"),
  };
}

/** Cria o assistente e liga as mensagens da janela. No E2E, as peças são falsas (`fake-e2e.ts`). */
export async function registrarBoasVindas(op: OpcoesBoasVindasDoApp): Promise<BoasVindas> {
  let deps: DepsBoasVindas;
  let escolher: () => Promise<string | undefined>;
  if (process.env["SABRE_E2E"] === "1") {
    const { depsBoasVindasE2E } = await import("./fake-e2e.js");
    const e2e = depsBoasVindasE2E(op.dados);
    deps = e2e.deps;
    escolher = e2e.escolherPasta;
  } else {
    deps = depsReais(op);
    escolher = async () => {
      const opcoes = {
        title: "Escolha a pasta do SabreHosting",
        properties: ["openDirectory", "createDirectory"] as ("openDirectory" | "createDirectory")[],
      };
      const janela = op.janela();
      const r = janela
        ? await dialog.showOpenDialog(janela, opcoes)
        : await dialog.showOpenDialog(opcoes);
      return r.canceled ? undefined : r.filePaths[0];
    };
  }
  const bv = criarBoasVindas(deps);
  const ligar = <A extends unknown[]>(canal: string, fazer: (...a: A) => unknown): void =>
    void ipcMain.handle(canal, (evento, ...a) => (op.permitir(evento), fazer(...(a as A))));
  ligar("sabre:bv:estado", () => bv.estado());
  ligar("sabre:bv:conferir", (texto: unknown) => bv.conferirConvite(texto));
  ligar("sabre:bv:entrar", () => bv.entrar());
  ligar("sabre:bv:eula", () => bv.eula());
  ligar("sabre:bv:aceitar-eula", (aceito: unknown) => bv.aceitarEula(aceito));
  ligar("sabre:bv:escolher-pasta", () => escolher());
  ligar("sabre:bv:concluir", (pasta: unknown) => bv.concluir(pasta));
  return bv;
}
