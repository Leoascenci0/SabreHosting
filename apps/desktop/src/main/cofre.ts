import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type { Cofre } from "@sabrehosting/nucleo/cartorio/cofre";

/** Arquivo do token na pasta de dados do app (assistente e arranque usam o mesmo). */
export const ARQUIVO_COFRE = "cofre-token.bin";

/** O pedaço do `safeStorage` do Electron que usamos (injetável: o teste passa um falso). */
export interface CofreDoSistema {
  isEncryptionAvailable(): boolean;
  encryptString(texto: string): Buffer;
  decryptString(cifrado: Buffer): string;
}

/** O que o cofre sabe dizer do token: `ausente` = nunca guardado (primeira vez); `corrompido` = existe e não decifra. */
export type EstadoDoCofre =
  | { tipo: "ok"; token: string }
  | { tipo: "ausente" }
  | { tipo: "corrompido" }
  | { tipo: "indisponivel" };

/** `Cofre` do núcleo (`ler` continua `string | undefined`) mais o estado, para o assistente pedir convite novo. */
export interface CofreSeguro extends Cofre {
  estado(): Promise<EstadoDoCofre>;
}

const SEM_COFRE =
  "Este computador não tem um cofre seguro disponível (o Windows não liberou a proteção das senhas). Por segurança, o SabreHosting não guarda o acesso sem ele.";
const FALHA_COFRE =
  "Não foi possível guardar o acesso no cofre seguro do Windows. Nada foi alterado.";

/**
 * Cofre real do token do PC (`safeStorage`: no Windows, a proteção da conta do usuário). Só o texto cifrado vai para o
 * disco, por troca atômica (temporário + renomear). Sem cofre disponível, recusa guardar e explica. As mensagens nunca
 * repetem o token.
 */
export function criarCofreSeguro(sistema: CofreDoSistema, arquivo: string): CofreSeguro {
  const estado = async (): Promise<EstadoDoCofre> => {
    if (!sistema.isEncryptionAvailable()) return { tipo: "indisponivel" };
    let cifrado: Buffer;
    try {
      cifrado = readFileSync(arquivo);
    } catch (e) {
      return (e as NodeJS.ErrnoException).code === "ENOENT"
        ? { tipo: "ausente" }
        : { tipo: "corrompido" };
    }
    try {
      return { tipo: "ok", token: sistema.decryptString(cifrado) };
    } catch {
      return { tipo: "corrompido" }; // a mensagem do erro pode ter segredo: nunca sai daqui
    }
  };
  return {
    estado,
    async guardar(token) {
      if (!/^[\x21-\x7e]{1,512}$/.test(token)) throw new Error("O acesso recebido não é válido.");
      if (!sistema.isEncryptionAvailable()) throw new Error(SEM_COFRE);
      const temporario = `${arquivo}.novo`;
      try {
        const cifrado = sistema.encryptString(token);
        mkdirSync(dirname(arquivo), { recursive: true });
        writeFileSync(temporario, cifrado, { mode: 0o600 });
        renameSync(temporario, arquivo);
      } catch {
        rmSync(temporario, { force: true });
        throw new Error(FALHA_COFRE);
      }
    },
    async ler() {
      const e = await estado();
      return e.tipo === "ok" ? e.token : undefined;
    },
  };
}
