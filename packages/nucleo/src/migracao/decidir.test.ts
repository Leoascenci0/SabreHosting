import { describe, expect, it } from "vitest";
import { decidirHost, type Candidato } from "./decidir.js";

const MIN = 60_000;
const agora = Date.parse("2026-10-30T12:00:00Z");
const NOVA = 7;

const pc = (id: number, nota: number | null, extra: Partial<Candidato> = {}): Candidato => ({
  id,
  online: true,
  permitirHospedar: true,
  versao: NOVA,
  nota,
  ...extra,
});

const base = { versaoMaisNova: NOVA, agora };

describe("decidirHost com host", () => {
  const host = pc(1, 100);

  it.each([
    ["empate exato em 1,3×", 130, "trocar"],
    ["acima de 1,3×", 131, "trocar"],
    ["1,29× não troca", 129, "manter"],
    ["mesma nota não troca", 100, "manter"],
  ])("%s", (_nome, nota, acao) => {
    const r = decidirHost({ ...base, host, candidatos: [host, pc(2, nota)] });
    expect(r.acao).toBe(acao);
    expect(r.para).toBe(acao === "trocar" ? 2 : undefined);
  });

  it("1,3× em nota quebrada não falha por ponto flutuante", () => {
    // 1,3 × 70 pode dar 91,00000000000001 em ponto flutuante: a tolerância evita recusar o empate exato
    const r = decidirHost({ ...base, host: pc(1, 10), candidatos: [pc(2, 13)] });
    expect(r.acao).toBe("trocar");
    const r2 = decidirHost({ ...base, host: pc(1, 70), candidatos: [pc(2, 91)] });
    expect(r2.acao).toBe("trocar");
  });

  it("troca pelo candidato de maior nota (empate: menor id)", () => {
    const r = decidirHost({ ...base, host, candidatos: [pc(5, 200), pc(3, 200), pc(4, 150)] });
    expect(r).toMatchObject({ acao: "trocar", para: 3 });
  });

  it("respeita a folga configurada", () => {
    const c = [pc(2, 150)];
    expect(decidirHost({ ...base, host, candidatos: c, folga: 1.5 }).acao).toBe("trocar");
    expect(decidirHost({ ...base, host, candidatos: c, folga: 1.51 }).acao).toBe("manter");
  });

  it("/ficar vigente adia a troca; vencido (ou no instante exato) não", () => {
    const c = [pc(2, 500)];
    const vigente = decidirHost({ ...base, host, candidatos: c, ficarAte: agora + 1 });
    expect(vigente).toMatchObject({ acao: "manter", motivo: "ficar" });
    expect(decidirHost({ ...base, host, candidatos: c, ficarAte: agora }).acao).toBe("trocar");
    expect(decidirHost({ ...base, host, candidatos: c, ficarAte: agora - 1 }).acao).toBe("trocar");
  });

  it("janela de calma: nenhuma troca nos últimos calmaMin minutos", () => {
    const c = [pc(2, 500)];
    const dentro = decidirHost({
      ...base,
      host,
      candidatos: c,
      ultimaTrocaEm: agora - 10 * MIN + 1,
    });
    expect(dentro).toMatchObject({ acao: "manter", motivo: "calma" });
    expect(
      decidirHost({ ...base, host, candidatos: c, ultimaTrocaEm: agora - 10 * MIN }).acao,
    ).toBe("trocar");
    expect(
      decidirHost({ ...base, host, candidatos: c, ultimaTrocaEm: agora - 5 * MIN, calmaMin: 5 })
        .acao,
    ).toBe("trocar");
    expect(
      decidirHost({ ...base, host, candidatos: c, ultimaTrocaEm: agora - 5 * MIN, calmaMin: 6 })
        .acao,
    ).toBe("manter");
  });

  it.each([
    ["versão atrasada", { versao: NOVA - 1 }],
    ["offline", { online: false }],
    ["sem permissão de hospedar", { permitirHospedar: false }],
    ["sem nota medida", { nota: null }],
  ] as [string, Partial<Candidato>][])("candidato %s é ignorado", (_nome, extra) => {
    const r = decidirHost({ ...base, host, candidatos: [pc(2, 900, extra)] });
    expect(r).toMatchObject({ acao: "manter" });
    expect(r.para).toBeUndefined();
  });

  it("ignora o inválido e troca pelo válido", () => {
    const r = decidirHost({
      ...base,
      host,
      candidatos: [pc(2, 900, { versao: NOVA - 1 }), pc(3, 140)],
    });
    expect(r).toMatchObject({ acao: "trocar", para: 3 });
  });

  it("não troca o host por ele mesmo", () => {
    expect(decidirHost({ ...base, host, candidatos: [host] }).acao).toBe("manter");
  });

  it("host com versão atrasada não força troca (só registra o motivo)", () => {
    const atrasado = pc(1, 100, { versao: NOVA - 1 });
    const r = decidirHost({ ...base, host: atrasado, candidatos: [pc(2, 120)] });
    expect(r.acao).toBe("manter");
    expect(r.motivo).toContain("host-versao-atrasada");
    // mas a regra normal de nota continua valendo
    expect(decidirHost({ ...base, host: atrasado, candidatos: [pc(2, 130)] }).acao).toBe("trocar");
  });

  it("host sem permissão de hospedar não força troca (só registra o motivo)", () => {
    const sem = pc(1, 100, { permitirHospedar: false });
    const r = decidirHost({ ...base, host: sem, candidatos: [pc(2, 110)] });
    expect(r.acao).toBe("manter");
    expect(r.motivo).toContain("host-sem-permissao");
  });

  it("host de nota 0 só cede a candidato de nota maior que 0", () => {
    const zero = pc(1, 0);
    expect(decidirHost({ ...base, host: zero, candidatos: [pc(2, 0)] }).acao).toBe("manter");
    expect(decidirHost({ ...base, host: zero, candidatos: [pc(2, 1)] }).acao).toBe("trocar");
  });

  it("host sem nota medida: qualquer válido com nota maior que 0 assume", () => {
    expect(decidirHost({ ...base, host: pc(1, null), candidatos: [pc(2, 10)] }).acao).toBe(
      "trocar",
    );
  });
});

