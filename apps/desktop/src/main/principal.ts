import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  Tray,
} from "electron";
import type { IpcMainInvokeEvent } from "electron";
import { readFileSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { criarConfiguracoes } from "./configuracoes.js";
import { criarBackups, type Backups } from "./backups.js";
import { depsBackupsReais } from "./deps-backups.js";
import { clienteDoAmbiente, depsReais } from "./deps-reais.js";
import { criarGrupo, type Grupo } from "./grupo.js";
import { criarInicio, mensagemFalhaSair, type Inicio } from "./inicio.js";
import { lerPreferencias, salvarPreferencias } from "./preferencias.js";
import { ehBooleano, navegacaoPermitida, veioDaPagina } from "./seguranca.js";

const aqui = (relativo: string): string => fileURLToPath(new URL(relativo, import.meta.url));
const PAGINA = pathToFileURL(aqui("../ui/index.html")).href;
const ICONE = aqui("../../recursos/icone/icone-256.png");
const PASTA_ICONE = aqui("../../recursos/icone/");
const INICIO_OCULTO = "--oculto";

let janela: BrowserWindow | null = null;
let bandeja: Tray | null = null;
let saindo = false;
let inicioApp: Inicio | undefined;
let encerrando = false;
let podeSair = false;

async function perguntarSair(): Promise<boolean> {
  if (process.env["SABRE_E2E"] === "1") return true; // o diálogo nativo não é clicável no E2E
  const opcoes = {
    type: "warning" as const,
    buttons: ["Parar e sair", "Cancelar"],
    defaultId: 1,
    cancelId: 1,
    title: "SabreHosting",
    message: "Os amigos conectados vão cair. Parar o servidor e sair?",
  };
  const r = janela
    ? await dialog.showMessageBox(janela, opcoes)
    : await dialog.showMessageBox(opcoes);
  return r.response === 0;
}

async function avisarFalhaSair(motivo: string): Promise<void> {
  if (process.env["SABRE_E2E"] === "1") return; // diálogo nativo não é clicável no E2E
  const opcoes = {
    type: "error" as const,
    title: "SabreHosting",
    message: mensagemFalhaSair(motivo),
  };
  if (janela) await dialog.showMessageBox(janela, opcoes);
  else await dialog.showMessageBox(opcoes);
}

/**
 * Sair com o servidor no ar: para (salva, para, devolve a trava) ANTES de fechar; senão o Java seguiria sem
 * renovar a trava e outro PC hospedaria o mesmo mundo (regra de ouro 1).
 */
async function sairDoApp(perguntar: boolean): Promise<void> {
  if (encerrando) return;
  encerrando = true;
  if (inicioApp?.ativo()) mostrarJanela(); // o progresso ("Parando o servidor…") aparece na tela
  const r = (await inicioApp?.encerrar(perguntar ? perguntarSair : async () => true)) ?? {
    sair: true as const,
  };
  encerrando = false;
  if (!r.sair) {
    if (r.falha !== undefined) await avisarFalhaSair(r.falha);
    return;
  }
  podeSair = true;
  saindo = true;
  app.quit();
}

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

// Recorte só da cabeça do tigre: 16 px (100%), 24 px (150%), 32 px (200%) e 48 px (300%).
function iconeDaBandeja(): Electron.NativeImage {
  const imagem = nativeImage.createEmpty();
  for (const [escala, lado] of [
    [1, 16],
    [1.5, 24],
    [2, 32],
    [3, 48],
  ] as const) {
    imagem.addRepresentation({
      scaleFactor: escala,
      width: lado,
      height: lado,
      buffer: readFileSync(`${PASTA_ICONE}bandeja-${lado}.png`),
    });
  }
  return imagem;
}

function criarBandeja(): Tray {
  const nova = new Tray(iconeDaBandeja());
  nova.setToolTip("SabreHosting");
  nova.setContextMenu(
    Menu.buildFromTemplate([
      { label: "Abrir o SabreHosting", click: mostrarJanela },
      { type: "separator" },
      {
        label: "Sair",
        click: () => void sairDoApp(true),
      },
    ]),
  );
  nova.on("click", mostrarJanela);
  return nova;
}

let backupsApp: Backups | undefined;
const restaurando = (): boolean => backupsApp?.restaurando() ?? false;

async function criarInicioDoApp(): Promise<Inicio> {
  if (process.env["SABRE_E2E"] !== "1")
    return criarInicio({
      ...depsReais(process.env, (t) => clipboard.writeText(t)),
      restaurando,
    });
  const { criarDepsE2E } = await import("./fake-e2e.js");
  const espiao = { spawns: [] };
  (globalThis as Record<string, unknown>)["__sabreE2EEspiao"] = espiao;
  const cenario = process.env["SABRE_E2E_CENARIO"] ?? "ninguem";
  const inicio = criarInicio({ ...criarDepsE2E(cenario as never, espiao), restaurando });
  if (cenario === "eu") await inicio.hospedar(); // "eu" = este PC já hospeda, pelo caminho normal
  return inicio;
}

async function criarBackupsDoApp(inicio: Inicio): Promise<Backups> {
  const servidorRodando = (): boolean => inicio.ativo();
  if (process.env["SABRE_E2E"] !== "1") {
    return criarBackups(depsBackupsReais(process.env, servidorRodando, () => inicio.temOrfao()));
  }
  const { depsBackupsE2E } = await import("./fake-e2e.js");
  return criarBackups(depsBackupsE2E(servidorRodando));
}

const aplicarAbrirComWindows = (ligado: boolean): void => {
  // Só Windows e macOS têm essa função; no resto o estado guardado basta.
  app.setLoginItemSettings({ openAtLogin: ligado, args: ligado ? [INICIO_OCULTO] : [] });
};

async function criarGrupoDoApp(): Promise<Grupo> {
  if (process.env["SABRE_E2E"] !== "1") {
    const exigir = clienteDoAmbiente(process.env);
    return criarGrupo({
      eu: async () => exigir().eu(),
      listarPcs: async () => exigir().listarPcs(),
      revogarPc: async (id) => exigir().revogarPc(id),
    });
  }
  const { depsGrupoE2E } = await import("./fake-e2e.js");
  return criarGrupo(depsGrupoE2E());
}

function registrarPonte(inicio: Inicio, backups: Backups, grupo: Grupo): void {
  const configuracoes = criarConfiguracoes({
    pasta: app.getPath("userData"),
    aplicarAbrirComWindows,
  });
  const permitir = (evento: IpcMainInvokeEvent): void => {
    if (!veioDaPagina(evento, PAGINA)) throw new Error("origem não permitida");
  };
  inicio.aoMudar(() => janela?.webContents.send("sabre:inicio:mudou"));
  ipcMain.handle("sabre:inicio:estado", (evento) => (permitir(evento), inicio.estado()));
  ipcMain.handle("sabre:inicio:jogar", (evento) => (permitir(evento), inicio.jogar()));
  ipcMain.handle("sabre:inicio:hospedar", (evento) => (permitir(evento), inicio.hospedar()));
  ipcMain.handle("sabre:inicio:parar", (evento) => (permitir(evento), inicio.parar()));
  ipcMain.handle("sabre:backups:listar", (evento) => (permitir(evento), backups.estado()));
  ipcMain.handle("sabre:backups:restaurar", (evento, nome: unknown) => {
    permitir(evento);
    return backups.restaurar(nome); // o nome só vale se estiver na lista; a cola confere
  });
  ipcMain.handle("sabre:grupo:estado", (evento) => (permitir(evento), grupo.estado()));
  ipcMain.handle("sabre:grupo:tirar", (evento, id: unknown) => {
    permitir(evento);
    return grupo.tirar(id); // o main revalida dono, lista e "não é o dono" antes de revogar
  });
  ipcMain.handle("sabre:config:ler", (evento) => (permitir(evento), configuracoes.ler()));
  ipcMain.handle("sabre:config:salvar", (evento, valor: unknown) => {
    permitir(evento);
    return configuracoes.salvar(valor); // valida antes de gravar; a tela só mostra a mensagem
  });
  ipcMain.handle("sabre:versao", (evento) => {
    if (!veioDaPagina(evento, PAGINA)) throw new Error("origem não permitida");
    return app.getVersion();
  });
  ipcMain.handle("sabre:abrir-com-windows:ler", (evento) => {
    if (!veioDaPagina(evento, PAGINA)) throw new Error("origem não permitida");
    return lerPreferencias(app.getPath("userData")).abrirComWindows;
  });
  ipcMain.handle("sabre:abrir-com-windows:definir", (evento, ligado: unknown) => {
    if (!veioDaPagina(evento, PAGINA)) throw new Error("origem não permitida");
    if (!ehBooleano(ligado)) throw new Error("valor inválido");
    const pasta = app.getPath("userData");
    salvarPreferencias(pasta, { ...lerPreferencias(pasta), abrirComWindows: ligado });
    aplicarAbrirComWindows(ligado);
    return ligado;
  });
}

if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", mostrarJanela);
  app.on("before-quit", (evento) => {
    if (!podeSair && (encerrando || inicioApp?.ativo())) {
      evento.preventDefault(); // saída por fora da bandeja (ex.: desligar o Windows): para o servidor antes
      void sairDoApp(false);
      return;
    }
    saindo = true;
  });
  // Fechar a janela só a esconde: o app continua na bandeja até "Sair".
  app.on("window-all-closed", () => undefined);

  void app.whenReady().then(async () => {
    nativeTheme.themeSource = "system";
    inicioApp = await criarInicioDoApp();
    backupsApp = await criarBackupsDoApp(inicioApp);
    registrarPonte(inicioApp, backupsApp, await criarGrupoDoApp());
    bandeja = criarBandeja();
    janela = criarJanela(process.argv.includes(INICIO_OCULTO));
    if (process.env["SABRE_E2E"] === "1") {
      (globalThis as Record<string, unknown>)["__sabreE2E"] = {
        bandeja,
        janela,
        PAGINA,
        sair: () => sairDoApp(true),
      };
    }
  });
}
