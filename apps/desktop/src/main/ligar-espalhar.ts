import { tmpdir } from "node:os";
import { join } from "node:path";
import { listarBackups } from "@sabrehosting/nucleo/backup/listar";
import { clienteDoAmbiente } from "./deps-reais.js";
import { criarEspalhador, criarGatilhoEspalhar } from "./espalhar-versao.js";

export const ESPALHAR_A_CADA_MS = 10 * 60_000;

export interface OpcoesLigarEspalhar {
  env: NodeJS.ProcessEnv;
  inicio: { ativo(): boolean; temOrfao(): Promise<boolean> };
  aoAvisar: (texto: string) => void;
  /** Só para teste: relógio e rede trocados. */
  agendar?: (tarefa: () => void, ms: number) => void;
  fetchFn?: typeof fetch;
}

/**
 * Atualização do mundo em segundo plano (syncmel-1.9a): no arranque, a cada 10 min e depois de cada backup bom
 * (quem chama usa o disparo devolvido) pergunta ao cartório se há versão mais nova e puxa de quem já tem. Um só
 * relógio; uma rodada por vez (o espalhador recusa a segunda); nunca espera a tela. Sem grupo ou sem pastas: devolve
 * `undefined` (o amigo ainda não configurou). Hospedando, o espalhador recusa sozinho (o mundo vivo não se toca).
 */
export function ligarEspalhar(o: OpcoesLigarEspalhar): (() => Promise<void>) | undefined {
  const { SABRE_CARTORIO_TOKEN: token, SABRE_PASTA_BACKUPS: pastaBackups } = o.env;
  if (!token || !pastaBackups) return undefined;
  let exigir: ReturnType<typeof clienteDoAmbiente>;
  try {
    exigir = clienteDoAmbiente(o.env, o.fetchFn);
    exigir();
  } catch {
    return undefined;
  }
  const cliente = exigir();
  const versaoLocal = async () =>
    Math.max(0, ...(await listarBackups(pastaBackups)).map((b) => b.versao));
  const rodar = criarGatilhoEspalhar({
    cliente,
    versaoLocal,
    espalhar: criarEspalhador({
      pastaDoMundo: o.env["SABRE_PASTA_MUNDO"],
      pastaDoServidor: o.env["SABRE_PASTA_SERVIDOR"],
      pastaTemporaria: join(tmpdir(), "sabre-manifesto"),
      token,
      cliente,
      servidorRodando: () => o.inicio.ativo(),
      servidorOrfao: () => o.inicio.temOrfao(),
      versaoLocal,
    }),
    aoAvisar: (texto) => o.aoAvisar(`[atualizar] ${texto}`),
  });
  void rodar();
  (o.agendar ?? ((f, ms) => void setInterval(f, ms).unref()))(
    () => void rodar(),
    ESPALHAR_A_CADA_MS,
  );
  return rodar;
}
