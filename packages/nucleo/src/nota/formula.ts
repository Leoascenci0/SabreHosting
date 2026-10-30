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

/** PC "nota 100" em cada medida: tirar mais que isso não rende ponto extra. */
export const REFERENCIA: Medicao = {
  cpuUmNucleo: 250,
  cpuNucleos: 1000,
  ramLivreMb: 8192,
  uploadMbps: 50,
};

/** Pontos de cada medida; somam 100. Um núcleo pesa mais porque o servidor Minecraft usa um fio principal. */
export const PESOS: Medicao = {
  cpuUmNucleo: 40,
  cpuNucleos: 20,
  ramLivreMb: 25,
  uploadMbps: 15,
};

const chaves = Object.keys(PESOS) as (keyof Medicao)[];

/**
 * Nota de 0 a 100: soma, para cada medida, PESO × min(valor / REFERENCIA, 1), arredondada.
 * Pura e determinística: a mesma medição dá sempre a mesma nota. Valor negativo ou inválido conta como 0.
 */
export function calcularNota(medicao: Medicao): number {
  const total = chaves.reduce((soma, k) => {
    const v = Number.isFinite(medicao[k]) ? Math.max(0, medicao[k]) : 0;
    return soma + PESOS[k] * Math.min(v / REFERENCIA[k], 1);
  }, 0);
  return Math.round(total);
}
