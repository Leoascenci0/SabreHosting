import { type Banco, ehDono, emTransacao } from "./banco.js";
import { estadoTrava } from "./trava.js";

/**
 * Configuração do grupo (hostmel-3.1b): o que todos os PCs usam igual. Hoje, a versão do Minecraft e o sha1 do jar
 * oficial dela. Só o dono grava, e só com o servidor parado: trocar a versão com o mundo em uso estragaria o mundo.
 */
export interface ConfigGrupo {
  versaoMinecraft: string;
  sha1Manifesto: string | null;
  atualizadoEm: number;
}
export type DadosConfig = Pick<ConfigGrupo, "versaoMinecraft"> & { sha1Manifesto: string };
export type MotivoConfig = "nao_e_dono" | "invalida" | "servidor_no_ar" | "atualizando";
export type ResultadoConfig = { ok: true } | { ok: false; motivo: MotivoConfig };

/** Mesma forma que o núcleo aceita (`1.21`, `1.21.1`); a conferência é nossa porque o corpo vem da rede. */
const ID_VERSAO = /^1\.\d{1,2}(\.\d{1,2})?$/;
const SHA1 = /^[0-9a-f]{40}$/;

export function lerConfig(banco: Banco): ConfigGrupo {
  const l = banco
    .prepare(
      "SELECT versao_minecraft, sha1_manifesto, atualizado_em FROM config_grupo WHERE id = 1",
    )
    .get() as { versao_minecraft: string; sha1_manifesto: string | null; atualizado_em: number };
  return {
    versaoMinecraft: l.versao_minecraft,
    sha1Manifesto: l.sha1_manifesto,
    atualizadoEm: l.atualizado_em,
  };
}

/**
 * Dono, servidor parado e ninguém atualizando: tudo conferido na MESMA transação da gravação (`BEGIN IMMEDIATE`),
 * para a trava de host ou a de atualização não passarem entre o olhar e o gravar. "Servidor no ar" usa o `estadoTrava`
 * (vencida = parado); "atualizando" é só `expira_em > agora` (prazo zerado ou vencido não conta).
 */
export function gravarConfig(
  banco: Banco,
  pcId: number,
  dados: DadosConfig,
  agora: number,
): ResultadoConfig {
  return emTransacao(banco, () => {
    if (!ehDono(banco, pcId)) return { ok: false, motivo: "nao_e_dono" };
    if (!ID_VERSAO.test(dados.versaoMinecraft) || !SHA1.test(dados.sha1Manifesto))
      return { ok: false, motivo: "invalida" };
    if (estadoTrava(banco, agora).donoPcId !== null) return { ok: false, motivo: "servidor_no_ar" };
    const ocupado = banco
      .prepare("SELECT 1 FROM atualizacao WHERE expira_em > ? LIMIT 1")
      .get(agora);
    if (ocupado) return { ok: false, motivo: "atualizando" };
    banco
      .prepare(
        `UPDATE config_grupo SET versao_minecraft = ?, sha1_manifesto = ?, dono_pc_id = ?, atualizado_em = ?
         WHERE id = 1`,
      )
      .run(dados.versaoMinecraft, dados.sha1Manifesto, pcId, agora);
    return { ok: true };
  });
}
