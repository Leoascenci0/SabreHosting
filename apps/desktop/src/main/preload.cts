// A janela roda com sandbox: este arquivo só pode usar "electron", não outros módulos nossos.
// Preload com sandbox é CommonJS: só `import = require` é aceito pelo TypeScript aqui.
// eslint-disable-next-line @typescript-eslint/no-require-imports
import electron = require("electron");

electron.contextBridge.exposeInMainWorld("sabre", {
  versao: (): Promise<string> => electron.ipcRenderer.invoke("sabre:versao"),
  abrirComWindows: {
    ler: (): Promise<boolean> => electron.ipcRenderer.invoke("sabre:abrir-com-windows:ler"),
    definir: (ligado: boolean): Promise<boolean> =>
      electron.ipcRenderer.invoke("sabre:abrir-com-windows:definir", ligado),
  },
  configuracoes: {
    ler: (): Promise<unknown> => electron.ipcRenderer.invoke("sabre:config:ler"),
    salvar: (valor: unknown): Promise<unknown> =>
      electron.ipcRenderer.invoke("sabre:config:salvar", valor),
    escolherPasta: (): Promise<unknown> =>
      electron.ipcRenderer.invoke("sabre:config:escolher-pasta"),
  },
  boasVindas: {
    estado: (): Promise<unknown> => electron.ipcRenderer.invoke("sabre:bv:estado"),
    conferirConvite: (texto: string): Promise<unknown> =>
      electron.ipcRenderer.invoke("sabre:bv:conferir", texto),
    entrar: (): Promise<unknown> => electron.ipcRenderer.invoke("sabre:bv:entrar"),
    eula: (): Promise<unknown> => electron.ipcRenderer.invoke("sabre:bv:eula"),
    abrirEula: (): Promise<void> => electron.ipcRenderer.invoke("sabre:bv:abrir-eula"),
    aceitarEula: (aceito: boolean): Promise<unknown> =>
      electron.ipcRenderer.invoke("sabre:bv:aceitar-eula", aceito),
    escolherPasta: (): Promise<unknown> => electron.ipcRenderer.invoke("sabre:bv:escolher-pasta"),
    concluir: (pasta: string): Promise<unknown> =>
      electron.ipcRenderer.invoke("sabre:bv:concluir", pasta),
  },
  backups: {
    listar: (): Promise<unknown> => electron.ipcRenderer.invoke("sabre:backups:listar"),
    restaurar: (nome: string): Promise<unknown> =>
      electron.ipcRenderer.invoke("sabre:backups:restaurar", nome),
  },
  importar: {
    escolherZip: (): Promise<unknown> => electron.ipcRenderer.invoke("sabre:importar:escolherZip"),
    executar: (confirmado: boolean): Promise<unknown> =>
      electron.ipcRenderer.invoke("sabre:importar:executar", confirmado),
  },
  grupo: {
    estado: (): Promise<unknown> => electron.ipcRenderer.invoke("sabre:grupo:estado"),
    tirar: (id: number): Promise<unknown> => electron.ipcRenderer.invoke("sabre:grupo:tirar", id),
  },
  versoes: {
    estado: (): Promise<unknown> => electron.ipcRenderer.invoke("sabre:versoes:estado"),
    opcoes: (versao: string): Promise<unknown> =>
      electron.ipcRenderer.invoke("sabre:versoes:opcoes", versao),
    gravar: (versao: string): Promise<unknown> =>
      electron.ipcRenderer.invoke("sabre:versoes:gravar", versao),
  },
  inicio: {
    estado: (): Promise<unknown> => electron.ipcRenderer.invoke("sabre:inicio:estado"),
    jogar: (): Promise<unknown> => electron.ipcRenderer.invoke("sabre:inicio:jogar"),
    hospedar: (): Promise<unknown> => electron.ipcRenderer.invoke("sabre:inicio:hospedar"),
    parar: (): Promise<unknown> => electron.ipcRenderer.invoke("sabre:inicio:parar"),
    aoProgresso: (cb: () => void): (() => void) => {
      const ouvinte = (): void => cb();
      electron.ipcRenderer.on("sabre:inicio:mudou", ouvinte);
      return () => void electron.ipcRenderer.removeListener("sabre:inicio:mudou", ouvinte);
    },
  },
});
