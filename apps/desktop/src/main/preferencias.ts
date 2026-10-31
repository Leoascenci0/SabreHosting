import { mkdirSync, readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface Preferencias {
  abrirComWindows: boolean;
}

const PADRAO: Preferencias = { abrirComWindows: false };
const ARQUIVO = "preferencias.json";

export function lerPreferencias(pasta: string): Preferencias {
  try {
    const bruto: unknown = JSON.parse(readFileSync(join(pasta, ARQUIVO), "utf8"));
    const valor = (bruto as Partial<Preferencias> | null)?.abrirComWindows;
    return typeof valor === "boolean" ? { abrirComWindows: valor } : { ...PADRAO };
  } catch {
    return { ...PADRAO };
  }
}

// Troca atômica (regra de ouro 3): escreve num temporário e só então renomeia.
export function salvarPreferencias(pasta: string, preferencias: Preferencias): void {
  mkdirSync(pasta, { recursive: true });
  const temporario = join(pasta, `${ARQUIVO}.tmp`);
  writeFileSync(temporario, JSON.stringify(preferencias, null, 2));
  renameSync(temporario, join(pasta, ARQUIVO));
}
