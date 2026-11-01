/** "há 3 horas" em palavras simples; data inválida = `undefined` (a tela não mostra a linha). */
export function haQuanto(iso: string, agora: number = Date.now()): string | undefined {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return undefined;
  const min = Math.floor(Math.max(0, agora - t) / 60_000);
  if (min < 1) return "há menos de 1 minuto";
  const [n, um, varios] =
    min < 60
      ? [min, "minuto", "minutos"]
      : min < 1440
        ? [Math.floor(min / 60), "hora", "horas"]
        : [Math.floor(min / 1440), "dia", "dias"];
  return `há ${n} ${n === 1 ? um : varios}`;
}

const doisDigitos = (n: number): string => String(n).padStart(2, "0");

/** "hoje 14:32", "ontem 09:10" ou "30/10/2026 18:05" (fuso do PC); data inválida = `undefined`. */
export function dataEmPalavras(iso: string, agora: number = Date.now()): string | undefined {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return undefined;
  const hora = `${doisDigitos(t.getHours())}:${doisDigitos(t.getMinutes())}`;
  const diaDe = (d: Date): number => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dias = Math.round((diaDe(new Date(agora)) - diaDe(t)) / 86_400_000);
  if (dias === 0) return `hoje ${hora}`;
  if (dias === 1) return `ontem ${hora}`;
  return `${doisDigitos(t.getDate())}/${doisDigitos(t.getMonth() + 1)}/${t.getFullYear()} ${hora}`;
}
