import { realpathSync } from "node:fs";
import { readdir, rm, writeFile } from "node:fs/promises";
import { join, relative, isAbsolute } from "node:path";
import { abrirPacote } from "../backup/pacote.js";
import { hashDoArquivo } from "../integridade/hash.js";

/**
 * Vitrine: a única coisa que este PC serve aos outros. É uma cópia aberta (e conferida por hash) de um pacote
 * FECHADO de backup, numa pasta só do app; o mundo vivo nunca é lido por quem serve (regra de ouro 2). Cada arquivo é
 * achado pelo SHA-256 (nunca por caminho do cliente); o `manifesto.json` entra pelo hash que o cartório registra.
 * Publicar abre numa pasta nova e só então troca o índice (regra 3); falha deixa a vitrine anterior como estava.
 */
const PASTA_DA_VITRINE = /^v-\d+-\d+$/;

export function criarVitrine(pasta: string) {
  let atual: { dir: string; indice: Map<string, string> } | undefined;
  let emCurso = false;
  let contador = 0;
  let limpou = false;

  return {
    /** Acha o arquivo pelo hash; `undefined` se não está na vitrine. */
    arquivos(sha256: string): { caminho: string } | undefined {
      const caminho = atual?.indice.get(sha256);
      if (atual === undefined || caminho === undefined) return undefined;
      // Pasta intermediária trocada por link simbólico: o caminho real tem de continuar dentro da vitrine.
      try {
        const fora = relative(realpathSync(atual.dir), realpathSync(caminho));
        if (fora === "" || fora.startsWith("..") || isAbsolute(fora)) return undefined;
      } catch {
        return undefined;
      }
      return { caminho };
    },

    /** Abre o pacote na vitrine. `false`: já havia uma publicação em curso (S-06), esta foi pulada. */
    async publicar(pacote: string, sha256: string): Promise<boolean> {
      if (emCurso) return false;
      emCurso = true; // antes de qualquer await
      try {
        if (!limpou) {
          limpou = true; // sobras de sessão anterior: só as pastas com o nosso nome (S-07)
          const nomes = await readdir(pasta).catch(() => [] as string[]);
          for (const n of nomes.filter((n) => PASTA_DA_VITRINE.test(n))) {
            await rm(join(pasta, n), { recursive: true, force: true });
          }
        }
        const dir = join(pasta, `v-${Date.now()}-${++contador}`);
        const manifesto = await abrirPacote(pacote, sha256, dir); // apaga a pasta se algo falhar
        const indice = new Map<string, string>();
        for (const a of manifesto.arquivos)
          indice.set(a.sha256, join(dir, ...a.caminho.split("/")));
        const arquivoManifesto = join(dir, "manifesto.json");
        await writeFile(arquivoManifesto, JSON.stringify(manifesto));
        indice.set(await hashDoArquivo(arquivoManifesto), arquivoManifesto);
        const velha = atual;
        atual = { dir, indice };
        if (velha) await rm(velha.dir, { recursive: true, force: true }).catch(() => undefined);
        return true;
      } finally {
        emCurso = false;
      }
    },

    /** Para de servir e apaga a cópia aberta. */
    async fechar(): Promise<void> {
      const velha = atual;
      atual = undefined;
      if (velha) await rm(velha.dir, { recursive: true, force: true }).catch(() => undefined);
    },
  };
}

export type Vitrine = ReturnType<typeof criarVitrine>;
