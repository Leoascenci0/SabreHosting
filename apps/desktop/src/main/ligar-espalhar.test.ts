import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { ESPALHAR_A_CADA_MS, ligarEspalhar } from "./ligar-espalhar.js";

const pastas: string[] = [];
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

function montar(env: Record<string, string | undefined>) {
  const pedidos: string[] = [];
  const agendados: Array<{ tarefa: () => void; ms: number }> = [];
  const avisos: string[] = [];
  const fetchFn = (async (url: string) => {
    pedidos.push(new URL(url).pathname);
    return new Response(JSON.stringify({ versao: null }), { status: 200 }); // nenhuma versão registrada ainda
  }) as unknown as typeof fetch;
  const pasta = mkdtempSync(join(tmpdir(), "sabre-ligar-"));
  pastas.push(pasta);
  const disparo = ligarEspalhar({
    env: {
      SABRE_CARTORIO_URL: "http://10.66.0.1:8080",
      SABRE_CARTORIO_TOKEN: "tk",
      SABRE_PASTA_BACKUPS: pasta,
      ...env,
    },
    inicio: { ativo: () => false, temOrfao: async () => false },
    aoAvisar: (t) => avisos.push(t),
    agendar: (tarefa, ms) => agendados.push({ tarefa, ms }),
    fetchFn,
  });
  return { disparo, pedidos, agendados, avisos };
}

const esperar = () => new Promise((ok) => setTimeout(ok, 20));

describe("ligarEspalhar (1.10)", () => {
  it("sem token, sem pasta de backups ou sem cartório: fica quieto e não agenda nada", () => {
    for (const env of [
      { SABRE_CARTORIO_TOKEN: undefined },
      { SABRE_PASTA_BACKUPS: undefined },
      { SABRE_CARTORIO_URL: undefined },
    ]) {
      const c = montar(env);
      expect(c.disparo).toBeUndefined();
      expect(c.agendados).toHaveLength(0);
      expect(c.pedidos).toHaveLength(0);
    }
  });

  it("liga: roda já no arranque, agenda UM relógio de 10 min e devolve o disparo (backup bom)", async () => {
    const c = montar({});
    const disparo = c.disparo;
    if (!disparo) throw new Error("devia ligar");
    expect(c.agendados).toHaveLength(1);
    expect(c.agendados[0]?.ms).toBe(ESPALHAR_A_CADA_MS);
    await esperar();
    const noArranque = c.pedidos.length;
    expect(noArranque).toBeGreaterThan(0);
    c.agendados[0]?.tarefa(); // o relógio dispara
    await esperar();
    const depoisDoRelogio = c.pedidos.length;
    expect(depoisDoRelogio).toBeGreaterThan(noArranque);
    await disparo(); // backup bom dispara de novo
    expect(c.pedidos.length).toBeGreaterThan(depoisDoRelogio);
    expect(c.avisos).toEqual([]); // sem versão nova não é erro
  });
});
