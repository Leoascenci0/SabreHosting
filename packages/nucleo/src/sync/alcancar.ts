/**
 * Quem voltou depois de muito tempo (sync-2.2): pergunta ao cartório a versão mais nova e leva este PC até ela, de PC
 * online (arquivos que mudaram, `espalhar`) ou, sem PC ou se ele falhar, do pacote fechado da nuvem. Repete até não
 * haver versão maior (o grupo pode ter avançado enquanto baixava), com teto de passos.
 *
 * Orquestrador fino: trava de atualização, hash, troca atômica e "versão manda" são do `espalhar`/`aplicarDelta`; aqui
 * não há trava nem relógio próprios. Falha no meio deixa o mundo como estava (o `espalhar` garante).
 */
import type { ClienteCartorio } from "../cartorio/cliente.js";
import {
  fontesDeCopias,
  type Espalhado,
  type Fonte,
  type PacoteDaNuvem,
  type VersaoNova,
} from "./espalhar.js";

/** Teto de passos por chamada: o grupo não avança sem parar; o resto fica para a próxima rodada. */
export const MAX_PASSOS = 5;

export interface OpcoesAlcancar {
  cliente: Pick<ClienteCartorio, "maisNova" | "quemTem" | "eu" | "baixarPacote">;
  /** `espalhar` já ligado ao PC (pastas, trava, banda). Recebe a nuvem só quando não há PC para puxar. */
  espalhar: (
    versao: VersaoNova,
    fontes: readonly Fonte[],
    nuvem?: PacoteDaNuvem,
    aoProgresso?: (feitos: number, total: number) => void,
  ) => Promise<Espalhado>;
  /** Versão que este PC tem ao começar. */
  versaoLocal: () => Promise<number>;
  /** Percentual 0–100 da atualização em curso; chamado com `undefined` quando acaba (com ou sem erro). */
  aoProgresso?: (percentual: number | undefined) => void;
}

export interface Alcancado {
  /** Versão que este PC tem ao terminar. */
  versao: number;
  passos: number;
}

export async function alcancar(o: OpcoesAlcancar): Promise<Alcancado> {
  let local = await o.versaoLocal();
  let passos = 0;
  try {
    while (passos < MAX_PASSOS) {
      const nova = await o.cliente.maisNova();
      if (!nova || nova.numero <= local) break;
      const versao = { numero: nova.numero, manifestoSha256: nova.manifestoSha256 };
      const [eu, copias] = await Promise.all([o.cliente.eu(), o.cliente.quemTem(nova.numero)]);
      const fontes = fontesDeCopias(copias, eu.id);
      const progresso = (feitos: number, total: number) =>
        o.aoProgresso?.(total === 0 ? 100 : Math.floor((feitos / total) * 100));
      o.aoProgresso?.(0);
      const daNuvem: PacoteDaNuvem = {
        baixar: (destino) => o.cliente.baixarPacote(nova.numero, destino, TETO_PACOTE),
      };
      try {
        if (fontes.length === 0) throw new SemPc();
        await o.espalhar(versao, fontes, undefined, progresso);
      } catch (erro) {
        // Nuvem só como último recurso e só se ela guarda essa versão; senão o erro dos PCs é o que o amigo vê.
        if (!copias.nuvem) {
          throw erro instanceof SemPc
            ? new Error(
                "Nenhum PC nem a nuvem têm a versão nova do mundo agora; tento de novo depois.",
              )
            : erro;
        }
        await o.espalhar(versao, [], daNuvem, progresso);
      }
      local = nova.numero;
      passos++;
    }
  } finally {
    o.aoProgresso?.(undefined);
  }
  return { versao: local, passos };
}

class SemPc extends Error {}

/** Teto de segurança do download do pacote (o cartório não informa o tamanho antes; o mundo de amigos cabe folgado). */
const TETO_PACOTE = 16 * 1024 ** 3;
