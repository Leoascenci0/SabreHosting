import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { gerarMundo, hashesDoMundo } from "../../../../packages/nucleo/test/ajuda/mundos.js";
import { criarPacote } from "@sabrehosting/nucleo/backup/pacote";
import { marcarBackup } from "@sabrehosting/nucleo/backup/rotacao-pasta";
import { espalhar } from "@sabrehosting/nucleo/sync/espalhar";
import {
  conferirTokenNoCartorio,
  criarServidorDeArquivos,
  ipDaRedePrivada,
  type ServidorDeArquivos,
} from "./servir-arquivos.js";

const pastas: string[] = [];
const abertos: ServidorDeArquivos[] = [];
afterEach(async () => {
  for (const s of abertos.splice(0)) await s.fechar();
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});
const tmp = () => {
  const p = mkdtempSync(join(tmpdir(), "sabre-servir-"));
  pastas.push(p);
  return p;
};

describe("ipDaRedePrivada", () => {
  const i = (address: string, family: "IPv4" | "IPv6" = "IPv4") =>
    ({ address, family, internal: false }) as never;
  it("acha o IP da faixa 10.66.0.2–199 e ignora o resto", () => {
    expect(ipDaRedePrivada({ eth0: [i("192.168.0.5")], sabre: [i("10.66.0.7")] })).toBe(
      "10.66.0.7",
    );
    expect(
      ipDaRedePrivada({ eth0: [i("192.168.0.5"), i("10.66.0.1")], lo: [i("127.0.0.1")] }),
    ).toBeUndefined();
    expect(ipDaRedePrivada({})).toBeUndefined();
    expect(ipDaRedePrivada({ sabre: [i("10.66.0.200")] })).toBeUndefined(); // fora de 2–199
    expect(ipDaRedePrivada({ sabre: [i("10.66.0.7", "IPv6")] })).toBeUndefined();
  });
  it("aceita só a interface do WireGuard (sabre): outra placa com IP da faixa não vale", () => {
    expect(ipDaRedePrivada({ Ethernet: [i("10.66.0.9")] })).toBeUndefined();
    expect(ipDaRedePrivada({ Ethernet: [i("10.66.0.9")], sabre: [i("10.66.0.7")] })).toBe(
      "10.66.0.7",
    );
  });
});

describe("conferirTokenNoCartorio", () => {
  const resp = (status: number, corpo: unknown = {}) =>
    (async () => new Response(JSON.stringify(corpo), { status })) as typeof fetch;
  it("200 → id do PC; 401 → null; cartório fora → lança (nunca aceita sem conferir)", async () => {
    const url = "http://10.66.0.1:8080";
    expect(
      await conferirTokenNoCartorio(url, resp(200, { id: 3, nome: "x", dono: false }))("t"),
    ).toBe("3");
    expect(await conferirTokenNoCartorio(url, resp(401))("t")).toBeNull();
    await expect(conferirTokenNoCartorio(url, resp(503))("t")).rejects.toThrow();
  });
});

