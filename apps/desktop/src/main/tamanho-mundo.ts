import { readdir, stat } from "node:fs/promises";
import { join } from "node:path";

export interface TetosTamanho {
  /** Máximo de entradas (arquivos e pastas) percorridas. Padrão: 200 000. */
  maxEntradas?: number;
  /** Máximo de tempo no percurso, em ms. Padrão: 5 000. */
  maxMs?: number;
  /** Relógio em ms; só os testes trocam. */
  agora?: () => number;
}

/**
 * Tamanho do mundo no disco (bytes): soma dos `stat` dos arquivos, sem ler o conteúdo (o mundo pode ter GBs) e sem
 * seguir atalhos. Só leitura. Sem pasta, pasta ilegível ou percurso que passa do teto de entradas ou de tempo =
 * `undefined` (a tela mostra "—": melhor não dizer o número do que travar ou dizer um número pela metade).
 */
export async function tamanhoDoMundo(
  pasta: string | undefined,
  tetos: TetosTamanho = {},
): Promise<number | undefined> {
  if (!pasta) return undefined;
  const { maxEntradas = 200_000, maxMs = 5_000, agora = () => performance.now() } = tetos;
  const limite = agora() + maxMs;
  try {
    let total = 0;
    let vistas = 0;
    const pendentes = [pasta];
    for (let p = pendentes.pop(); p !== undefined; p = pendentes.pop()) {
      for (const entrada of await readdir(p, { withFileTypes: true })) {
        if (++vistas > maxEntradas || agora() > limite) return undefined;
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
