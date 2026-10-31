import {
  app,
  BrowserWindow,
  clipboard,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  Tray,
} from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { fileURLToPath, pathToFileURL } from "node:url";
import { criarCliente } from "@sabrehosting/nucleo/cartorio/cliente";
import { hospedar } from "@sabrehosting/nucleo/cartorio/hospedar";
import { criarInicio, erroSemGrupo, type DepsInicio, type Inicio } from "./inicio.js";
import { lerPreferencias, salvarPreferencias } from "./preferencias.js";
import { ehBooleano, navegacaoPermitida } from "./seguranca.js";

const aqui = (relativo: string): string => fileURLToPath(new URL(relativo, import.meta.url));
const PAGINA = pathToFileURL(aqui("../ui/index.html")).href;
const ICONE = aqui("../../recursos/icone/icone-256.png");
const INICIO_OCULTO = "--oculto";

let janela: BrowserWindow | null = null;
let bandeja: Tray | null = null;
let saindo = false;

function mostrarJanela(): void {
  if (!janela) return;
  if (janela.isMinimized()) janela.restore();
  janela.show();
  janela.focus();
}

function criarJanela(oculta: boolean): BrowserWindow {
  const nova = new BrowserWindow({
    width: 880,
    height: 600,
    minWidth: 480,
    minHeight: 360,
    show: false,
    title: "SabreHosting",
    icon: ICONE,
    autoHideMenuBar: true,
    webPreferences: {
      preload: aqui("./preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  nova.removeMenu();
  nova.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  nova.webContents.on("will-navigate", (evento, destino) => {
    if (!navegacaoPermitida(destino, PAGINA)) evento.preventDefault();
  });
  nova.on("close", (evento) => {
    if (saindo) return;
    evento.preventDefault();
    nova.hide();
  });
  nova.once("ready-to-show", () => {
    if (!oculta) nova.show();
  });
  void nova.loadURL(PAGINA);
  return nova;
}

function criarBandeja(): Tray {
  const nova = new Tray(nativeImage.createFromPath(ICONE).resize({ width: 32, height: 32 }));
  nova.setToolTip("SabreHosting");
  nova.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir o SabreHosting", click: mostrarJanela },
      { type: "separator" },
      {
        label: "Sair",
        click: () => {
          saindo = true;
          app.quit();
        },
      },
    ]),
  );
  nova.on("click", mostrarJanela);
  return nova;
}

// Só a página do próprio app pode falar com o processo principal.
function veioDaPagina(evento: IpcMainInvokeEvent): boolean {
  return navegacaoPermitida(evento.senderFrame?.url ?? "", PAGINA);
}

// Cartório, endereço e pasta do servidor vêm do ambiente até a tela de primeira vez (app-1.3); ver .env.exemplo.
function depsReais(): DepsInicio {
  const { SABRE_CARTORIO_URL: url, SABRE_CARTORIO_TOKEN: token } = process.env;
  const { SABRE_PASTA_SERVIDOR: pasta, SABRE_JAVA: java, SABRE_NEOFORGE: neoforge } = process.env;
  let cliente: ReturnType<typeof criarCliente> | undefined;
  let falha: unknown;
  if (url && token) {
    try {
      cliente = criarCliente({ url, cofre: { guardar: async () => {}, ler: async () => token } });
    } catch (e) {
      falha = e;
    }
  }
  const exigir = () => {
    if (cliente) return cliente;
    throw falha ?? erroSemGrupo();
  };
  return {
    lerTrava: () => exigir().estadoTrava(),
    hospedar: async (aoPerder) => {
      if (!pasta || !java || !neoforge) {
        throw new Error("Este PC ainda não está configurado para hospedar o servidor.");
      }
      return hospedar({
        cliente: exigir(),
        aoPerder,
        pasta,
        javaPath: java,
        versaoNeoForge: neoforge,
      });
    },
    endereco: process.env["SABRE_ENDERECO"] ?? "",
    copiar: (texto) => clipboard.writeText(texto),
  };
}

async function criarInicioDoApp(): Promise<Inicio> {
  if (process.env["SABRE_E2E"] !== "1") return criarInicio(depsReais());
  const { criarDepsE2E } = await import("./fake-e2e.js");
  const espiao = { spawns: [] };
  (globalThis as Record<string, unknown>)["__sabreE2EEspiao"] = espiao;
  const cenario = process.env["SABRE_E2E_CENARIO"] ?? "ninguem";
  const inicio = criarInicio(criarDepsE2E(cenario as never, espiao));
  if (cenario === "eu") await inicio.hospedar(); // "eu" = este PC já hospeda, pelo caminho normal
  return inicio;
}

function registrarPonte(inicio: Inicio): void {
  const permitir = (evento: IpcMainInvokeEvent): void => {
    if (!veioDaPagina(evento)) throw new Error("origem não permitida");
  };
  inicio.aoMudar(() => janela?.webContents.send("sabre:inicio:mudou"));
  ipcMain.handle("sabre:inicio:estado", (evento) => (permitir(evento), inicio.estado()));
  ipcMain.handle("sabre:inicio:jogar", (evento) => (permitir(evento), inicio.jogar()));
  ipcMain.handle("sabre:inicio:hospedar", (evento) => (permitir(evento), inicio.hospedar()));
  ipcMain.handle("sabre:inicio:parar", (evento) => (permitir(evento), inicio.parar()));
  ipcMain.handle("sabre:versao", (evento) => {
    if (!veioDaPagina(evento)) throw new Error("origem não permitida");
    return app.getVersion();
  });
  ipcMain.handle("sabre:abrir-com-windows:ler", (evento) => {
    if (!veioDaPagina(evento)) throw new Error("origem não permitida");
    return lerPreferencias(app.getPath("userData")).abrirComWindows;
  });
  ipcMain.handle("sabre:abrir-com-windows:definir", (evento, ligado: unknown) => {
    if (!veioDaPagina(evento)) throw new Error("origem não permitida");
    if (!ehBooleano(ligado)) throw new Error("valor inválido");
    salvarPreferencias(app.getPath("userData"), { abrirComWindows: ligado });
    // Só Windows e macOS têm essa função; no resto o estado guardado basta.
    app.setLoginItemSettings({ openAtLogin: ligado, args: ligado ? [INICIO_OCULTO] : [] });
    return ligado;
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", mostrarJanela);
  app.on("before-quit", () => {
    saindo = true;
  });
  // Fechar a janela só a esconde: o app continua na bandeja até "Sair".
  app.on("window-all-closed", () => undefined);

  void app.whenReady().then(async () => {
    nativeTheme.themeSource = "system";
    registrarPonte(await criarInicioDoApp());
    bandeja = criarBandeja();
    janela = criarJanela(process.argv.includes(INICIO_OCULTO));
    if (process.env["SABRE_E2E"] === "1") {
      (globalThis as Record<string, unknown>)["__sabreE2E"] = { bandeja, janela, PAGINA };
    }
  });
}
