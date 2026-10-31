import {
  app,
  BrowserWindow,
  clipboard,
  dialog,
  ipcMain,
  Menu,
  nativeImage,
  nativeTheme,
  safeStorage,
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
import { ligarEspalhar } from "./ligar-espalhar.js";
import { precisaEncerrarAntesDeSair } from "./saida.js";
import {
  conferirTokenNoCartorio,
  criarServidorDeArquivos,
  ipDaRedePrivada,
  pastaDaVitrine,
  type ServidorDeArquivos,
  religarAteLigar,
} from "./servir-arquivos.js";
import { criarAgendaBackups, iniciarAgendaReal, type AgendaBackups } from "./agenda-backups.js";
import { criarBackups, type Backups } from "./backups.js";
import { backupParado, depsBackupsReais } from "./deps-backups.js";
import { ambienteLegado, lerConfigPc, pastaDoMundoAgora, type ConfigPc } from "./config-pc.js";
import { criarCofreSeguro, ARQUIVO_COFRE } from "./cofre.js";
import { clienteDoPc, depsReais, pastaModsDaInstancia } from "./deps-reais.js";
import { registrarBoasVindas } from "./boas-vindas-app.js";
import { criarGrupo, type Grupo } from "./grupo.js";
import { criarModsGrupo, type ModsGrupo } from "./mods-grupo.js";
import { sincronizarMods } from "@sabrehosting/nucleo/launcher/mods";
import { criarImportacao, type Importacao } from "./importar.js";
import { criarVersao, type Versao } from "./versao.js";
import { criarEncaixeInicio } from "./encaixe-inicio.js";
import { criarPastaBase } from "./pasta-base.js";
import { criarInicio, mensagemFalhaSair, type Inicio } from "./inicio.js";
import { bytesPorSegundo, lerPreferencias, salvarPreferencias } from "./preferencias.js";
import { ehBooleano, navegacaoPermitida, veioDaPagina } from "./seguranca.js";

const aqui = (relativo: string): string => fileURLToPath(new URL(relativo, import.meta.url));
const PAGINA = pathToFileURL(aqui("../ui/index.html")).href;
const ICONE = aqui("../../recursos/icone/icone-256.png");
const PASTA_ICONE = aqui("../../recursos/icone/");
const INICIO_OCULTO = "--oculto";

/**
 * Configuração deste PC: o que o assistente gravou + o token do cofre (lida no arranque, ver `whenReady`). O ambiente
 * do Windows não entra aqui; depois de concluir o assistente o app reinicia para relê-la.
 */
let pc: ConfigPc = {};
/** Mesma configuração no formato `SABRE_*`, só para os pedaços que ainda o leem (backups, atualizar mundo). */
let ambientePc: NodeJS.ProcessEnv = {};

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
  pararRelogioRede?.(); // o relógio de 60 s não pode religar o servidor depois de fechado
  pararRelogioRede = undefined;
  const servindo = servidorArquivosApp;
  servidorArquivosApp = undefined;
  await servindo?.fechar().catch(() => undefined); // para de servir ao sair
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
let versaoApp: Versao | undefined;
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
    const exigir = clienteDoPc(pc);
    const rotacao = criarRotacaoDoApp(() => pc.pastaBackups);
    void rotacao.rodar(); // no arranque: limpa o que passou do limite desde a última vez
    const rotacaoHistorico = criarRotacaoDoHistorico();
    return criarAgendaBackups({
      intervaloMin: intervaloBackupMin,
      iniciar: iniciarAgendaReal({
        pastaBackups: pc.pastaBackups,
        pastaDoMundo: pc.pastaMundo,
        mundoAgora: () => pastaDoMundoAgora(pc.pastaServidor),
        epoca: async () => (await exigir().estadoTrava()).epoca,
        historicoLongo,
        avisoHistorico,
        aoCopiar: rotacaoHistorico.aoBackupBom,
        aoBackupBom: async (feito) => {
          await rotacao.aoBackupBom(feito); // marca "bom" primeiro: a vitrine só pega backup marcado
          await servidorArquivosApp?.publicarUltimoBom();
          void disparoEspalhar?.();
        },
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
const trocandoVersao = (): boolean => versaoApp?.trocando() ?? false;
/** Percentual da atualização do mundo em curso (sync-2.2); `undefined` = nenhuma. */
let atualizandoMundo: number | undefined;
const atualizando = (): number | undefined => atualizandoMundo;
/** Por que a última atualização do mundo falhou (syncmel-1.14); some quando a próxima rodada começa. */
let avisoAtualizacaoMundo: string | undefined;
const avisoAtualizacao = (): string | undefined => avisoAtualizacaoMundo;

async function criarInicioDoApp(): Promise<Inicio> {
  if (process.env["SABRE_E2E"] !== "1") {
    const reais = depsReais(pc, (t) => clipboard.writeText(t), {
      pastaDados: app.getPath("userData"),
    });
    void reais.atualizarEndereco?.(); // o endereço do Jogar é o que o cartório diz (GET /grupo)
    return criarInicio({
      ...reais,
      // O espalhamento `...` copiaria o valor do getter; religa o endereço vivo.
      get endereco() {
        return reais.endereco;
      },
      restaurando,
      trocandoVersao,
      atualizando,
      avisoAtualizacao,
      aoServidor: (s) => agendaApp?.observar(s),
    });
  }
  const { criarDepsE2E } = await import("./fake-e2e.js");
  const espiao = { spawns: [] };
  (globalThis as Record<string, unknown>)["__sabreE2EEspiao"] = espiao;
  const cenario = process.env["SABRE_E2E_CENARIO"] ?? "ninguem";
  const inicio = criarInicio({
    ...criarDepsE2E(cenario as never, espiao),
    restaurando,
    trocandoVersao,
    aoServidor: (s) => agendaApp?.observar(s),
  });
  if (cenario === "eu") await inicio.hospedar(); // "eu" = este PC já hospeda, pelo caminho normal
  return inicio;
}

async function criarBackupsDoApp(inicio: Inicio): Promise<Backups> {
  const servidorRodando = (): boolean => inicio.ativo();
  if (process.env["SABRE_E2E"] !== "1") {
    return criarBackups({
      ...depsBackupsReais(
        ambientePc,
        servidorRodando,
        () => inicio.temOrfao(),
        () => pastaDoMundoAgora(pc.pastaServidor),
      ),
      avisoHistorico: avisoHistorico.ler,
    });
  }
  const { depsBackupsE2E } = await import("./fake-e2e.js");
  return criarBackups(depsBackupsE2E(servidorRodando));
}

const RELER_REDE_MS = 60_000;
let servidorArquivosApp: ServidorDeArquivos | undefined;
let pararRelogioRede: (() => void) | undefined;
/** Disparo da atualização do mundo (relógio de 10 min, arranque e depois de cada backup bom). */
let disparoEspalhar: (() => Promise<void>) | undefined;

/**
 * Passa o mundo aos outros PCs (syncmel-1.10): só na IP da rede privada, só a vitrine do último backup bom, token
 * conferido pelo cartório. Sem túnel, sem cartório ou sem pastas: não liga e avisa no log.
 */
async function ligarServidorDeArquivosDoApp(): Promise<void> {
  if (process.env["SABRE_E2E"] === "1") return;
  const { urlCartorio: url, pastaBackups } = pc;
  if (!url || !pastaBackups) return;
  const aoAvisar = (texto: string): void => console.warn(`[servir] ${texto}`);
  try {
    servidorArquivosApp = criarServidorDeArquivos({
      endereco: () => ipDaRedePrivada(),
      conferirToken: conferirTokenNoCartorio(url),
      pastaBackups,
      pastaVitrine: pastaDaVitrine(app.getPath("userData")),
      aoAvisar,
    });
  } catch (e) {
    aoAvisar(e instanceof Error ? e.message : String(e));
    return;
  }
  const servidor = servidorArquivosApp;
  if (await servidor.tentarLigar()) return;
  // Túnel que sobe depois do arranque: relê o IP até ligar (um relógio só; o aviso de "sem rede" sai uma vez).
  pararRelogioRede = religarAteLigar(servidor, RELER_REDE_MS);
}

/** Importar mundo (piloto-1.1c): seletor só de .zip; o caminho escolhido fica aqui no main, nunca vem da janela. */
async function criarImportacaoDoApp(inicio: Inicio): Promise<Importacao> {
  const servidorRodando = (): boolean => inicio.ativo();
  if (process.env["SABRE_E2E"] === "1") {
    const { depsImportacaoE2E } = await import("./fake-e2e.js");
    return criarImportacao(depsImportacaoE2E(servidorRodando, restaurando));
  }
  const exigir = clienteDoPc(pc);
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
      const [nova, eu] = await Promise.all([cliente.maisNova(), cliente.eu()]);
      return { versaoNoGrupo: nova?.numero ?? null, dono: eu.dono };
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
    const exigir = clienteDoPc(pc);
    return criarGrupo({
      lerEndereco: async () => (await exigir().grupo()).endereco_jogar,
      eu: async () => exigir().eu(),
      listarPcs: async () => exigir().listarPcs(),
      revogarPc: async (id) => exigir().revogarPc(id),
      criarConvite: async (nomePc, horas) => exigir().criarConvite(nomePc, horas),
    });
  }
  const { depsGrupoE2E } = await import("./fake-e2e.js");
  return criarGrupo(depsGrupoE2E());
}

async function criarVersaoDoApp(
  servidorRodando: () => boolean,
  temOrfao: () => Promise<boolean>,
): Promise<Versao> {
  if (process.env["SABRE_E2E"] !== "1") {
    const exigir = clienteDoPc(pc);
    const rotacao = criarRotacaoDoApp(() => pc.pastaBackups);
    return criarVersao({
      backupAntes: () =>
        backupParado({
          pastaBackups: pc.pastaBackups,
          pastaDoMundo: pc.pastaMundo,
          mundoAgora: () => pastaDoMundoAgora(pc.pastaServidor),
          cliente: exigir(),
          servidorRodando,
          servidorOrfao: temOrfao,
          aoBom: rotacao.aoBackupBom,
        }),
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

async function criarModsDoApp(servidorRodando: () => boolean): Promise<ModsGrupo> {
  if (process.env["SABRE_E2E"] !== "1") {
    const exigir = clienteDoPc(pc);
    const servidor = pc.pastaServidor;
    const instancia = await pastaModsDaInstancia(pc.grupo); // a instância do grupo no Prism, se já existir
    return criarModsGrupo({
      eu: async () => exigir().eu(),
      lerLista: async () => exigir().lerModsGrupo(),
      gravarLista: async (mods) => void (await exigir().gravarModsGrupo(mods)),
      pastaDoServidor: () => (servidor ? join(servidor, "mods") : undefined),
      pastaDaInstancia: () => instancia,
      servidorRodando,
      sincronizar: sincronizarMods,
    });
  }
  const { depsModsE2E } = await import("./fake-e2e.js");
  return criarModsGrupo(depsModsE2E(servidorRodando));
}

function registrarPonte(
  inicio: Inicio,
  backups: Backups,
  grupo: Grupo,
  versao: Versao,
  mods: ModsGrupo,
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
  const pastaBase = criarPastaBase({
    dados: app.getPath("userData"),
    servidorRodando: () => inicio.ativo() || inicio.temOrfao(),
  });
  ipcMain.handle("sabre:pasta:estado", (evento) => (permitir(evento), pastaBase.estado()));
  ipcMain.handle("sabre:pasta:trocar", async (evento, pasta: unknown) => {
    permitir(evento);
    const r = await pastaBase.trocar(pasta); // o main revalida a pasta e o servidor parado
    // A configuração é lida no arranque: o app reinicia para já usar a pasta nova (no E2E, não).
    if (r.ok && process.env["SABRE_E2E"] !== "1") {
      setTimeout(() => {
        app.relaunch({ args: process.argv.slice(1) });
        app.exit(0);
      }, 1500);
    }
    return r;
  });
  inicio.aoMudar(() => janela?.webContents.send("sabre:inicio:mudou"));
  ipcMain.handle("sabre:inicio:estado", (evento) => (permitir(evento), inicio.estado()));
  const encaixe = criarEncaixeInicio({
    trocada: () => pastaBase.trocada(),
    jogar: () => inicio.jogar(),
    hospedar: () => inicio.hospedar(),
  });
  ipcMain.handle("sabre:inicio:jogar", (evento) => (permitir(evento), encaixe.jogar()));
  ipcMain.handle("sabre:inicio:hospedar", (evento) => (permitir(evento), encaixe.hospedar()));
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
  ipcMain.handle("sabre:grupo:criar-convite", (evento, entrada: unknown) => {
    permitir(evento);
    return grupo.criarConvite(entrada); // o main revalida o dono, o nome e a validade; o texto não é gravado nem logado
  });
  ipcMain.handle("sabre:mods:estado", (evento) => (permitir(evento), mods.estado()));
  ipcMain.handle("sabre:mods:adicionar", (evento, mod: unknown) => {
    permitir(evento);
    return mods.adicionar(mod); // o main confere dono, repetido e os campos (host, .jar, hash) antes de gravar
  });
  ipcMain.handle("sabre:mods:tirar", (evento, arquivo: unknown) => {
    permitir(evento);
    return mods.tirar(arquivo);
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
    if (
      precisaEncerrarAntesDeSair({
        podeSair,
        encerrando,
        servidorMinecraftAtivo: inicioApp?.ativo() === true,
        servindoArquivos: servidorArquivosApp !== undefined,
      })
    ) {
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
    if (process.env["SABRE_E2E"] !== "1") {
      const dados = app.getPath("userData");
      pc = await lerConfigPc(
        dados,
        criarCofreSeguro(safeStorage, join(dados, ARQUIVO_COFRE)),
        process.env,
        !app.isPackaged,
      );
      ambientePc = ambienteLegado(pc);
    }
    const pastaDoServidor = pc.pastaServidor;
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
    if (process.env["SABRE_E2E"] !== "1") {
      disparoEspalhar = ligarEspalhar({
        env: ambientePc,
        inicio: inicioApp,
        aoAvisar: (texto, paraTela) => {
          console.warn(texto); // detalhe bruto só no console
          avisoAtualizacaoMundo = `Não consegui atualizar o mundo: ${paraTela}`;
          inicioApp?.mudou();
        },
        aoProgresso: (p) => {
          if (p === 0) avisoAtualizacaoMundo = undefined;
          atualizandoMundo = p;
          inicioApp?.mudou();
        },
        limiteBytesPorSeg: () =>
          bytesPorSegundo(lerPreferencias(app.getPath("userData")).limiteBandaMBs),
      });
    }
    void ligarServidorDeArquivosDoApp();
    const inicioPronto = inicioApp;
    versaoApp = await criarVersaoDoApp(
      () => inicioPronto.ativo(),
      () => inicioPronto.temOrfao(),
    );
    const modsApp = await criarModsDoApp(() => inicioPronto.ativo());
    registrarPonte(
      inicioApp,
      backupsApp,
      await criarGrupoDoApp(),
      versaoApp,
      modsApp,
      await criarImportacaoDoApp(inicioApp),
    );
    void modsApp.sincronizar(); // não segura a janela; o estado "Atualizando mods…" aparece em Configurações
    await registrarBoasVindas({
      dados: app.getPath("userData"),
      janela: () => janela,
      permitir: (evento) => {
        if (!veioDaPagina(evento, PAGINA)) throw new Error("origem não permitida");
      },
      // A configuração é lida no arranque: ao concluir o assistente o app reinicia para já usá-la (no E2E, não).
      aoConcluir: () => {
        if (process.env["SABRE_E2E"] === "1") return;
        setTimeout(() => {
          app.relaunch({ args: process.argv.slice(1) });
          app.exit(0);
        }, 1500);
      },
    });
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
