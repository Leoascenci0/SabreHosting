import type { ServidorMinecraft } from "./processo.js";

const PRAZO_RESPOSTA_PADRAO_MS = 10_000;
const PRAZO_SALVAR_PADRAO_MS = 120_000;
const PRAZO_COPIA_PADRAO_MS = 600_000;
const MAX_SAY = 256;
/** Comandos aceitos por servidor (o que roda + os esperando); o excedente é recusado na hora. */
export const MAX_FILA = 16;

// Toda linha do servidor começa com "[hh:mm:ss] [Thread/NÍVEL]: ". A âncora no prefixo impede que o chat de um
// jogador ("<Nick> Saved the game", ou texto com "]: ") passe por resposta do servidor.
const PREFIXO = String.raw`^\[[^\]]*\] \[[^\]]*\]: `;
const SALVO_DESLIGADO = new RegExp(`${PREFIXO}Automatic saving is now disabled\\s*$`);
export const SALVOU = new RegExp(`${PREFIXO}Saved the game\\s*$`);
const LISTA = new RegExp(
  `${PREFIXO}There are (\\d+) of a max of (\\d+) players online:\\s*(.*?)\\s*$`,
);

const filas = new WeakMap<ServidorMinecraft, Promise<void>>();
const pendentes = new WeakMap<ServidorMinecraft, number>();

/**
 * Um comando por vez por servidor, na ordem das chamadas; a falha de um não trava os seguintes. Com `MAX_FILA`
 * comandos já pendentes, recusa o novo sem enfileirar.
 */
function naFila<T>(servidor: ServidorMinecraft, tarefa: () => Promise<T>): Promise<T> {
  const n = pendentes.get(servidor) ?? 0;
  if (n >= MAX_FILA) {
    return Promise.reject(
      new Error(
        `A fila de comandos do servidor está cheia (${MAX_FILA}); tente de novo em instantes.`,
      ),
    );
  }
  pendentes.set(servidor, n + 1);
  const atual = (filas.get(servidor) ?? Promise.resolve()).then(tarefa);
  const fim = () => void pendentes.set(servidor, (pendentes.get(servidor) ?? 1) - 1);
  filas.set(servidor, atual.then(fim, fim));
  return atual;
}

/** Manda `linha` e espera a linha de log que casa com `resposta`. O ouvinte entra ANTES da escrita. */
function enviarEEsperar(
  servidor: ServidorMinecraft,
  linha: string,
  resposta: RegExp,
  prazoMs: number,
  oQue: string,
): Promise<RegExpExecArray> {
  return new Promise((resolve, reject) => {
    const encerrar = () => {
      clearTimeout(timer);
      servidor.off("log", aoLogar);
      servidor.off("estado", aoMudar);
    };
    const aoLogar = ({ texto }: { texto: string }) => {
      const achou = resposta.exec(texto);
      if (!achou) return;
      encerrar();
      resolve(achou);
    };
    const aoMudar = () => {
      if (servidor.estado === "pronto") return;
      encerrar();
      reject(new Error(`O servidor deixou de responder enquanto ${oQue}.`));
    };
    const timer = setTimeout(() => {
      encerrar();
      reject(new Error(`O servidor não confirmou em ${Math.round(prazoMs / 1000)} s ao ${oQue}.`));
    }, prazoMs);
    servidor.on("log", aoLogar);
    servidor.on("estado", aoMudar);
    try {
      servidor.enviar(linha);
    } catch (erro) {
      encerrar();
      reject(erro);
    }
  });
}

/** Avisa no chat do jogo. Uma linha só, sem controle, de 1 a 256 caracteres. */
export function say(servidor: ServidorMinecraft, texto: string): Promise<void> {
  return naFila(servidor, async () => {
    if (/[\p{Cc}\p{Zl}\p{Zp}]/u.test(texto)) {
      throw new Error("O aviso não pode ter quebra de linha nem caractere de controle.");
    }
    if (texto.includes("\u00a7")) throw new Error("O aviso não pode ter código de cor (§).");
    if (texto.trim() === "") throw new Error("O aviso está vazio.");
    if (texto.length > MAX_SAY) throw new Error(`O aviso passa de ${MAX_SAY} caracteres.`);
    servidor.enviar(`say ${texto}`);
  });
}

export interface Jogadores {
  online: number;
  maximo: number;
  nomes: string[];
}

/** Quem está online agora. */
export function list(
  servidor: ServidorMinecraft,
  prazoMs = PRAZO_RESPOSTA_PADRAO_MS,
): Promise<Jogadores> {
  return naFila(servidor, async () => {
    const m = await enviarEEsperar(servidor, "list", LISTA, prazoMs, "listava os jogadores");
    return {
      online: Number(m[1]),
      maximo: Number(m[2]),
      nomes: (m[3] ?? "").split(", ").filter((n) => n !== ""),
    };
  });
}

/**
 * Regra de ouro 2: `copiar` só roda depois do "Automatic saving is now disabled" (`save-off`) e do "Saved the game"
 * (`save-all flush`), e o `save-on` volta sempre, mesmo se a cópia falhar ou o servidor não confirmar no prazo.
 * A cópia tem prazo próprio: ao estourar, o `AbortSignal` que ela recebe dispara, o `salvarSeguro` ESPERA a cópia
 * terminar (o `save-on` nunca liga com ela ainda lendo o mundo) e rejeita; o que ela fez fica por conta dela
 * descartar. Servidor que não está pronto é recusado sem mandar nada. Ocupa a fila inteira: duas cópias nunca se cruzam.
 */
export function salvarSeguro<T>(
  servidor: ServidorMinecraft,
  copiar: (sinal: AbortSignal) => Promise<T>,
  prazoMs = PRAZO_SALVAR_PADRAO_MS,
  prazoCopiaMs = PRAZO_COPIA_PADRAO_MS,
): Promise<T> {
  return naFila(servidor, async () => {
    try {
      await enviarEEsperar(servidor, "save-off", SALVO_DESLIGADO, prazoMs, "desligar o salvamento");
      await enviarEEsperar(servidor, "save-all flush", SALVOU, prazoMs, "salvar o mundo");
      return await copiarComPrazo(copiar, prazoCopiaMs);
    } finally {
      try {
        servidor.enviar("save-on");
      } catch {
        // Servidor já saiu: não há gravação a religar.
      }
    }
  });
}

async function copiarComPrazo<T>(
  copiar: (sinal: AbortSignal) => Promise<T>,
  prazoMs: number,
): Promise<T> {
  const controle = new AbortController();
  const timer = setTimeout(() => controle.abort(), prazoMs);
  try {
    const resultado = await copiar(controle.signal);
    if (controle.signal.aborted) throw new Error("prazo");
    return resultado;
  } catch (erro) {
    if (!controle.signal.aborted) throw erro;
    throw new Error("A cópia do mundo passou do prazo; nada foi guardado.");
  } finally {
    clearTimeout(timer);
  }
}
