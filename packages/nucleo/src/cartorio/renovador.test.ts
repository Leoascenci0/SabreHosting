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

/**
 * Relógios e agenda manuais: `andar(ms)` avança os dois relógios e dispara, na ordem, os tiques e alarmes que
 * vencem no caminho. `t.parede` pode andar sozinho (hibernação: o monotônico parado).
 */
function montar(extra: Partial<OpcoesRenovador> = {}) {
  const t = { agora: 1_000, parede: 1_700_000_000_000 };
  type Agendado = {
    fn: () => void;
    ms: number;
    quando: number;
    repete: boolean;
    cancelado: boolean;
  };
  const agenda: Agendado[] = [];
  const renovacoes: number[] = [];
  const sinais: (AbortSignal | undefined)[] = [];
  const solturas: number[] = [];
  const perdas: string[] = [];
  let respostaPegar: () => Promise<RespostaTrava> = async () => aceita();
  let respostaRenovar: () => Promise<RespostaTrava> = async () => aceita();
  const agendar = (repete: boolean) => (fn: () => void, ms: number) => {
    const a = { fn, ms, quando: t.agora + ms, repete, cancelado: false };
    agenda.push(a);
    return () => void (a.cancelado = true);
  };
  const r = new Renovador({
    cliente: {
      pegar: () => respostaPegar(),
      renovar: (epoca, sinal) => {
        renovacoes.push(epoca);
        sinais.push(sinal);
        return respostaRenovar();
      },
      soltar: async (epoca) => {
        solturas.push(epoca);
        return aceita(epoca);
      },
    },
    aoPerder: (motivo) => void perdas.push(motivo),
    agora: () => t.agora,
    agoraParede: () => t.parede,
    relogio: { repetir: agendar(true), depois: agendar(false) },
    ...extra,
  });
  const assentar = () => new Promise((ok) => setImmediate(ok));
  async function andar(ms: number) {
    const alvo = t.agora + ms;
    for (;;) {
      const proximo = agenda
        .filter((a) => !a.cancelado && a.quando <= alvo)
        .sort((x, y) => x.quando - y.quando)[0];
      if (!proximo) break;
      t.parede += proximo.quando - t.agora;
      t.agora = proximo.quando;
      if (proximo.repete) proximo.quando += proximo.ms;
      else proximo.cancelado = true;
      proximo.fn();
      await assentar();
    }
    t.parede += alvo - t.agora;
    t.agora = alvo;
    await assentar();
  }
  const tiques = () => agenda.filter((a) => a.repete);
  return {
    r,
    t,
    tiques,
    renovacoes,
    sinais,
    solturas,
    perdas,
    andar,
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
    expect(m.tiques()).toHaveLength(1);
    expect(m.tiques()[0]?.ms).toBe(20_000);
    expect(await m.r.temTrava()).toBe(true);
    await m.andar(5 * 20_000);
    expect(m.renovacoes).toEqual([4, 4, 4, 4, 4]);
    expect(await m.r.temTrava()).toBe(true);
    expect(m.perdas).toEqual([]);
  });

  it("pegar recusado avisa com o texto do cartório e não inicia renovação", async () => {
    const m = montar();
    m.pegarResponde(async () => ({ ...recusa("ocupada", 9), erro: "O servidor já está no PC B." }));
    await expect(m.r.pegar()).rejects.toThrow("O servidor já está no PC B.");
    expect(m.tiques()).toHaveLength(0);
    expect(await m.r.temTrava()).toBe(false);
  });

  it("pegar: prazo conta do envio, não da resposta nem do expiraEm do cartório", async () => {
    const m = montar();
    m.pegarResponde(async () => {
      m.t.agora += 25_000; // resposta chegou 25 s depois do envio
      m.t.parede += 25_000;
      return aceita();
    });
    await m.r.pegar();
    // prazo local = 3 × 20 s − margem 25 s = 35 s a partir do envio (t = 1 000)
    m.t.agora = 1_000 + 34_999;
    expect(await m.r.temTrava()).toBe(true);
    m.t.agora = 1_000 + 35_000;
    expect(await m.r.temTrava()).toBe(false);
  });

  it("renovar: prazo conta do envio da renovação, não da resposta atrasada", async () => {
    const m = montar();
    await m.r.pegar(); // t = 1 000
    m.renovarResponde(async () => {
      m.t.agora += 10_000; // resposta 10 s depois do envio (t = 21 000)
      m.t.parede += 10_000;
      return aceita();
    });
    await m.andar(20_000); // tique em 21 000; a resposta chega em 31 000
    m.t.agora = 21_000 + 34_999;
    expect(await m.r.temTrava()).toBe(true);
    m.t.agora = 21_000 + 35_000; // contando da resposta ainda valeria até 66 000
    expect(await m.r.temTrava()).toBe(false);
  });

  it("recusa na renovação: perde na hora e nunca adota a época da recusa", async () => {
    const m = montar();
    await m.r.pegar();
    m.renovarResponde(async () => recusa("epoca_velha", 5));
    await m.andar(20_000);
    expect(await m.r.temTrava()).toBe(false);
    expect(m.perdas).toEqual(["Outro PC assumiu o servidor."]);
    m.renovarResponde(async () => aceita(5));
    await m.andar(60_000);
    expect(m.renovacoes).toEqual([4]); // parou: nada de renovar com a época 5
    expect(m.tiques()[0]?.cancelado).toBe(true);
    expect(await m.r.temTrava()).toBe(false);
    expect(m.perdas).toHaveLength(1);
  });

  it("cartório mudo: avisa no fim do prazo local (alarme), sem esperar o próximo tique, uma vez só", async () => {
    const m = montar();
    await m.r.pegar(); // t = 1 000; vence em 36 000; tiques em 21 000, 41 000…
    m.renovarResponde(() => new Promise(() => {})); // nunca responde
    await m.andar(20_000); // 21 000: renovação pendurada
    expect(await m.r.temTrava()).toBe(true);
    await m.andar(14_999); // 35 999
    expect(m.perdas).toEqual([]);
    await m.andar(1); // 36 000: o alarme dispara, o tique de 41 000 ainda não chegou
    expect(m.perdas).toHaveLength(1);
    expect(m.perdas[0]).toMatch(/cartório não respondeu/);
    expect(await m.r.temTrava()).toBe(false);
    await m.andar(60_000);
    expect(m.perdas).toHaveLength(1);
    expect(m.renovacoes).toEqual([4]); // nem sobrepôs a pendurada, nem renovou depois de perder
  });

  it("temTrava cai pelo relógio mesmo antes de alarme ou tique", async () => {
    const m = montar();
    await m.r.pegar();
    m.t.agora += 35_000;
    expect(await m.r.temTrava()).toBe(false);
  });

  it("hibernação: relógio de parede andou 5 min com o monotônico parado → trava perdida", async () => {
    const m = montar();
    await m.r.pegar();
    m.t.parede += 5 * 60_000; // PC dormiu: o monotônico não andou
    expect(await m.r.temTrava()).toBe(false);
    await m.andar(20_000); // primeiro tique ao acordar
    expect(m.perdas).toHaveLength(1);
    expect(m.renovacoes).toEqual([]); // não tenta renovar uma trava que já venceu
  });

  it("hora do Windows atrasada não estende a trava (vale o monotônico)", async () => {
    const m = montar();
    await m.r.pegar();
    m.t.parede -= 60 * 60_000;
    m.t.agora += 35_000;
    expect(await m.r.temTrava()).toBe(false);
  });

  it("falha de rede numa renovação não perde a trava antes do prazo local", async () => {
    const m = montar();
    await m.r.pegar(); // vence em 36 000
    m.renovarResponde(async () => {
      throw new ErroCartorio("Sem resposta do cartório.", "rede");
    });
    await m.andar(20_000); // 21 000: falhou (já depois das novas tentativas do cliente)
    await m.andar(14_999); // 35 999: ainda vale
    expect(await m.r.temTrava()).toBe(true);
    expect(m.perdas).toEqual([]);
  });

  it.each([0, 10.5, -1, Number.NaN])(
    "recusa renovarMs absurdo (%s) e solta a trava",
    async (ms) => {
      const m = montar();
      m.pegarResponde(async () => aceita(4, ms));
      await expect(m.r.pegar()).rejects.toThrow(/intervalo/);
      expect(m.tiques()).toHaveLength(0);
      expect(m.solturas).toEqual([4]);
      expect(await m.r.temTrava()).toBe(false);
    },
  );

  it("margem que come o prazo inteiro é recusada", async () => {
    const m = montar({ margemMs: 50_000 });
    await expect(m.r.pegar()).rejects.toThrow(/intervalo/);
    expect(m.solturas).toEqual([4]);
  });

  it("soltar cancela renovação e alarme e solta com a própria época", async () => {
    const m = montar();
    await m.r.pegar();
    await m.r.soltar();
    expect(m.tiques()[0]?.cancelado).toBe(true);
    await m.andar(120_000);
    expect(m.perdas).toEqual([]); // alarme cancelado: soltar não é perder
    expect(m.renovacoes).toEqual([]);
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

  it("renovação aceita com outra época é perda; nunca adota a época da resposta", async () => {
    const m = montar();
    await m.r.pegar(); // época 4
    m.renovarResponde(async () => aceita(5));
    await m.andar(20_000);
    expect(m.perdas).toHaveLength(1);
    expect(m.perdas[0]).toMatch(/época/);
    expect(await m.r.temTrava()).toBe(false);
    await m.andar(60_000);
    expect(m.renovacoes).toEqual([4]);
  });

  it("soltar cancela a renovação em curso: nenhuma tentativa nova depois", async () => {
    const m = montar();
    await m.r.pegar();
    m.renovarResponde(() => new Promise(() => {})); // renovação pendurada (o cliente estaria repetindo)
    await m.andar(20_000);
    expect(m.sinais[0]?.aborted).toBe(false);
    await m.r.soltar();
    expect(m.sinais[0]?.aborted).toBe(true);
  });

  it("perder cancela a renovação em curso: nenhuma tentativa nova depois", async () => {
    const m = montar();
    await m.r.pegar();
    m.renovarResponde(() => new Promise(() => {}));
    await m.andar(20_000);
    await m.andar(16_000); // alarme do prazo local
    expect(m.perdas).toHaveLength(1);
    expect(m.sinais[0]?.aborted).toBe(true);
  });
});