describe("decidirHost sem host (eleição)", () => {
  it("elege o de maior nota", () => {
    const r = decidirHost({ ...base, host: null, candidatos: [pc(1, 80), pc(2, 120), pc(3, 90)] });
    expect(r).toMatchObject({ acao: "eleger", para: 2 });
  });

  it("empate: menor id, em qualquer ordem da lista", () => {
    const lista = [pc(4, 100), pc(2, 100), pc(9, 100), pc(3, 100)];
    const ordens = [lista, [...lista].reverse(), [pc(9, 100), pc(4, 100), pc(3, 100), pc(2, 100)]];
    for (const candidatos of ordens) {
      expect(decidirHost({ ...base, host: null, candidatos })).toMatchObject({
        acao: "eleger",
        para: 2,
      });
    }
  });

  it("host offline conta como host que caiu", () => {
    const r = decidirHost({
      ...base,
      host: pc(1, 500, { online: false }),
      candidatos: [pc(2, 50)],
    });
    expect(r).toMatchObject({ acao: "eleger", para: 2 });
  });

  it("versão atrasada nunca é eleita, mesmo com nota maior (regra de ouro 5)", () => {
    const r = decidirHost({
      ...base,
      host: null,
      candidatos: [pc(1, 999, { versao: NOVA - 1 }), pc(2, 10)],
    });
    expect(r).toMatchObject({ acao: "eleger", para: 2 });
  });

  it("/ficar e calma não seguram a eleição de host que caiu", () => {
    const r = decidirHost({
      ...base,
      host: null,
      candidatos: [pc(2, 10)],
      ficarAte: agora + MIN,
      ultimaTrocaEm: agora,
    });
    expect(r).toMatchObject({ acao: "eleger", para: 2 });
  });

  it("nenhum candidato válido: não elege ninguém", () => {
    const r = decidirHost({
      ...base,
      host: null,
      candidatos: [
        pc(1, 100, { versao: 1 }),
        pc(2, 100, { online: false }),
        pc(3, 100, { permitirHospedar: false }),
        pc(4, null),
      ],
    });
    expect(r).toMatchObject({ acao: "manter", motivo: "sem-candidato" });
    expect(r.para).toBeUndefined();
    expect(decidirHost({ ...base, host: null, candidatos: [] }).acao).toBe("manter");
  });
});

describe("decidirHost: entradas inválidas e pureza", () => {
  it.each([0.99, 0, -1, Number.NaN, Number.POSITIVE_INFINITY])("folga %s é recusada", (folga) => {
    expect(() => decidirHost({ ...base, host: null, candidatos: [], folga })).toThrow(RangeError);
  });

  it.each([-1, Number.NaN, Number.POSITIVE_INFINITY])("calmaMin %s é recusado", (calmaMin) => {
    expect(() => decidirHost({ ...base, host: null, candidatos: [], calmaMin })).toThrow(
      RangeError,
    );
  });

  it("folga 1 é aceita (troca por nota maior)", () => {
    expect(
      decidirHost({ ...base, host: pc(1, 100), candidatos: [pc(2, 101)], folga: 1 }).acao,
    ).toBe("trocar");
  });

  it("não muda a lista recebida e dá o mesmo resultado nas duas chamadas", () => {
    const candidatos = [pc(3, 200), pc(2, 200)];
    const copia = structuredClone(candidatos);
    const a = decidirHost({ ...base, host: pc(1, 100), candidatos });
    const b = decidirHost({ ...base, host: pc(1, 100), candidatos });
    expect(candidatos).toEqual(copia);
    expect(a).toEqual(b);
  });
});
