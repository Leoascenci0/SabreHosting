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
  },
  backups: {
    listar: (): Promise<unknown> => electron.ipcRenderer.invoke("sabre:backups:listar"),
    restaurar: (nome: string): Promise<unknown> =>
      electron.ipcRenderer.invoke("sabre:backups:restaurar", nome),
  },
  grupo: {
    estado: (): Promise<unknown> => electron.ipcRenderer.invoke("sabre:grupo:estado"),
    tirar: (id: number): Promise<unknown> => electron.ipcRenderer.invoke("sabre:grupo:tirar", id),
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
