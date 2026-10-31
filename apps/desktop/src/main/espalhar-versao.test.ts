import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { gerarMundo, hashesDoMundo } from "../../../../packages/nucleo/test/ajuda/mundos.js";
import { gerarManifesto } from "@sabrehosting/nucleo/backup/manifesto";
import { hashDoArquivo } from "@sabrehosting/nucleo/integridade/hash";
import { servirArquivos, type Servidor } from "@sabrehosting/nucleo/sync/transferencia";
import { criarEspalhador, criarGatilhoEspalhar } from "./espalhar-versao.js";

const pastas: string[] = [];
const servidores: Servidor[] = [];
afterEach(async () => {
  for (const s of servidores.splice(0)) await s.fechar();
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

async function cenario() {
  const base = mkdtempSync(join(tmpdir(), "sabre-espalhar-app-"));
  pastas.push(base);
  const host = gerarMundo({ tamanho: "1MB", semente: "A", pasta: join(base, "host", "world") });
  const servidorLocal = join(base, "pc");
  const mundo = gerarMundo({ tamanho: "1MB", semente: "A", pasta: join(servidorLocal, "world") });
  writeFileSync(join(host, "region", "r.0.0.mca"), "região mudada");
  const alvo = await gerarManifesto(host, { versao: 4, epoca: 1 });
  const arquivoManifesto = join(base, "manifesto.json");
  writeFileSync(arquivoManifesto, JSON.stringify(alvo));
  const manifestoSha256 = await hashDoArquivo(arquivoManifesto);
  const porHash = new Map(alvo.arquivos.map((a) => [a.sha256, join(host, a.caminho)]));
  porHash.set(manifestoSha256, arquivoManifesto);
  const servidor = await servirArquivos({
    endereco: "127.0.0.1",
    porta: 0,
    permitirLoopbackParaTeste: true,
    conferirToken: async (t) => (t === "tk" ? "pc" : null),
    arquivos: (h) => {
      const caminho = porHash.get(h);
      return caminho ? { caminho } : undefined;
    },
  });
  servidores.push(servidor);
  const eventos: string[] = [];
  const ok = { ok: true as const, epoca: 3, expiraEm: 0, renovarMs: 20_000 };
  // O host (PC 2) está com a trava de host; este PC (1) só atualiza a própria cópia.
  const estado = { dono: { id: 2, nome: "PC do host" } as { id: number; nome: string } | null };
  const cliente = {
    pegarAtualizacao: async () => (eventos.push("pegar"), ok),
    renovarAtualizacao: async () => ok,
    soltarAtualizacao: async () => (eventos.push("soltar"), ok),
    informarCopia: async (v: number) => void eventos.push(`copia ${v}`),
    eu: async () => ({ id: 1, nome: "Este PC", dono: false }),
    estadoTrava: async () => ({
      ...estado,
      epoca: 9,
      expiraEm: 0,
      prazoMs: 60_000,
      renovarMs: 20_000,
    }),
  };
  const montar = (extra: Partial<Parameters<typeof criarEspalhador>[0]> = {}) =>
    criarEspalhador({
      pastaDoMundo: mundo,
      pastaDoServidor: servidorLocal,
      pastaTemporaria: join(base, "tmp-manifesto"),
      token: "tk",
      cliente,
      servidorRodando: () => false,
      versaoLocal: async () => 3,
      permitirLoopbackParaTeste: true,
      ...extra,
    });
  const args = [
    { numero: 4, manifestoSha256 },
    [{ tipo: "pc" as const, endereco: "127.0.0.1", porta: servidor.porta }],
  ] as const;
  return { base, host, mundo, servidorLocal, eventos, cliente, montar, args, estado };
}

describe("criarEspalhador", () => {
  it("com outro PC hospedando: pega a vez de ATUALIZAR, atualiza, avisa o cartório e solta (1.8b)", async () => {
    const c = await cenario();
    const r = await c.montar()(...c.args);
    expect(r.estado).toBe("atualizado");
    expect(hashesDoMundo(c.mundo)).toEqual(hashesDoMundo(c.host));
    expect(c.eventos).toEqual(["pegar", "copia 4", "soltar"]);
  });

  it("com o servidor rodando recusa antes de pegar a vez e o mundo não muda", async () => {
    const c = await cenario();
    const antes = hashesDoMundo(c.mundo);
    await expect(c.montar({ servidorRodando: () => true })(...c.args)).rejects.toThrow(/servidor/i);
    expect(c.eventos).toEqual([]);
    expect(hashesDoMundo(c.mundo)).toEqual(antes);
  });

  it("este PC tem a trava de host: recusa sem pedir a vez de atualizar (o mundo vivo não se toca)", async () => {
    const c = await cenario();
    const antes = hashesDoMundo(c.mundo);
    c.estado.dono = { id: 1, nome: "Este PC" };
    await expect(c.montar()(...c.args)).rejects.toThrow(/hospedando/i);
    expect(c.eventos).toEqual([]);
    expect(hashesDoMundo(c.mundo)).toEqual(antes);
  });

  it("cartório recusa a vez de atualizar: nada é solto nem trocado e a mensagem é em pt-BR", async () => {
    const c = await cenario();
    const antes = hashesDoMundo(c.mundo);
    const cliente = {
      ...c.cliente,
      pegarAtualizacao: async () => ({
        ok: false as const,
        erro: "Este PC está hospedando o servidor.",
        motivo: "hospedando" as const,
        epoca: 0,
        expiraEm: 0,
      }),
    };
    await expect(c.montar({ cliente })(...c.args)).rejects.toThrow(/Não consegui pegar a vez/);
    expect(c.eventos).toEqual([]);
    expect(hashesDoMundo(c.mundo)).toEqual(antes);
  });

  it("uma atualização por vez: a 2ª chamada simultânea é recusada sem tocar o cartório", async () => {
    const c = await cenario();
    const espalhar = c.montar();
    const [a, b] = await Promise.allSettled([espalhar(...c.args), espalhar(...c.args)]);
    expect(a.status).toBe("fulfilled");
    expect(b.status === "rejected" && String(b.reason)).toMatch(/já está atualizando/);
    expect(c.eventos.filter((e) => e === "pegar")).toHaveLength(1);
    // terminada a 1ª, uma nova pode começar
    await expect(espalhar(...c.args)).resolves.toMatchObject({ estado: "atualizado" });
  });

  it("passa a pasta do servidor: mundo fora dela é recusado antes de pedir a vez (1.5b)", async () => {
    const c = await cenario();
    const fora = gerarMundo({
      tamanho: "1MB",
      semente: "A",
      pasta: join(c.base, "x", "y", "world"),
    });
    const antes = hashesDoMundo(fora);
    await expect(c.montar({ pastaDoMundo: fora })(...c.args)).rejects.toThrow(
      /dentro da pasta do servidor/,
    );
    expect(c.eventos).toEqual([]);
    expect(hashesDoMundo(fora)).toEqual(antes);
  });

  it("servidor órfão vivo (ou erro ao checar): recusa antes de pegar a vez e o mundo não muda (1.9a)", async () => {
    const c = await cenario();
    const antes = hashesDoMundo(c.mundo);
    await expect(c.montar({ servidorOrfao: async () => true })(...c.args)).rejects.toThrow(
      /sobrou um servidor/i,
    );
    await expect(
      c.montar({
        servidorOrfao: async () => {
          throw new Error("não sei");
        },
      })(...c.args),
    ).rejects.toThrow(/sobrou um servidor/i);
    expect(c.eventos).toEqual([]);
    expect(hashesDoMundo(c.mundo)).toEqual(antes);
    await expect(c.montar({ servidorOrfao: async () => false })(...c.args)).resolves.toMatchObject({
      estado: "atualizado",
    });
  });

  it("sem pastas configuradas diz o que falta e não toca o cartório", async () => {
    const c = await cenario();
    await expect(c.montar({ pastaDoServidor: undefined })(...c.args)).rejects.toThrow(/pastas/);
    expect(c.eventos).toEqual([]);
  });
});

describe("criarGatilhoEspalhar (1.9a)", () => {
  const nova = { numero: 4, manifestoSha256: "a".repeat(64) } as never;
  const copias = (pcs: { id: number; ip: string | null }[]) =>
    ({ numero: 4, nuvem: true, pcs: pcs.map((p) => ({ ...p, nome: `PC ${p.id}` })) }) as never;
  function montar(o: {
    maisNova?: unknown;
    pcs?: { id: number; ip: string | null }[];
    local?: number;
  }) {
    const chamadas: unknown[][] = [];
    const avisos: string[] = [];
    const rodar = criarGatilhoEspalhar({
      cliente: {
        maisNova: async () => (o.maisNova === undefined ? nova : o.maisNova),
        quemTem: async () => copias(o.pcs ?? []),
        eu: async () => ({ id: 1, nome: "Eu", dono: false }),
      } as never,
      versaoLocal: async () => o.local ?? 3,
      espalhar: (async (...a: unknown[]) => void chamadas.push(a)) as never,
      aoAvisar: (t) => avisos.push(t),
    });
    return { rodar, chamadas, avisos };
  }

  it("PC com ip null não derruba a lista: usa só os que têm IP, sem este PC, na porta de espalhar", async () => {
    const m = montar({
      pcs: [
        { id: 1, ip: "10.66.0.2" },
        { id: 2, ip: null },
        { id: 3, ip: "10.66.0.4" },
      ],
    });
    await m.rodar();
    expect(m.chamadas).toEqual([
      [
        { numero: 4, manifestoSha256: "a".repeat(64) },
        [{ tipo: "pc", endereco: "10.66.0.4", porta: 25570 }],
      ],
    ]);
    expect(m.avisos).toEqual([]);
  });

  it("sem versão nova, sem versão registrada ou sem fonte com IP: não faz nada e não avisa", async () => {
    for (const m of [
      montar({ local: 4, pcs: [{ id: 3, ip: "10.66.0.4" }] }),
      montar({ maisNova: null, pcs: [{ id: 3, ip: "10.66.0.4" }] }),
      montar({ pcs: [{ id: 2, ip: null }] }),
    ]) {
      await m.rodar();
      expect(m.chamadas).toEqual([]);
      expect(m.avisos).toEqual([]);
    }
  });

  it("erro do cartório ou da troca vira aviso em pt-BR e nunca lança", async () => {
    const m = montar({ pcs: [{ id: 3, ip: "10.66.0.4" }] });
    const rodar = criarGatilhoEspalhar({
      cliente: {
        maisNova: async () => {
          throw new Error("cartório fora");
        },
      } as never,
      versaoLocal: async () => 0,
      espalhar: (async () => undefined) as never,
      aoAvisar: (t) => m.avisos.push(t),
    });
    await expect(rodar()).resolves.toBeUndefined();
    expect(m.avisos).toEqual(["Atualização do mundo: cartório fora"]);
  });
});

describe("3 PCs simulados chegam à versão M (1.9a)", () => {
  it("PC 1 e PC 2 puxam de quem tem M; o mundo do host (PC 3) não muda e nenhum hash fica de fora", async () => {
    const c = await cenario();
    const hostAntes = hashesDoMundo(c.host);
    // PC 2: outra pasta, mesmo mundo velho; serve pelo PC 1 depois que ele atualizar (cadeia host → PC1 → PC2).
    const pc2 = join(c.base, "pc2");
    const mundo2 = gerarMundo({ tamanho: "1MB", semente: "A", pasta: join(pc2, "world") });
    const r1 = await c.montar()(...c.args);
    expect(r1.estado).toBe("atualizado");
    const r2 = await c.montar({
      pastaDoMundo: mundo2,
      pastaDoServidor: pc2,
      pastaTemporaria: join(c.base, "tmp2"),
    })(...c.args);
    expect(r2.estado).toBe("atualizado");
    expect(hashesDoMundo(c.mundo)).toEqual(hostAntes);
    expect(hashesDoMundo(mundo2)).toEqual(hostAntes);
    expect(hashesDoMundo(c.host)).toEqual(hostAntes);
  });
});
