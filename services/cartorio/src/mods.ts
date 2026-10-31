import { type Banco, ehDono, emTransacao } from "./banco.js";

/**
 * Mods do grupo (lanc-1.4): a lista que todos os PCs usam igual. O cartório guarda só a lista (nome, versão, endereço
 * e sha512); o arquivo é baixado pelo núcleo, que confere o hash. Só o dono grava, e a lista é trocada inteira.
 */
export interface ModGrupo {
  nome: string;
  versao: string;
  /** Nome do arquivo dentro da pasta `mods` (um `.jar` simples, sem pasta). */
  arquivo: string;
  url: string;
  sha512: string;
  lado: "cliente" | "servidor" | "ambos";
}
export type ResultadoMods = { ok: true } | { ok: false; motivo: "nao_e_dono" | "invalida" };

export const MAX_MODS = 200;
/** Único host de onde o grupo baixa mod (a CDN do Modrinth). O núcleo confere de novo ao baixar. */
export const HOST_MODS = "cdn.modrinth.com";
const SHA512 = /^[0-9a-f]{128}$/;
const ARQUIVO = /^[A-Za-z0-9][A-Za-z0-9._+()-]{0,127}\.jar$/;
const LADOS = ["cliente", "servidor", "ambos"];

function urlPermitida(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && u.hostname === HOST_MODS && !u.username && !u.password;
  } catch {
    return false;
  }
}

function modValido(m: ModGrupo): boolean {
  const curto = (s: unknown, max: number) =>
    typeof s === "string" && s.length >= 1 && s.length <= max;
  return (
    curto(m.nome, 80) &&
    curto(m.versao, 64) &&
    typeof m.arquivo === "string" &&
    ARQUIVO.test(m.arquivo) &&
    !m.arquivo.includes("..") &&
    typeof m.url === "string" &&
    urlPermitida(m.url) &&
    typeof m.sha512 === "string" &&
    SHA512.test(m.sha512) &&
    LADOS.includes(m.lado)
  );
}

export function lerMods(banco: Banco): ModGrupo[] {
  return banco
    .prepare(
      "SELECT nome, versao, arquivo, url, sha512, lado FROM mods_grupo ORDER BY nome, arquivo",
    )
    .all() as unknown as ModGrupo[];
}

/** Dono conferido e lista trocada na MESMA transação: ou vale a lista nova inteira, ou continua a antiga. */
export function gravarMods(
  banco: Banco,
  pcId: number,
  mods: ModGrupo[],
  agora: number,
): ResultadoMods {
  return emTransacao(banco, () => {
    if (!ehDono(banco, pcId)) return { ok: false, motivo: "nao_e_dono" };
    const arquivos = new Set(mods.map((m) => m.arquivo.toLowerCase()));
    if (mods.length > MAX_MODS || !mods.every(modValido) || arquivos.size !== mods.length)
      return { ok: false, motivo: "invalida" };
    banco.exec("DELETE FROM mods_grupo");
    const inserir = banco.prepare(
      `INSERT INTO mods_grupo (nome, versao, arquivo, url, sha512, lado, dono_pc_id, atualizado_em)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    );
    for (const m of mods)
      inserir.run(m.nome, m.versao, m.arquivo, m.url, m.sha512, m.lado, pcId, agora);
    return { ok: true };
  });
}
