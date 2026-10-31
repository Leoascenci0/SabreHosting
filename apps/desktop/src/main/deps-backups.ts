import { criarCliente } from "@sabrehosting/nucleo/cartorio/cliente";
import { restaurarBackup } from "@sabrehosting/nucleo/backup/restaurar";
import { listarBackups } from "@sabrehosting/nucleo/backup/listar";
import { Renovador, type OpcoesRenovador } from "@sabrehosting/nucleo/cartorio/renovador";
import { hashDoArquivo } from "@sabrehosting/nucleo/integridade/hash";
import type { DepsBackups } from "./backups.js";

export interface OpcoesDepsBackups {
  /** Configurações › Backups › Pasta (até a tela de primeira vez, app-1.3: `SABRE_PASTA_BACKUPS`). */
  pastaBackups: string | undefined;
  /** Pasta do mundo do servidor (até app-1.3: `SABRE_PASTA_MUNDO`). */
  pastaDoMundo: string | undefined;
  cliente: OpcoesRenovador["cliente"] & {
    estadoTrava(): Promise<{ epoca: number }>;
  };
  servidorRodando: () => boolean;
}

const SEM_PASTA = "Este PC ainda não tem a pasta de backups configurada.";

/**
 * Liga a tela ao núcleo. Restaurar é o ÚNICO caminho que troca o mundo: pega a trava (e a renova enquanto copia),
 * chama `restaurarBackup` (servidor parado, hash do pacote, backup do estado atual, troca atômica) e solta a trava.
 */
export function depsBackups(o: OpcoesDepsBackups): DepsBackups {
  const listar = async () => {
    if (!o.pastaBackups) throw new Error(SEM_PASTA);
    return listarBackups(o.pastaBackups);
  };
  return {
    listar: async () =>
      (await listar()).map(({ nome, criadoEm, tamanho, versao }) => ({
        nome,
        criadoEm,
        tamanho,
        versao,
      })),
    servidorRodando: o.servidorRodando,
    restaurar: async (nome) => {
      const { pastaBackups, pastaDoMundo } = o;
      if (!pastaBackups || !pastaDoMundo) throw new Error(SEM_PASTA);
      const lista = await listarBackups(pastaBackups);
      const alvo = lista.find((b) => b.nome === nome);
      if (!alvo) throw new Error("Esse backup não está mais na lista.");
      const renovador = new Renovador({ cliente: o.cliente, aoPerder: () => undefined });
      await renovador.pegar();
      try {
        const { epoca } = await o.cliente.estadoTrava();
        await restaurarBackup({
          pacote: alvo.caminho,
          sha256: await hashDoArquivo(alvo.caminho),
          pastaDoMundo,
          pastaBackups,
          temTrava: () => renovador.temTrava(),
          servidorParado: () => !o.servidorRodando(),
          versao: Math.max(0, ...lista.map((b) => b.versao)),
          epoca,
        });
      } finally {
        await renovador.soltar().catch(() => undefined);
      }
    },
  };
}

/** Cartório, pastas e token vêm do ambiente até a tela de primeira vez (app-1.3); ver .env.exemplo. */
export function depsBackupsReais(
  env: NodeJS.ProcessEnv,
  servidorRodando: () => boolean,
): DepsBackups {
  const { SABRE_CARTORIO_URL: url, SABRE_CARTORIO_TOKEN: token } = env;
  const semGrupo = (): never => {
    throw new Error("Este PC ainda não entrou no grupo.");
  };
  const cliente =
    url && token
      ? criarCliente({ url, cofre: { guardar: async () => {}, ler: async () => token } })
      : undefined;
  return depsBackups({
    pastaBackups: env["SABRE_PASTA_BACKUPS"],
    pastaDoMundo: env["SABRE_PASTA_MUNDO"],
    cliente: cliente ?? {
      pegar: semGrupo,
      renovar: semGrupo,
      soltar: semGrupo,
      estadoTrava: semGrupo,
    },
    servidorRodando,
  });
}
