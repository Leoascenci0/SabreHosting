/**
 * Destino "pasta sincronizada" (drive-1.1a): copia o pacote FECHADO para uma pasta que um serviço (Drive, OneDrive,
 * Dropbox) sincroniza. Escreve em `<nome>.parcial`, confere o hash e só então renomeia (regra de ouro 3).
 *
 * NÃO apaga nada: só o próprio `.parcial` desta cópia. A pasta vem da configuração, então é entrada não confiável
 * (S-07): precisa ser absoluta, existir, ser pasta e não ser a pasta dos backups locais. Rotação é outro item.
 */
import { createReadStream, createWriteStream } from "node:fs";
import { rename, rm, stat } from "node:fs/promises";
import { basename, isAbsolute, join, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { hashDoArquivo } from "../../integridade/hash.js";

const prefixo = "Histórico longo numa pasta:";

async function existe(caminho: string): Promise<boolean> {
  return stat(caminho).then(
    () => true,
    () => false,
  );
}

/** Devolve o caminho final da cópia. Qualquer falha lança erro em pt-BR e deixa o backup local como estava. */
export async function copiarParaPasta(
  pacote: string,
  sha256: string,
  pasta: string,
  pastaBackupsLocal: string,
): Promise<string> {
  if (pasta === "" || !isAbsolute(pasta)) {
    throw new Error(`${prefixo} escolha uma pasta completa (ex.: a pasta do Drive no seu PC).`);
  }
  if (resolve(pasta) === resolve(pastaBackupsLocal)) {
    throw new Error(`${prefixo} a pasta não pode ser a mesma pasta dos backups deste PC.`);
  }
  const info = await stat(pasta).catch(() => undefined);
  if (info === undefined || !info.isDirectory()) {
    throw new Error(
      `${prefixo} a pasta não está disponível agora. O backup deste PC foi guardado normalmente.`,
    );
  }
  const nome = basename(pacote);
  const final = join(pasta, nome);
  const parcial = `${final}.parcial`;
  if (await existe(final)) {
    throw new Error(`${prefixo} já existe "${nome}" na pasta; não escrevi por cima.`);
  }
  try {
    await pipeline(createReadStream(pacote), createWriteStream(parcial, { flags: "wx" }));
    if ((await hashDoArquivo(parcial)) !== sha256) {
      throw new Error(`${prefixo} a cópia não bateu com o original (hash). Descartei a cópia.`);
    }
    await rename(parcial, final);
    return final;
  } catch (erro) {
    await rm(parcial, { force: true });
    if (erro instanceof Error && erro.message.startsWith(prefixo)) throw erro;
    throw new Error(
      `${prefixo} não consegui copiar (a pasta pode ter sumido no meio). O backup deste PC está intacto.`,
      { cause: erro },
    );
  }
}
