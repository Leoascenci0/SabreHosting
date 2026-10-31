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
import { mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  listarVersoes,
  opcoesDaVersao,
  planoDaVersao,
} from "@sabrehosting/nucleo/servidor/versoes";
import { recuperarTroca } from "@sabrehosting/nucleo/backup/restaurar";
import { analisarZip, importarNoCartorio } from "@sabrehosting/nucleo/importar";
import { criarConfiguracoes } from "./configuracoes.js";
import { criarAvisoHistorico } from "./aviso-historico.js";
import { criarRotacaoBackups, type RotacaoBackups } from "./rotacao-backups.js";
import { criarAgendaBackups, iniciarAgendaReal, type AgendaBackups } from "./agenda-backups.js";
import { criarBackups, type Backups } from "./backups.js";
import { depsBackupsReais } from "./deps-backups.js";
import { clienteDoAmbiente, depsReais } from "./deps-reais.js";
import { criarGrupo, type Grupo } from "./grupo.js";
import { criarImportacao, type Importacao } from "./importar.js";
import { criarVersao, type Versao } from "./versao.js";
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

async function avisarProblemaDoMundo(motivo: string): Promise<void> {
  if (process.env["SABRE_E2E"] === "1") return; // diálogo nativo não é clicável no E2E
  const opcoes = {
    type: "warning" as const,
    title: "SabreHosting",
    message: `Atenção com o mundo: ${motivo}`,
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

const avisoHistorico = criarAvisoHistorico();
let backupsApp: Backups | undefined;
let agendaApp: AgendaBackups | undefined;
const intervaloBackupMin = (): number =>
  lerPreferencias(app.getPath("userData")).intervaloBackupMin;

/** Histórico longo: a pasta só vale com a opção ligada (a leitura já desliga pasta torta). */
const historicoLongo = (): string | undefined => {
  const p = lerPreferencias(app.getPath("userData"));
  return p.historicoLongoLigado ? p.historicoLongoPasta : undefined;
};

/** Rotação dos backups: depois de cada backup bom e no arranque; guarda "Quantos guardar" + tudo dos últimos 7 dias. */
function criarRotacaoDoApp(pastaBackups: () => string | undefined): RotacaoBackups {
  return criarRotacaoBackups({
    pastaBackups,
    quantosGuardar: () => lerPreferencias(app.getPath("userData")).quantosGuardar,
    ocupado: () => restaurando(),
    aoAvisar: (texto) => console.warn(`[backup] ${texto}`),
  });
}

/**
 * Rotação da pasta sincronizada (drive-1.1b): só roda depois de uma cópia conferida por hash, só nessa pasta, e as
 * marcas ficam na pasta de dados do app (nunca dentro do Drive). Erro vira aviso na tela e nunca apaga nada.
 */
function criarRotacaoDoHistorico(): RotacaoBackups {
  const dados = (): string => app.getPath("userData");
  return criarRotacaoBackups({
    pastaBackups: historicoLongo,
    quantosGuardar: () => lerPreferencias(dados()).quantosGuardarHistorico,
    arquivoMarcas: () => join(dados(), "marcas-historico.json"),
    aoAvisar: (texto) => {
      console.warn(`[backup] ${texto}`);
      avisoHistorico.definir(texto);
    },
  });
}

/** Backup agendado: liga quando o servidor deste PC fica pronto e segue o intervalo de Configurações › Backups. */
async function criarAgendaDoApp(): Promise<AgendaBackups> {
  const aoAvisar = (texto: string): void => console.warn(`[backup] ${texto}`);
  if (process.env["SABRE_E2E"] !== "1") {
    const exigir = clienteDoAmbiente(process.env);
    const rotacao = criarRotacaoDoApp(() => process.env["SABRE_PASTA_BACKUPS"]);
    void rotacao.rodar(); // no arranque: limpa o que passou do limite desde a última vez
    const rotacaoHistorico = criarRotacaoDoHistorico();
    return criarAgendaBackups({
      intervaloMin: intervaloBackupMin,
      iniciar: iniciarAgendaReal({
        pastaBackups: process.env["SABRE_PASTA_BACKUPS"],
        pastaDoMundo: process.env["SABRE_PASTA_MUNDO"],
        epoca: async () => (await exigir().estadoTrava()).epoca,
        historicoLongo,
        avisoHistorico,
        aoCopiar: rotacaoHistorico.aoBackupBom,
        aoBackupBom: rotacao.aoBackupBom,
        aoAvisar,
      }),
      aoAvisar,
    });
  }
  // E2E: o agendador do núcleo é o de verdade; só o relógio é espião (grava o intervalo pedido, não espera 10 min).
  const intervalos: number[] = [];
  (globalThis as Record<string, unknown>)["__sabreE2EAgenda"] = { intervalos };
  const relogio = {
    setInterval: (_tarefa: () => void, ms: number): NodeJS.Timeout => {
      intervalos.push(ms);
      return setTimeout(() => undefined, 0);
    },
    clearInterval: (t: NodeJS.Timeout): void => clearTimeout(t),
  };
  const rotacao = criarRotacaoDoApp(
    () =>
      (
        (globalThis as Record<string, unknown>)["__sabreE2EBackups"] as
          { backups: string } | undefined
      )?.backups,
  );
  return criarAgendaBackups({
    intervaloMin: intervaloBackupMin,
    iniciar: async (servidor, min) => {
      const { mundo, backups } = (globalThis as Record<string, unknown>)["__sabreE2EBackups"] as {
        mundo: string;
        backups: string;
      };
      return iniciarAgendaReal({
        pastaBackups: backups,
        pastaDoMundo: mundo,
        epoca: async () => 1,
        relogio,
        aoBackupBom: rotacao.aoBackupBom,
      })(servidor, min);
    },
  });
}
const restaurando = (): boolean => backupsApp?.restaurando() ?? false;

async function criarInicioDoApp(): Promise<Inicio> {
  if (process.env["SABRE_E2E"] !== "1")
    return criarInicio({
      ...depsReais(process.env, (t) => clipboard.writeText(t)),
      restaurando,
      aoServidor: (s) => agendaApp?.observar(s),
    });
  const { criarDepsE2E } = await import("./fake-e2e.js");
  const espiao = { spawns: [] };
  (globalThis as Record<string, unknown>)["__sabreE2EEspiao"] = espiao;
  const cenario = process.env["SABRE_E2E_CENARIO"] ?? "ninguem";
  const inicio = criarInicio({
    ...criarDepsE2E(cenario as never, espiao),
    restaurando,
    aoServidor: (s) => agendaApp?.observar(s),
  });
  if (cenario === "eu") await inicio.hospedar(); // "eu" = este PC já hospeda, pelo caminho normal
  return inicio;
}

async function criarBackupsDoApp(inicio: Inicio): Promise<Backups> {
  const servidorRodando = (): boolean => inicio.ativo();
  if (process.env["SABRE_E2E"] !== "1") {
    return criarBackups({
      ...depsBackupsReais(process.env, servidorRodando, () => inicio.temOrfao()),
      avisoHistorico: avisoHistorico.ler,
    });
  }
  const { depsBackupsE2E } = await import("./fake-e2e.js");
  return criarBackups(depsBackupsE2E(servidorRodando));
}

/** Importar mundo (piloto-1.1c): seletor só de .zip; o caminho escolhido fica aqui no main, nunca vem da janela. */
async function criarImportacaoDoApp(inicio: Inicio): Promise<Importacao> {
  const servidorRodando = (): boolean => inicio.ativo();
  if (process.env["SABRE_E2E"] === "1") {
    const { depsImportacaoE2E } = await import("./fake-e2e.js");
    return criarImportacao(depsImportacaoE2E(servidorRodando, restaurando));
  }
  const exigir = clienteDoAmbiente(process.env);
  return criarImportacao({
    escolherArquivo: async () => {
      const opcoes = {
        title: "Escolha o .zip do mundo",
        filters: [{ name: "Mundo em .zip", extensions: ["zip"] }],
        properties: ["openFile"] as "openFile"[],
      };
      const r = janela
        ? await dialog.showOpenDialog(janela, opcoes)
        : await dialog.showOpenDialog(opcoes);
      return r.canceled ? undefined : r.filePaths[0];
    },
    analisar: (zip) => analisarZip(zip),
    situacao: async () => {
      const cliente = exigir();
      const [versaoNoGrupo, eu] = await Promise.all([cliente.numeroMaisNovo(), cliente.eu()]);
      return { versaoNoGrupo, dono: eu.dono };
    },
    importar: async (zip, aceitarVersaoNova) => {
      // Pasta de trabalho do app (não a do mundo): a importação cria e apaga só a própria temporária dentro dela.
      const pastaDeTrabalho = join(app.getPath("userData"), "importar");
      mkdirSync(pastaDeTrabalho, { recursive: true });
      return importarNoCartorio(zip, { cliente: exigir(), pastaDeTrabalho, aceitarVersaoNova });
    },
    servidorRodando,
    restaurando,
  });
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

async function criarVersaoDoApp(servidorRodando: () => boolean): Promise<Versao> {
  if (process.env["SABRE_E2E"] !== "1") {
    const exigir = clienteDoAmbiente(process.env);
    return criarVersao({
      eu: async () => exigir().eu(),
      lerAtual: async () => (await exigir().lerConfigGrupo()).versaoMinecraft,
      listar: async () => (await listarVersoes()).map((v) => v.id),
      opcoes: (v) => opcoesDaVersao(v),
      sha1Do: async (v) => (await planoDaVersao(v)).jar.hashEsperado.valor,
      gravar: async (v, sha1) => void (await exigir().gravarConfigGrupo(v, sha1)),
      servidorRodando,
    });
  }
  const { depsVersaoE2E } = await import("./fake-e2e.js");
  return criarVersao(depsVersaoE2E(servidorRodando));
}

function registrarPonte(
  inicio: Inicio,
  backups: Backups,
  grupo: Grupo,
  versao: Versao,
  importacao: Importacao,
): void {
  const configuracoes = criarConfiguracoes({
    pasta: app.getPath("userData"),
    aplicarAbrirComWindows,
    aplicarIntervaloBackup: () => agendaApp?.reagendar(),
    escolherPasta: async () => {
      const opcoes = {
        title: "Escolha a pasta do histórico longo",
        properties: ["openDirectory", "createDirectory"] as ("openDirectory" | "createDirectory")[],
      };
      const r = janela
        ? await dialog.showOpenDialog(janela, opcoes)
        : await dialog.showOpenDialog(opcoes);
      return r.canceled ? undefined : r.filePaths[0];
    },
  });
  const permitir = (evento: IpcMainInvokeEvent): void => {
    if (!veioDaPagina(evento, PAGINA)) throw new Error("origem não permitida");
  };
  inicio.aoMudar(() => janela?.webContents.send("sabre:inicio:mudou"));
  ipcMain.handle("sabre:inicio:estado", (evento) => (permitir(evento), inicio.estado()));
  ipcMain.handle("sabre:inicio:jogar", (evento) => (permitir(evento), inicio.jogar()));
  ipcMain.handle("sabre:inicio:hospedar", (evento) => (permitir(evento), inicio.hospedar()));
  ipcMain.handle("sabre:inicio:parar", (evento) => (permitir(evento), inicio.parar()));
  ipcMain.handle(
    "sabre:config:escolher-pasta",
    (evento) => (permitir(evento), configuracoes.escolherPasta()),
  );
  ipcMain.handle("sabre:backups:listar", (evento) => (permitir(evento), backups.estado()));
  ipcMain.handle("sabre:backups:restaurar", (evento, nome: unknown) => {
    permitir(evento);
    return backups.restaurar(nome); // o nome só vale se estiver na lista; a cola confere
  });
  ipcMain.handle(
    "sabre:importar:escolherZip",
    (evento) => (permitir(evento), importacao.escolher()),
  );
  ipcMain.handle("sabre:importar:executar", (evento, confirmado: unknown) => {
    permitir(evento);
    return importacao.executar(confirmado); // só `true` vale; o arquivo é o que o seletor do main deu
  });
  ipcMain.handle("sabre:grupo:estado", (evento) => (permitir(evento), grupo.estado()));
  ipcMain.handle("sabre:grupo:tirar", (evento, id: unknown) => {
    permitir(evento);
    return grupo.tirar(id); // o main revalida dono, lista e "não é o dono" antes de revogar
  });
  ipcMain.handle("sabre:versoes:estado", (evento) => (permitir(evento), versao.estado()));
  ipcMain.handle("sabre:versoes:opcoes", (evento, v: unknown) => {
    permitir(evento);
    return versao.opcoes(v); // o main confere dono e se a versão está na lista oficial
  });
  ipcMain.handle("sabre:versoes:gravar", (evento, v: unknown) => {
    permitir(evento);
    return versao.gravar(v); // dono, servidor parado e lista oficial são revalidados aqui
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
    // App morto entre os dois rename da troca do mundo: devolve o mundo antes de qualquer coisa. Falha não derruba
    // o app (o marcador fica e o servidor não sobe), mas o amigo é avisado.
    const pastaDoServidor = process.env["SABRE_PASTA_SERVIDOR"];
    const falhaDaTroca = pastaDoServidor
      ? await recuperarTroca(pastaDoServidor).then(
          () => undefined,
          (erro: unknown) => (erro instanceof Error ? erro.message : String(erro)),
        )
      : "A pasta do servidor não está configurada; não deu para conferir se a última troca do mundo terminou.";
    if (falhaDaTroca !== undefined) {
      console.error("Recuperar troca do mundo:", falhaDaTroca);
      void avisarProblemaDoMundo(falhaDaTroca);
    }
    agendaApp = await criarAgendaDoApp();
    inicioApp = await criarInicioDoApp();
    backupsApp = await criarBackupsDoApp(inicioApp);
    const inicioPronto = inicioApp;
    registrarPonte(
      inicioApp,
      backupsApp,
      await criarGrupoDoApp(),
      await criarVersaoDoApp(() => inicioPronto.ativo()),
      await criarImportacaoDoApp(inicioApp),
    );
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