describe("renovarAgora (syncmel-1.8b: antes de cada rename da troca)", () => {
  it("renova na hora, estende o prazo a partir desse envio e diz que vale", async () => {
    const m = montar();
    await m.r.pegar();
    m.t.agora += 30_000; // perto do fim do prazo local (35 s), sem tique ainda
    m.t.parede += 30_000;
    expect(await m.r.renovarAgora()).toBe(true);
    expect(m.renovacoes).toEqual([4]);
    m.t.agora += 34_999;
    m.t.parede += 34_999;
    expect(await m.r.temTrava()).toBe(true);
  });

  it("recusa na renovação: perde (avisa uma vez) e devolve false", async () => {
    const m = montar();
    await m.r.pegar();
    m.renovarResponde(async () => recusa("epoca_velha", 5));
    expect(await m.r.renovarAgora()).toBe(false);
    expect(m.perdas).toHaveLength(1);
    expect(await m.r.renovarAgora()).toBe(false);
    expect(m.renovacoes).toEqual([4]); // perdida: não pede de novo
  });

  it("época diferente na resposta ou cartório fora com o prazo vencido: false", async () => {
    const a = montar();
    await a.r.pegar();
    a.renovarResponde(async () => aceita(9));
    expect(await a.r.renovarAgora()).toBe(false);
    const b = montar();
    await b.r.pegar();
    b.renovarResponde(async () => {
      throw new ErroCartorio("fora", "rede");
    });
    expect(await b.r.renovarAgora()).toBe(true); // rede falhou, mas o prazo local ainda vale
    b.t.agora += 35_000;
    b.t.parede += 35_000;
    expect(await b.r.renovarAgora()).toBe(false);
  });

  it("sem pegar, ou depois de soltar: false e nenhum pedido", async () => {
    const m = montar();
    expect(await m.r.renovarAgora()).toBe(false);
    await m.r.pegar();
    await m.r.soltar();
    expect(await m.r.renovarAgora()).toBe(false);
    expect(m.renovacoes).toEqual([]);
  });
});
