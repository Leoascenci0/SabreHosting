import { existsSync } from "node:fs";
import { join } from "node:path";
import { criarCliente } from "@sabrehosting/nucleo/cartorio/cliente";
import { restaurarBackup } from "@sabrehosting/nucleo/backup/restaurar";
import { criarPacote } from "@sabrehosting/nucleo/backup/pacote";
import { nomeDoBackup } from "@sabrehosting/nucleo/backup/agendador";
import { listarBackups } from "@sabrehosting/nucleo/backup/listar";
import { Renovador, type OpcoesRenovador } from "@sabrehosting/nucleo/cartorio/renovador";
import { hashDoArquivo } from "@sabrehosting/nucleo/integridade/hash";
import type { DepsBackups } from "./backups.js";

export interface OpcoesDepsBackups {
  /** Configurações › Backups › Pasta (até a tela de primeira vez, app-1.3: `SABRE_PASTA_BACKUPS`). */
  pastaBackups: string | undefined;
  /** Pasta do mundo do servidor (até app-1.3: `SABRE_PASTA_MUNDO`). */
  pastaDoMundo: string | undefined;
  /** Relê o mundo na hora de cada operação (o `level-name` pode mudar com o app aberto); vale mais que `pastaDoMundo` (sem resposta, fica o `pastaDoMundo`). */
  mundoAgora?(): Promise<string | undefined>;
  /** Pasta do servidor (até app-1.3: `SABRE_PASTA_SERVIDOR`); o mundo tem de estar direto dentro dela. */
  pastaDoServidor?: string | undefined;
  cliente: OpcoesRenovador["cliente"] & {
    estadoTrava(): Promise<{ epoca: number }>;
  };
  servidorRodando: () => boolean;
  /** Servidor de sessão anterior ainda vivo na pasta? (Pode não saber: erro conta como vivo.) */
  servidorOrfao?: () => Promise<boolean>;
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
      if (o.servidorRodando() || (await o.servidorOrfao?.().catch(() => true))) {
        throw new Error(
          "O servidor deste PC ainda está no ar. Pare o servidor (e feche o Java, se sobrou) antes de restaurar.",
        );
      }
      const renovador = new Renovador({ cliente: o.cliente, aoPerder: () => undefined });
      // Só solta a vez que ESTA restauração pegou: se o `pegar` falhar, nada foi pego e nada é solto.
      await renovador.pegar().catch((erro: unknown) => {
        throw new Error(
          "Não consegui pegar a vez de hospedar para restaurar. Confira a conexão com o grupo ou espere o outro PC terminar.",
          { cause: erro },
        );
      });
      try {
        const { epoca } = await o.cliente.estadoTrava();
        await restaurarBackup({
          pacote: alvo.caminho,
          sha256: await hashDoArquivo(alvo.caminho),
          pastaDoMundo,
          pastaBackups,
          ...(o.pastaDoServidor ? { pastaDoServidor: o.pastaDoServidor } : {}),
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

/**
 * Backup avulso com o servidor PARADO (antes de trocar a versão do Minecraft). Regra 2: com o servidor rodando (ou
 * sobra dele) recusa, porque aqui não há `save-off`; o pacote é fechado e conferido pelo núcleo. Regra 4: nunca
 * escreve por cima de backup existente e nunca apaga. `aoBom` roda a rotação normal depois.
 */
export async function backupParado(
  o: OpcoesDepsBackups & {
    agora?: () => Date;
    aoBom?(feito: { caminho: string; sha256: string }): Promise<void>;
  },
): Promise<void> {
  const { pastaBackups } = o;
  const pastaDoMundo = (await o.mundoAgora?.()) ?? o.pastaDoMundo;
  if (!pastaBackups || !pastaDoMundo) throw new Error(SEM_PASTA);
  if (o.servidorRodando() || (await o.servidorOrfao?.().catch(() => true))) {
    throw new Error(
      "O servidor deste PC ainda está no ar. Pare o servidor antes de trocar a versão.",
    );
  }
  const lista = await listarBackups(pastaBackups);
  const versao = Math.max(0, ...lista.map((b) => b.versao));
  const { epoca } = await o.cliente.estadoTrava();
  const destino = join(pastaBackups, nomeDoBackup((o.agora ?? (() => new Date()))(), versao));
  if (existsSync(destino)) throw new Error("Já existe um backup com esse nome; tente de novo.");
  const feito = await criarPacote(pastaDoMundo, destino, { versao, epoca });
  await o.aoBom?.({ caminho: feito.caminho, sha256: feito.sha256 }).catch(() => undefined);
}

/** Cartório, pastas e token vêm do ambiente até a tela de primeira vez (app-1.3); ver .env.exemplo. */
export function depsBackupsReais(
  env: NodeJS.ProcessEnv,
  servidorRodando: () => boolean,
  servidorOrfao?: () => Promise<boolean>,
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
    pastaDoServidor: env["SABRE_PASTA_SERVIDOR"],
    cliente: cliente ?? {
      pegar: semGrupo,
      renovar: semGrupo,
      soltar: semGrupo,
      estadoTrava: semGrupo,
    },
    servidorRodando,
    ...(servidorOrfao ? { servidorOrfao } : {}),
  });
}
