/** O que o benchmark mede num PC. Unidades: Mop/s = milhões de passos do laço por segundo. */
export interface Medicao {
  /** Velocidade de um núcleo (o Minecraft depende muito dele). */
  cpuUmNucleo: number;
  /** Soma de todos os núcleos trabalhando juntos. */
  cpuNucleos: number;
  /** Memória livre no momento, em MB. */
  ramLivreMb: number;
  /** Velocidade de envio da internet, em Mbit/s. */
  uploadMbps: number;
}

/** PC "nota 100": as referências de cada medida. Passar delas rende nota acima de 100 (sem teto em 100). */
export const REFERENCIA: Medicao = {
  cpuUmNucleo: 250,
  cpuNucleos: 1000,
  ramLivreMb: 8192,
  uploadMbps: 50,
};

/** Pontos de cada medida num PC de referência; somam 100. Um núcleo pesa mais porque o servidor Minecraft usa um fio principal. */
export const PESOS: Medicao = {
  cpuUmNucleo: 40,
  cpuNucleos: 20,
  ramLivreMb: 25,
  uploadMbps: 15,
};

const chaves = Object.keys(PESOS) as (keyof Medicao)[];

/**
 * Teto de sanidade: cada medida conta no máximo 100× a referência, então a nota nunca passa de 10 000
 * (valor absurdo, como Infinity, não gera Infinity nem NaN). Sem teto em 100 de propósito: a troca de host
 * exige nota nova ≥ 1,3 × nota do host, impossível se a nota parasse em 100.
 */
export const NOTA_MAXIMA = 10_000;
const RAZAO_MAXIMA = NOTA_MAXIMA / 100;

/**
 * Nota: soma, para cada medida, PESO × (valor ÷ REFERENCIA), arredondada. 100 = PC de referência; um PC 2× mais
 * forte em tudo dá ~200. Pura, determinística, inteira, de 0 a NOTA_MAXIMA e crescente com cada medida.
 * Negativo, -Infinity e NaN contam como 0; +Infinity conta como o máximo.
 */
export function calcularNota(medicao: Medicao): number {
  const total = chaves.reduce((soma, k) => {
    const v = medicao[k];
    const razao = Number.isNaN(v) ? 0 : Math.min(Math.max(v, 0) / REFERENCIA[k], RAZAO_MAXIMA);
    return soma + PESOS[k] * razao;
  }, 0);
  return Math.min(Math.round(total), NOTA_MAXIMA);
}
