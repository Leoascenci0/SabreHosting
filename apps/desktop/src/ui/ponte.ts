// O que a tela enxerga de `window.sabre` (preload.cts expõe exatamente isto).
export type MotivoSemCartorio = "rede" | "servidor" | "acesso";

export type EstadoInicio =
  | { tipo: "carregando" }
  | { tipo: "sem-cartorio"; motivo: MotivoSemCartorio }
  | { tipo: "ninguem" }
  | { tipo: "outro"; nomePc: string; endereco: string }
  | { tipo: "eu"; endereco: string };

export type Resultado = { ok: true } | { ok: false; mensagem: string };

export interface PonteSabre {
  versao(): Promise<string>;
  abrirComWindows: {
    ler(): Promise<boolean>;
    definir(ligado: boolean): Promise<boolean>;
  };
  inicio: {
    estado(): Promise<EstadoInicio>;
    jogar(): Promise<{ copiado: boolean; endereco: string }>;
    hospedar(): Promise<Resultado>;
    parar(): Promise<Resultado>;
    /** Avisa quando o estado mudou por conta própria (servidor caiu, vez de hospedar perdida). */
    aoProgresso(cb: () => void): () => void;
  };
}