describe("criarServidorDeArquivos (1.10)", () => {
  async function cenario(endereco: string | undefined) {
    const base = tmp();
    const mundo = gerarMundo({ tamanho: "1MB", semente: "S", pasta: join(base, "srv", "world") });
    const pastaBackups = join(base, "backups");
    const p = await criarPacote(mundo, join(pastaBackups, "2026-10-31T10-00-00-000Z-v4.tar.gz"), {
      versao: 4,
      epoca: 1,
    });
    marcarBackup(pastaBackups, "2026-10-31T10-00-00-000Z-v4.tar.gz", "bom", p.sha256);
    const avisos: string[] = [];
    const s = criarServidorDeArquivos({
      endereco: () => endereco,
      conferirToken: async (t) => (t === "tk" ? "pc" : null),
      pastaBackups,
      pastaVitrine: join(base, "vitrine"),
      aoAvisar: (t) => avisos.push(t),
      porta: 0,
      permitirLoopbackParaTeste: true,
    });
    abertos.push(s);
    return { base, mundo, p, s, avisos };
  }

  it("2 PCs simulados: um serve a vitrine do backup bom, o outro atualiza (mundo inventado)", async () => {
    const c = await cenario("127.0.0.1");
    await c.s.publicarUltimoBom();
    expect(await c.s.ligar()).toBe(true);
    const local = gerarMundo({ tamanho: "1MB", semente: "S", pasta: join(c.base, "pc2", "world") });
    writeFileSync(join(local, "level.dat"), "velho");
    const eventos: string[] = [];
    const ok = { ok: true as const, epoca: 1, expiraEm: 0, renovarMs: 20_000 };
    const r = await espalhar({
      pastaDoMundo: local,
      pastaDoServidor: join(c.base, "pc2"),
      pastaTemporaria: join(c.base, "tmp"),
      versao: { numero: 4, manifestoSha256: c.p.manifesto.sha256 },
      versaoLocal: 3,
      fontes: [{ tipo: "pc", endereco: "127.0.0.1", porta: c.s.porta() ?? 0 }],
      token: "tk",
      atualizacao: {
        pegar: async () => ok,
        renovar: async () => ok,
        soltar: async () => (eventos.push("soltar"), ok),
      },
      hospedaAgora: async () => false,
      servidorParado: () => true,
      avisarCopia: async (n) => void eventos.push(`copia ${n}`),
      permitirLoopbackParaTeste: true,
    });
    expect(r.estado).toBe("atualizado");
    expect(hashesDoMundo(local)).toEqual(hashesDoMundo(c.mundo));
  });

  it("sem IP na rede privada não liga e avisa", async () => {
    const c = await cenario(undefined);
    expect(await c.s.ligar()).toBe(false);
    expect(c.avisos.join(" ")).toMatch(/rede privada/);
    expect(c.s.porta()).toBeUndefined();
  });

  it("túnel que sobe depois do arranque: relê o IP, liga e publica; o aviso sai uma vez só", async () => {
    const base = tmp();
    const avisos: string[] = [];
    let ip = undefined as string | undefined;
    const s = criarServidorDeArquivos({
      endereco: () => ip,
      conferirToken: async () => null,
      pastaBackups: join(base, "b"),
      pastaVitrine: join(base, "v"),
      aoAvisar: (t) => avisos.push(t),
      porta: 0,
      permitirLoopbackParaTeste: true,
    });
    abertos.push(s);
    expect(await s.tentarLigar()).toBe(false);
    expect(await s.tentarLigar()).toBe(false);
    expect(avisos).toHaveLength(1);
    ip = "127.0.0.1"; // o túnel subiu
    expect(await s.tentarLigar()).toBe(true);
    expect(s.porta()).toBeDefined();
  });

  it("endereço fora da rede privada (0.0.0.0, LAN, internet) é recusado, nada escuta", async () => {
    for (const ruim of ["0.0.0.0", "192.168.0.5", "8.8.8.8", "10.66.0.1"]) {
      const base = tmp();
      const avisos: string[] = [];
      const s = criarServidorDeArquivos({
        endereco: () => ruim,
        conferirToken: async () => null,
        pastaBackups: join(base, "b"),
        pastaVitrine: join(base, "v"),
        aoAvisar: (t) => avisos.push(t),
      });
      expect(await s.ligar()).toBe(false);
      expect(s.porta()).toBeUndefined();
      expect(avisos.join(" ")).toMatch(/recusado/);
    }
  });

  it("ligar duas vezes não abre outro servidor; sem backup bom a vitrine fica vazia", async () => {
    const c = await cenario("127.0.0.1");
    expect(await c.s.ligar()).toBe(true);
    const porta = c.s.porta();
    expect(await c.s.ligar()).toBe(true);
    expect(c.s.porta()).toBe(porta);
    expect(c.s.vitrine.arquivos(c.p.manifesto.sha256)).toBeUndefined(); // ainda não publicou
  });

  it("backup só marcado 'ruim' ou sem marca não vai para a vitrine", async () => {
    const c = await cenario("127.0.0.1");
    marcarBackup(join(c.base, "backups"), "2026-10-31T10-00-00-000Z-v4.tar.gz", "ruim", c.p.sha256);
    await c.s.publicarUltimoBom();
    expect(c.s.vitrine.arquivos(c.p.manifesto.sha256)).toBeUndefined();
  });
});
