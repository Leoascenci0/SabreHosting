import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

/**
 * Tamanho do mundo no disco (bytes): soma dos `stat` dos arquivos, sem ler o conteúdo (o mundo pode ter GBs) e sem
 * seguir atalhos. Só leitura. Sem pasta ou pasta ilegível = `undefined` (a tela mostra "—").
 */
export async function tamanhoDoMundo(pasta: string | undefined): Promise<number | undefined> {
  if (!pasta) return undefined;
  try {
    let total = 0;
    const pendentes = [pasta];
    for (let p = pendentes.pop(); p !== undefined; p = pendentes.pop()) {
      for (const entrada of await readdir(p, { withFileTypes: true })) {
        const caminho = join(p, entrada.name);
        if (entrada.isDirectory()) pendentes.push(caminho);
        else if (entrada.isFile()) total += (await stat(caminho)).size;
      }
    }
    return total;
  } catch {
    return undefined;
  }
}
