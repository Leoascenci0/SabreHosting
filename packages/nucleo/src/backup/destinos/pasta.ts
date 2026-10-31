/**
 * Destino "pasta sincronizada" (drive-1.1a): copia o pacote FECHADO para uma pasta que um serviço (Drive, OneDrive,
 * Dropbox) sincroniza. Escreve em `<nome>.parcial`, confere o hash e só então renomeia (regra de ouro 3).
 *
 * NÃO apaga nada: só o próprio `.parcial` desta cópia. A pasta vem da configuração, então é entrada não confiável
 * (S-07): precisa ser absoluta, existir, ser pasta e não ser a pasta dos backups locais. Rotação é outro item.
 */
import { createReadStream, createWriteStream } from "node:fs";
import { realpath, rename, rm, stat } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";
import { pipeline } from "node:stream/promises";
import { hashDoArquivo } from "../../integridade/hash.js";

const prefixo = "Histórico longo numa pasta:";
/** Texto mostrado na tela do app quando a pasta some (antes ou durante a cópia). */
export const PASTA_NAO_ENCONTRADA =
  "A pasta do histórico não foi encontrada; o backup deste PC está salvo.";

async function existe(caminho: string): Promise<boolean> {
  return stat(caminho).then(
    () => true,
    () => false,
  );
}

/** Caminho real (segue atalhos/links); se não der, o caminho resolvido. */
const real = (c: string): Promise<string> => realpath(c).catch(() => resolve(c));

/** Um dentro do outro (ou o mesmo): `relative` não sobe nem sai da unidade. */
function sobrepoe(a: string, b: string): boolean {
  const dentro = (de: string, para: string): boolean => {
    const r = relative(de, para);
    return r === "" || (!r.startsWith("..") && !isAbsolute(r));
  };
  return dentro(a, b) || dentro(b, a);
}

/** Devolve o caminho final da cópia. Qualquer falha lança erro em pt-BR e deixa o backup local como estava. */
export async function copiarParaPasta(
  pacote: string,
  sha256: string,
  pasta: string,
  /** Pasta dos backups locais e pasta do mundo: o destino não pode ser igual, estar dentro nem conter nenhuma delas. */
  protegidas: string | readonly string[],
): Promise<string> {
  if (pasta === "" || !isAbsolute(pasta)) {
    throw new Error(`${prefixo} escolha uma pasta completa (ex.: a pasta do Drive no seu PC).`);
  }
  const info = await stat(pasta).catch(() => undefined);
  if (info === undefined || !info.isDirectory()) {
    throw new Error(PASTA_NAO_ENCONTRADA);
  }
  const destinoReal = await real(pasta);
  for (const protegida of [protegidas].flat().filter((c) => c !== "")) {
    if (sobrepoe(destinoReal, await real(protegida))) {
      throw new Error(
        `${prefixo} a pasta não pode ser a dos backups nem a do mundo deste PC, nem ficar dentro delas ou conter elas. Escolha outra pasta (ex.: a do Drive).`,
      );
    }
  }
  const nome = basename(pacote);
  const final = join(pasta, nome);
  const parcial = `${final}.parcial`;
  if (await existe(final)) {
    throw new Error(`${prefixo} já existe "${nome}" na pasta; não escrevi por cima.`);
  }
  // Um `.parcial` que já existe não é nosso (cópia anterior ainda sincronizando, ou outro PC): não mexe nele.
  if (await existe(parcial)) {
    throw new Error(
      `${prefixo} já há uma cópia incompleta ("${nome}.parcial") na pasta, talvez ainda sincronizando. Não mexi nela; espere o serviço terminar e o próximo backup tenta de novo.`,
    );
  }
  try {
    await pipeline(createReadStream(pacote), createWriteStream(parcial, { flags: "wx" }));
    if ((await hashDoArquivo(parcial)) !== sha256) {
      throw new Error(`${prefixo} a cópia não bateu com o original (hash). Descartei a cópia.`);
    }
    // Confere de novo logo antes do rename: nunca troca em silêncio um arquivo que apareceu durante a cópia.
    if (await existe(final)) {
      throw new Error(`${prefixo} já existe "${nome}" na pasta; não escrevi por cima.`);
    }
    await rename(parcial, final);
    return final;
  } catch (erro) {
    await rm(parcial, { force: true });
    if (erro instanceof Error && erro.message.startsWith(prefixo)) throw erro;
    const sumiu = ["ENOENT", "ENOTDIR", "ENXIO", "EIO"].includes(
      (erro as NodeJS.ErrnoException).code ?? "",
    );
    throw new Error(
      sumiu
        ? PASTA_NAO_ENCONTRADA
        : `${prefixo} não consegui copiar agora. O backup deste PC está salvo.`,
      { cause: erro },
    );
  }
}
