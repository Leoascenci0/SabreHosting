import { haQuanto } from "./ha-quanto.js";

export function tamanhoDe(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return mb < 1
    ? `${Math.max(1, Math.round(bytes / 1024)).toLocaleString("pt-BR")} KB`
    : `${mb.toLocaleString("pt-BR", { maximumFractionDigits: 1 })} MB`;
}

export interface ResumoDeBackups {
  quantos: string;
  ultimo: string;
  /** Por que o "último" é "—" (dica da tela). */
  ultimoRazao?: string;
  espaco: string;
  proximo: string;
  /** Dica sob o valor: a razão do "—" ou a condição do automático. */
  proximoRazao: string;
}

/** Resumo do topo da tela de Backups. Só mostra o que o app sabe; o resto vira "—" com a razão. */
export function resumoDeBackups(
  itens: { criadoEm: string; tamanho: number }[],
  agora: number,
  intervaloMin: number | undefined,
): ResumoDeBackups {
  const datas = itens.map((b) => Date.parse(b.criadoEm)).filter((t) => !Number.isNaN(t));
  const recente = datas.length > 0 ? Math.max(...datas) : undefined;
  const ultimo =
    recente === undefined ? undefined : haQuanto(new Date(recente).toISOString(), agora);
  const total = itens.reduce((soma, b) => soma + b.tamanho, 0);
  return {
    quantos: String(itens.length),
    ultimo: ultimo ?? "—",
    ...(ultimo === undefined && {
      ultimoRazao:
        itens.length === 0
          ? "Ainda não há backups neste PC."
          : "Não consegui ler a data dos backups.",
    }),
    espaco: itens.length === 0 ? "—" : tamanhoDe(total),
    proximo: intervaloMin === undefined ? "—" : `a cada ${intervaloMin} min`,
    proximoRazao:
      intervaloMin === undefined
        ? "O intervalo se ajusta em Configurações › Backups."
        : "Só com o servidor pronto.",
  };
}
