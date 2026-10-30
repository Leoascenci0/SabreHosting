import { describe, expect, it } from "vitest";
import { ErroCartorio } from "./cliente.js";
import { Renovador, type OpcoesRenovador } from "./renovador.js";
import type { RespostaTrava, TravaAceita, TravaRecusada } from "./tipos.js";

const aceita = (epoca = 4, renovarMs = 20_000): TravaAceita => ({
  ok: true,
  epoca,
  expiraEm: 999_999_999, // relógio do cartório: o renovador não pode usar
  renovarMs,
});
const recusa = (motivo: TravaRecusada["motivo"], epoca: number): TravaRecusada => ({
  ok: false,
  erro: "Outro PC assumiu o servidor.",
  motivo,
  donoPcId: 2,
  epoca,
  expiraEm: 0,
});

/** Relógio e repetição manuais: o teste anda o tempo e dispara o tique. */
function montar(extra: Partial<OpcoesRenovador> = {}) {
  const t = { agora: 1_000 };
  const tiques: { fn: () => void; ms: number; cancelado: boolean }[] = [];
  const renovacoes: number[] = [];
  const solturas: number[] = [];
  const perdas: string[] = [];
  let respostaPegar: () => Promise<RespostaTrava> = async () => aceita();
  let respostaRenovar: () => Promise<RespostaTrava> = async () => aceita();
  const r = new Renovador({
    cliente: {
      pegar: () => respostaPegar(),
      renovar: (epoca) => {
        renovacoes.push(epoca);
        return respostaRenovar();
      },
      soltar: async (epoca) => {
        solturas.push(epoca);
        return aceita(epoca);
      },
    },
    aoPerder: (motivo) => void perdas.push(motivo),
    agora: () => t.agora,
    relogio: {
      repetir: (fn, ms) => {
        const tique = { fn, ms, cancelado: false };
        tiques.push(tique);
        return () => void (tique.cancelado = true);
      },
    },
    ...extra,
  });
  /** Anda o relógio e roda o tique ativo, esperando as promessas assentarem. */
  async function tique(ms = 20_000) {
    t.agora += ms;
    for (const q of tiques) if (!q.cancelado) q.fn();
    await new Promise((ok) => setImmediate(ok));
  }
  return {
    r,
    t,
    tiques,
    renovacoes,
    solturas,
    perdas,
    tique,
    pegarResponde: (f: () => Promise<RespostaTrava>) => void (respostaPegar = f),
    renovarResponde: (f: () => Promise<RespostaTrava>) => void (respostaRenovar = f),
  };
}

describe("renovador da trava", () => {
  it("sem pegar não tem trava", async () => {
    const { r } = montar();
    expect(await r.temTrava()).toBe(false);
  });

  it("pega, renova a cada renovarMs com a própria época e mantém a trava", async () => {
    const m = montar();
    await m.r.pegar();
    expect(m.tiques).toHaveLength(1);
    expect(m.tiques[0]?.ms).toBe(20_000);
    expect(await m.r.temTrava()).toBe(true);
    for (let i = 0; i < 5; i++) await m.tique();
    expect(m.renovacoes).toEqual([4, 4, 4, 4, 4]);
    expect(await m.r.temTrava()).toBe(true);
    expect(m.perdas).toEqual([]);
  });

  it("pegar recusado avisa com o texto do cartório e não inicia renovação", async () => {
    const m = montar();
    m.pegarResponde(async () => ({ ...recusa("ocupada", 9), erro: "O servidor já está no PC B." }));
    await expect(m.r.pegar()).rejects.toThrow("O servidor já está no PC B.");
    expect(m.tiques).toHaveLength(0);
    expect(await m.r.temTrava()).toBe(false);
  });

  it("prazo conta do envio, não da resposta nem do expiraEm do cartório", async () => {
    const m = montar();
    m.pegarResponde(async () => {
      m.t.agora += 25_000; // resposta chegou 25 s depois do envio
      return aceita();
    });
    await m.r.pegar();
    // prazo local = 3 × 20 s − margem 10 s = 50 s a partir do envio (t = 1 000)
    m.t.agora = 1_000 + 49_999;
    expect(await m.r.temTrava()).toBe(true);
    m.t.agora = 1_000 + 50_000;
    expect(await m.r.temTrava()).toBe(false);
  });

  it("recusa na renovação: perde na hora e nunca adota a época da recusa", async () => {
    const m = montar();
    await m.r.pegar();
    m.renovarResponde(async () => recusa("epoca_velha", 5));
    await m.tique();
    expect(await m.r.temTrava()).toBe(false);
    expect(m.perdas).toEqual(["Outro PC assumiu o servidor."]);
    m.renovarResponde(async () => aceita(5));
    await m.tique();
    await m.tique();
    expect(m.renovacoes).toEqual([4]); // parou: nada de renovar com a época 5
    expect(m.tiques[0]?.cancelado).toBe(true);
    expect(await m.r.temTrava()).toBe(false);
    expect(m.perdas).toHaveLength(1);
  });

  it("cartório mudo: prazo local vence, temTrava cai e avisa uma vez só", async () => {
    const m = montar();
    await m.r.pegar();
    m.renovarResponde(() => new Promise(() => {})); // nunca responde
    await m.tique(); // t = 21 000: ainda no prazo (vence em 51 000)
    expect(await m.r.temTrava()).toBe(true);
    await m.tique(); // 41 000: a renovação anterior segue pendurada, não sobrepõe
    expect(m.renovacoes).toEqual([4]);
    expect(m.perdas).toEqual([]);
    await m.tique(); // 61 000: venceu
    expect(await m.r.temTrava()).toBe(false);
    expect(m.perdas).toHaveLength(1);
    expect(m.perdas[0]).toMatch(/cartório não respondeu/);
    await m.tique();
    expect(m.perdas).toHaveLength(1);
  });

  it("temTrava cai pelo relógio mesmo antes do próximo tique", async () => {
    const m = montar();
    await m.r.pegar();
    m.t.agora += 50_000;
    expect(await m.r.temTrava()).toBe(false);
  });

  it("falha de rede isolada dentro do prazo não perde a trava", async () => {
    const m = montar();
    await m.r.pegar();
    m.renovarResponde(async () => {
      throw new ErroCartorio("Sem resposta do cartório.", "rede");
    });
    await m.tique();
    expect(await m.r.temTrava()).toBe(true);
    m.renovarResponde(async () => aceita());
    await m.tique();
    await m.tique();
    expect(await m.r.temTrava()).toBe(true);
    expect(m.perdas).toEqual([]);
  });

  it.each([0, 10.5, -1, Number.NaN])(
    "recusa renovarMs absurdo (%s) e solta a trava",
    async (ms) => {
      const m = montar();
      m.pegarResponde(async () => aceita(4, ms));
      await expect(m.r.pegar()).rejects.toThrow(/intervalo/);
      expect(m.tiques).toHaveLength(0);
      expect(m.solturas).toEqual([4]);
      expect(await m.r.temTrava()).toBe(false);
    },
  );

  it("soltar cancela a renovação e solta com a própria época", async () => {
    const m = montar();
    await m.r.pegar();
    await m.r.soltar();
    expect(m.tiques[0]?.cancelado).toBe(true);
    expect(m.solturas).toEqual([4]);
    expect(await m.r.temTrava()).toBe(false);
    await m.r.soltar(); // segunda vez: nada a soltar
    expect(m.solturas).toEqual([4]);
  });

  it("não pega duas vezes", async () => {
    const m = montar();
    await m.r.pegar();
    await expect(m.r.pegar()).rejects.toThrow(/já/);
  });
});
