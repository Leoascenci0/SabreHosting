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
