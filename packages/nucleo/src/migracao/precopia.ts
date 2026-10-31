/**
 * Pré-cópia em segundo plano (1º passo da migração de host): o candidato puxa a versão mais nova (o último backup bom
 * que o host serve) enquanto o host joga, e mede quanto falta para a troca (o delta final).
 *
 * Não escreve nada e não troca o host: reaproveita `espalhar` (trava de ATUALIZAÇÃO, candidato parado e fora do host,
 * pasta temporária, manifesto inteiro conferido, `rename`); o mundo que roda no host nunca é tocado, só o backup que
 * ele serve. A trava de host só entra na troca (migra-2.2).
 */
import { resolve } from "node:path";
import { compararManifestos, gerarManifesto, type Manifesto } from "../backup/manifesto.js";
import { exigirMundoNaPastaDoServidor } from "../backup/restaurar.js";
import { exigirForaDoHost } from "../sync/aplicar.js";
import { espalhar, type OpcoesEspalhar } from "../sync/espalhar.js";

export interface DeltaFinal {
  /** Arquivos novos ou mudados (apagados não viajam). */
  arquivos: number;
  bytes: number;
  /** Tamanho do mundo final, base da porcentagem. */
  bytesDoMundo: number;
  porcento: number;
  /** Tempo previsto para levar o delta, pela vazão medida na pré-cópia; `null` sem medida. */
  tempoPrevistoMs: number | null;
}

/** Quanto falta de `local` para `final`: soma o tamanho (do manifesto final) dos arquivos novos e mudados. Pura. */
export function medirDeltaFinal(
  local: Manifesto,
  final: Manifesto,
  bytesPorSegundo?: number,
): DeltaFinal {
  const { novos, mudados } = compararManifestos(local, final);
  const leva = new Set([...novos, ...mudados]);
  let bytes = 0;
  let bytesDoMundo = 0;
  for (const a of final.arquivos) {
    bytesDoMundo += a.tamanho;
    if (leva.has(a.caminho)) bytes += a.tamanho;
  }
  return {
    arquivos: leva.size,
    bytes,
    bytesDoMundo,
    porcento: bytesDoMundo > 0 ? (bytes / bytesDoMundo) * 100 : 0,
    tempoPrevistoMs:
      bytesPorSegundo && bytesPorSegundo > 0 ? Math.ceil((bytes / bytesPorSegundo) * 1000) : null,
  };
}

export interface PreCopia {
  estado: "atualizado" | "ja-tinha";
  bytesBaixados: number;
  /** Vazão medida nesta pré-cópia; `null` se nada foi baixado. */
  bytesPorSegundo: number | null;
  /** O que o candidato tem agora (a versão mais nova): base de `medirDeltaFinal` contra o backup final do host. */
  manifesto: Manifesto;
}

/** O candidato puxa a versão mais nova (fontes e versão do cartório; host aceito, por último). Recusa se ele roda. */
export async function pedirPreCopia(
  o: OpcoesEspalhar,
  agora: () => number = Date.now,
): Promise<PreCopia> {
  const inicio = agora();
  const r = await espalhar(o);
  if (r.estado === "atualizado") {
    const ms = agora() - inicio;
    return {
      estado: r.estado,
      bytesBaixados: r.bytesBaixados,
      bytesPorSegundo: r.bytesBaixados > 0 && ms > 0 ? (r.bytesBaixados / ms) * 1000 : null,
      manifesto: r.manifesto,
    };
  }
  // Já tinha: o manifesto sai da própria pasta, lida só com o servidor dele parado e fora do host (regra 2).
  exigirMundoNaPastaDoServidor(resolve(o.pastaDoMundo), o.pastaDoServidor);
  await exigirForaDoHost(o);
  const manifesto = await gerarManifesto(o.pastaDoMundo, { versao: o.versaoLocal, epoca: 0 });
  return { estado: r.estado, bytesBaixados: 0, bytesPorSegundo: null, manifesto };
}
