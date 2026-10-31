// O que a tela enxerga de `window.sabre` (preload.cts expõe exatamente isto).
export type MotivoSemCartorio = "rede" | "servidor" | "acesso";

export type EstadoInicio =
  | { tipo: "carregando" }
  | { tipo: "sem-cartorio"; motivo: MotivoSemCartorio }
  | { tipo: "ninguem" }
  /** Servidor de uma sessão anterior do app ainda vivo neste PC, sem sair sozinho. */
  | { tipo: "orfao" }
  | { tipo: "outro"; nomePc: string; endereco: string }
  | { tipo: "eu"; endereco: string; parando?: boolean };

export type CampoComErro =
  "intervalo" | "quantos" | "quantosHistorico" | "distancias" | "historico";
/** `campo` diz qual campo da tela errou (a tela marca e leva o foco para ele, sem ler o texto da mensagem). */
export type Resultado = { ok: true } | { ok: false; mensagem: string; campo?: CampoComErro };

export interface ConfiguracoesDaTela {
  abrirComWindows: boolean;
  distanciaVisao: number;
  distanciaSimulacao: number;
  intervaloBackupMin: number;
  quantosGuardar: number;
  quantosGuardarHistorico: number;
  historicoLongoLigado: boolean;
  historicoLongoPasta: string;
}

export interface BackupDaTela {
  nome: string;
  criadoEm: string;
  tamanho: number;
  dePc: string;
}

export interface EstadoBackups {
  itens: BackupDaTela[];
  bloqueado: boolean;
  erro?: string;
  avisoHistorico?: string;
}

export interface PcDaTela {
  id: number;
  nome: string;
  dono: boolean;
}

export type EstadoGrupo = { dono: false } | { dono: true; pcs: PcDaTela[]; erro?: string };

export interface PonteSabre {
  versao(): Promise<string>;
  abrirComWindows: {
    ler(): Promise<boolean>;
    definir(ligado: boolean): Promise<boolean>;
  };
  configuracoes: {
    ler(): Promise<ConfiguracoesDaTela>;
    salvar(valor: ConfiguracoesDaTela): Promise<Resultado>;
    /** Abre o seletor de pasta do Windows; `undefined` se o amigo cancelar. */
    escolherPasta(): Promise<string | undefined>;
  };
  backups: {
    listar(): Promise<EstadoBackups>;
    restaurar(nome: string): Promise<Resultado>;
  };
  grupo: {
    estado(): Promise<EstadoGrupo>;
    tirar(id: number): Promise<Resultado>;
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
