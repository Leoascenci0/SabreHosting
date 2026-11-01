// O que a tela enxerga de `window.sabre` (preload.cts expõe exatamente isto).
export type MotivoSemCartorio = "rede" | "servidor" | "acesso";

/** O que o painel do Início mostra além do estado; campo ausente = sem dado, a tela não mostra a linha. */
export interface DadosPainel {
  /** Quando foi o último backup deste PC (ISO). */
  ultimoBackup?: string;
  /** Número da versão do mundo que o grupo usa hoje. */
  versaoMundo?: number;
  /** Quem está jogando agora; só quando o servidor roda neste PC. */
  jogadores?: string[];
  /** Algo mexendo no mundo deste PC agora (Hospedar fica fechado). A atualização vem em `atualizando`. */
  trabalho?: "restaurando" | "trocando-versao";
}

export type EstadoInicio =
  | { tipo: "carregando" }
  | { tipo: "sem-cartorio"; motivo: MotivoSemCartorio }
  /** `atualizando`: percentual (0–100) do mundo sendo atualizado neste PC; Hospedar fica fechado, Jogar não.
   *  `aviso`: por que a última atualização falhou (some quando uma nova rodada começa). */
  | ({ tipo: "ninguem"; atualizando?: number; aviso?: string } & DadosPainel)
  /** Servidor de uma sessão anterior do app ainda vivo neste PC, sem sair sozinho. */
  | { tipo: "orfao" }
  | ({
      tipo: "outro";
      nomePc: string;
      endereco: string;
      atualizando?: number;
      aviso?: string;
    } & DadosPainel)
  | ({ tipo: "eu"; endereco: string; parando?: boolean } & DadosPainel);

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

export type EstadoGrupo = ({ dono: false } | { dono: true; pcs: PcDaTela[]; erro?: string }) & {
  /** "Endereço do servidor" (só leitura, vindo do cartório); ausente quando o cartório não respondeu. */
  endereco?: string;
};

export type ResultadoConvite =
  | { ok: true; convite: string; venceEm: number; nomeNaRede: string }
  | { ok: false; mensagem: string };

export type EstadoVersao =
  { dono: false } | { dono: true; atual: string; versoes: string[]; erro?: string };

export interface ModDaTela {
  nome: string;
  versao: string;
  arquivo: string;
  url: string;
  sha512: string;
  lado: "cliente" | "servidor" | "ambos";
}
export interface EstadoMods {
  dono: boolean;
  mods: ModDaTela[];
  atualizando: boolean;
  aviso?: string;
  erro?: string;
}
export type ResultadoMods = { ok: true; aviso?: string } | { ok: false; mensagem: string };

export type OpcoesDaVersao =
  | { ok: true; neoforge: boolean; fabricForge: boolean; texto: string }
  | { ok: false; mensagem: string };

export type EstadoBoasVindas =
  /** `demonstracao`: o app está em "Explorar sem grupo" (dados de mentira; a tela mostra a faixa). */
  | { aberto: false; demonstracao?: true }
  | {
      aberto: true;
      passo: "convite" | "eula" | "pasta";
      grupo?: { nome: string; endereco?: string };
      pastaPadrao: string;
      /** O token guardado no PC não abre mais: a tela pede convite novo (texto: app-1.3b). */
      cofreCorrompido?: true;
    };
export type ConviteConferido =
  { ok: true; grupo: string; venceEm: number } | { ok: false; mensagem: string };
export type EntradaNoGrupo =
  | { ok: true; grupo: string; endereco?: string }
  /** `tentarDeNovo`: o convite foi gasto mas a conexão falhou; `entrar()` de novo reusa o mesmo (até 30 min). */
  | { ok: false; mensagem: string; tentarDeNovo?: true };

export type TrocaDePasta = { ok: true; anterior: string } | { ok: false; mensagem: string };

export interface PonteSabre {
  pasta: {
    estado(): Promise<{ pasta?: string }>;
    /** Revalidada no main; recusa com o servidor rodando. O mundo da pasta antiga NÃO é movido. */
    trocar(pasta: string): Promise<TrocaDePasta>;
  };
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
    /** "Explorar sem grupo": liga a demonstração (só no assistente de primeira vez); `false` = recusado. */
    explorar(): Promise<boolean>;
    sairDaDemonstracao(): Promise<void>;
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
    /** Só o dono. O texto do convite é credencial: mostrar e esquecer (nunca guardar). */
    criarConvite(nome: string, horas: number): Promise<ResultadoConvite>;
  };
  mods: {
    estado(): Promise<EstadoMods>;
    adicionar(mod: ModDaTela): Promise<ResultadoMods>;
    tirar(arquivo: string): Promise<ResultadoMods>;
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
