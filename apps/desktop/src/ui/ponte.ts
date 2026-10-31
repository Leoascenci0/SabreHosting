// O que a tela enxerga de `window.sabre` (preload.cts expõe exatamente isto).
export interface PonteSabre {
  versao(): Promise<string>;
  abrirComWindows: {
    ler(): Promise<boolean>;
    definir(ligado: boolean): Promise<boolean>;
  };
}
