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
});
