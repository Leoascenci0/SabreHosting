import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import type { Page } from "playwright";

// Captura é só registro para o README: grava PNG apenas com SABRE_CAPTURAS=1 e nunca vira asserção.
const ligadas = process.env["SABRE_CAPTURAS"] === "1";

export async function registrarCaptura(pagina: Page, arquivo: string): Promise<void> {
  if (!ligadas) return;
  mkdirSync(dirname(arquivo), { recursive: true });
  await pagina.screenshot({ path: arquivo });
}
