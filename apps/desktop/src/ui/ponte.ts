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
  "intervalo" | "quantos" | "quantosHistorico" | "distancias" | "historico" | "banda";
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
  limiteBandaMBs: number;
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

/** O que a tela mostra do .zip escolhido (o caminho fica no main). */
export type EscolhaDoZip =
  | {
      ok: true;
      nome: string;
      arquivos: number;
      versaoMinecraft: string;
      plugins: boolean;
      mods: boolean;
      /** Versão mais nova do grupo no cartório; `null` = o grupo ainda não tem mundo. */
      versaoNoGrupo: number | null;
      dono: boolean;
    }
  | { ok: false; cancelado: true }
  | { ok: false; mensagem: string };

export type ResultadoImportacao = { ok: true; versao: number } | { ok: false; mensagem: string };

export interface PcDaTela {
  id: number;
  nome: string;
  dono: boolean;
}

export type EstadoGrupo = { dono: false } | { dono: true; pcs: PcDaTela[]; erro?: string };

export type EstadoVersao =
  { dono: false } | { dono: true; atual: string; versoes: string[]; erro?: string };

export type OpcoesDaVersao =
  | { ok: true; neoforge: boolean; fabricForge: boolean; texto: string }
  | { ok: false; mensagem: string };

export type EstadoBoasVindas =
  | { aberto: false }
  | {
      aberto: true;
      passo: "convite" | "eula" | "pasta";
      grupo?: { nome: string; endereco?: string };
      pastaPadrao: string;
    };
export type ConviteConferido =
  { ok: true; grupo: string; venceEm: number } | { ok: false; mensagem: string };
export type EntradaNoGrupo =
  { ok: true; grupo: string; endereco?: string } | { ok: false; mensagem: string };

export interface PonteSabre {
  boasVindas: {
    estado(): Promise<EstadoBoasVindas>;
    conferirConvite(texto: string): Promise<ConviteConferido>;
    entrar(): Promise<EntradaNoGrupo>;
    eula(): Promise<{ texto: string; link: string }>;
    /** Abre o contrato da Mojang no navegador; o endereço é fixo no main. */
    abrirEula(): Promise<void>;
    aceitarEula(aceito: boolean): Promise<Resultado>;
    escolherPasta(): Promise<string | undefined>;
    concluir(pasta: string): Promise<Resultado>;
  };
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
  importar: {
    /** Abre o seletor de .zip do Windows e confere o arquivo (só lê). */
    escolherZip(): Promise<EscolhaDoZip>;
    /** Importa o .zip escolhido; só `true` vale como confirmação. */
    executar(confirmado: boolean): Promise<ResultadoImportacao>;
  };
  grupo: {
    estado(): Promise<EstadoGrupo>;
    tirar(id: number): Promise<Resultado>;
  };
  versoes: {
    estado(): Promise<EstadoVersao>;
    /** Só ao selecionar uma versão: cada consulta vai à internet. */
    opcoes(versao: string): Promise<OpcoesDaVersao>;
    gravar(versao: string): Promise<Resultado>;
  };
  inicio: {
    estado(): Promise<EstadoInicio>;
    jogar(): Promise<{ copiado: boolean; endereco: string; aberto?: boolean; aviso?: string }>;
    hospedar(): Promise<Resultado>;
    parar(): Promise<Resultado>;
    /** Avisa quando o estado mudou por conta própria (servidor caiu, vez de hospedar perdida). */
    aoProgresso(cb: () => void): () => void;
  };
}
