/** Um PC que pode (ou não) hospedar. `nota` é `null` enquanto o PC nunca mediu. */
export interface Candidato {
  id: number;
  online: boolean;
  /** Configurações › Geral › "Permitir que meu PC hospede". */
  permitirHospedar: boolean;
  /** Versão do mundo que este PC tem. */
  versao: number;
  nota: number | null;
}

export interface EntradaDecidirHost {
  /** Quem hospeda agora; `null` se ninguém (caiu). */
  host: Candidato | null;
  candidatos: readonly Candidato[];
  /** A versão que o cartório diz ser a mais nova. */
  versaoMaisNova: number;
  /** Instante atual em ms (injetado: esta função não lê o relógio). */
  agora: number;
  /** Configurações › Grupo › "Folga para trocar de host": nota nova ≥ folga × nota do host. */
  folga?: number;
  /** Minutos sem nenhuma troca depois da última. */
  calmaMin?: number;
  /** `/ficar`: até quando o host atual não deve ser trocado (ms). */
  ficarAte?: number;
  /** Quando houve a última troca de host (ms). */
  ultimaTrocaEm?: number;
}

export interface DecisaoHost {
  acao: "manter" | "trocar" | "eleger";
  para?: number;
  motivo: string;
}

const MS_POR_MINUTO = 60_000;
/** Tolerância para `folga × nota` não recusar o empate exato por erro de ponto flutuante. */
const EPS = 1e-9;

function valido(c: Candidato, versaoMaisNova: number): c is Candidato & { nota: number } {
  return (
    c.online &&
    c.permitirHospedar &&
    c.versao === versaoMaisNova && // regra de ouro 5: só hospeda quem tem a versão mais nova
    c.nota !== null &&
    Number.isFinite(c.nota) &&
    c.nota >= 0
  );
}

/** Maior nota; empate: menor id (determinístico, não depende da ordem da lista). */
function melhor(
  lista: (Candidato & { nota: number })[],
): (Candidato & { nota: number }) | undefined {
  return lista.reduce<(Candidato & { nota: number }) | undefined>(
    (m, c) => (m === undefined || c.nota > m.nota || (c.nota === m.nota && c.id < m.id) ? c : m),
    undefined,
  );
}

/** Por que o host atual não é o ideal (só informa; a troca forçada é do failover). */
function avisosDoHost(host: Candidato, versaoMaisNova: number): string {
  const avisos: string[] = [];
  if (host.versao !== versaoMaisNova) avisos.push("host-versao-atrasada");
  if (!host.permitirHospedar) avisos.push("host-sem-permissao");
  return avisos.length === 0 ? "" : ` (${avisos.join(", ")})`;
}

/**
 * Decide quem deve hospedar. PURA: não lê relógio, rede nem cartório; só decide, quem executa a troca é a migração.
 * - sem host (caiu ou offline): `eleger` o válido de maior nota; nenhum válido → `manter` sem `para`.
 * - com host: `manter` se há `/ficar` vigente ou a última troca foi há menos de `calmaMin` minutos; senão `trocar`
 *   só se a melhor nota válida for ≥ `folga` × nota do host.
 * Válido = online, com permissão, na versão mais nova e com nota medida.
 */
export function decidirHost(e: EntradaDecidirHost): DecisaoHost {
  const {
    host,
    candidatos,
    versaoMaisNova,
    agora,
    folga = 1.3,
    calmaMin = 10,
    ficarAte,
    ultimaTrocaEm,
  } = e;
  if (!Number.isFinite(folga) || folga < 1)
    throw new RangeError(`folga precisa ser um número ≥ 1 (veio ${folga})`);
  if (!Number.isFinite(calmaMin) || calmaMin < 0)
    throw new RangeError(`calmaMin precisa ser ≥ 0 (veio ${calmaMin})`);

  const validos = candidatos.filter((c) => valido(c, versaoMaisNova));

  if (host === null || !host.online) {
    const eleito = melhor(validos);
    if (eleito === undefined) return { acao: "manter", motivo: "sem-candidato" };
    return { acao: "eleger", para: eleito.id, motivo: host === null ? "sem-host" : "host-offline" };
  }

  const aviso = avisosDoHost(host, versaoMaisNova);
  if (ficarAte !== undefined && ficarAte > agora)
    return { acao: "manter", motivo: `ficar${aviso}` };
  if (ultimaTrocaEm !== undefined && agora - ultimaTrocaEm < calmaMin * MS_POR_MINUTO) {
    return { acao: "manter", motivo: `calma${aviso}` };
  }

  const outro = melhor(validos.filter((c) => c.id !== host.id));
  if (outro === undefined) return { acao: "manter", motivo: `sem-candidato${aviso}` };

  const notaHost = host.nota !== null && Number.isFinite(host.nota) ? host.nota : 0;
  if (outro.nota > notaHost && outro.nota >= folga * notaHost - EPS) {
    return { acao: "trocar", para: outro.id, motivo: "nota-maior" };
  }
  return { acao: "manter", motivo: `nota-insuficiente${aviso}` };
}
