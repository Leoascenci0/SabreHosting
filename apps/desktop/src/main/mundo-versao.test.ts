import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hashesDoMundo } from "../../../../packages/nucleo/test/ajuda/mundos.js";
import { escreverRegiao } from "../../../../packages/nucleo/test/ajuda/regiao-mca.js";
import { resetarMundo } from "@sabrehosting/nucleo/mundo/resetar";
import { MARCADOR_VERSAO_PENDENTE } from "@sabrehosting/nucleo/servidor/configurar";
import { ErroCartorio } from "@sabrehosting/nucleo/cartorio/cliente";
import { depsMundoVersao } from "./mundo-versao.js";

const pastas: string[] = [];
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

async function cenario() {
  const base = mkdtempSync(join(tmpdir(), "sabre-mundo-versao-"));
  pastas.push(base);
  const servidor = join(base, "servidor");
  const mundo = join(servidor, "mundo");
  const backups = join(base, "backups");
  mkdirSync(backups);
  mkdirSync(mundo, { recursive: true });
  writeFileSync(join(mundo, "level.dat"), "level-falso");
  for (const t of ["region", "entities", "poi"])
    escreverRegiao(join(mundo, t, "r.0.0.mca"), [0, 1, 33, 500], undefined, 8);
  const antes = hashesDoMundo(mundo);
  const ev: string[] = [];
  const est = { ultimo: 7, guardada: 7, fora: false, criar: 0 };
  const cai = () => {
    if (est.fora) throw new ErroCartorio("sem resposta", "rede");
  };
  const cliente = {
    pegar: async () => (
      ev.push("pegar"),
      { ok: true as const, epoca: 3, expiraEm: 0, renovarMs: 20_000 }
    ),
    renovar: async () => ({ ok: true as const, epoca: 3, expiraEm: 0, renovarMs: 20_000 }),
    soltar: async () => (
      ev.push("soltar"),
      { ok: true as const, epoca: 4, expiraEm: 0, renovarMs: 20_000 }
    ),
    estadoTrava: async () => ({ epoca: 3 }),
    ultimoRegistrado: async () => (cai(), est.ultimo),
    maisNova: async () => (cai(), null),
    criarVersao: async () => (cai(), est.criar++, ++est.ultimo),
    enviarPacote: async (n: number) => (cai(), void (est.guardada = n)),
  };
  let rodando = false;
  const d = depsMundoVersao({
    pastaBackups: backups,
    pastaDoMundo: mundo,
    pastaDoServidor: servidor,
    cliente,
    servidorRodando: () => rodando,
  });
  await resetarMundo({
    pastaDoMundo: mundo,
    pastaDoServidor: servidor,
    pastaBackups: backups,
    dimensao: "overworld",
    area: { tipo: "retangulo", x1: 0, z1: 0, x2: 1, z2: 0 },
    versao: 7,
    epoca: 3,
    temTrava: async () => true,
    servidorParado: () => true,
  });
  return { d, ev, est, cliente, mundo, servidor, antes, ligar: (v: boolean) => (rodando = v) };
}

describe("depsMundoVersao", () => {
  it("publicar: pega a vez uma vez, sobe a versão uma vez e solta", async () => {
    const c = await cenario();
    expect(await c.d.publicar()).toEqual({ estado: "publicada", versao: 8 });
    expect(c.est.criar).toBe(1);
    expect(c.ev).toEqual(["pegar", "soltar"]);
  });

  it("desfazer: restaura e publica N+1 dentro de UMA vez só", async () => {
    const c = await cenario();
    await c.d.publicar();
    c.ev.length = 0;
    const r = await c.d.desfazer();
    expect(r.feito).toBe(true);
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
    expect(c.est.guardada).toBe(9);
    expect(c.ev).toEqual(["pegar", "soltar"]);
  });

  it("sem cartório: pendente com aviso; depois a retomada conclui e solta o servidor", async () => {
    const c = await cenario();
    c.est.fora = true;
    // Sem cartório nem a vez se pega de verdade: aqui só o registro da versão cai.
    const r = await c.d.publicar();
    expect(r.estado).toBe("pendente");
    expect(existsSync(join(c.servidor, MARCADOR_VERSAO_PENDENTE))).toBe(true);
    c.est.fora = false;
    expect(await c.d.retomar()).toEqual({ estado: "publicada", versao: 8 });
    expect(existsSync(join(c.servidor, MARCADOR_VERSAO_PENDENTE))).toBe(false);
    expect(c.est.criar).toBe(1);
  });

  it("sem poder pegar a vez: o reset fica local, grava o pendente e avisa", async () => {
    const c = await cenario();
    c.cliente.pegar = async () => {
      throw new Error("sem rede");
    };
    const r = await c.d.publicar();
    expect(r.estado).toBe("pendente");
    expect(existsSync(join(c.servidor, MARCADOR_VERSAO_PENDENTE))).toBe(true);
    expect(c.est.criar).toBe(0);
  });

  it("protegerTroca: marcador antes da troca; falha na troca deixa o servidor bloqueado; descartar libera", async () => {
    const c = await cenario();
    await c.d.publicar();
    const marca = join(c.servidor, MARCADOR_VERSAO_PENDENTE);
    let viuMarcador = false;
    const ok = await c.d.protegerTroca(async () => {
      viuMarcador = existsSync(marca);
      return 42;
    });
    expect(viuMarcador).toBe(true);
    expect(ok.resultado).toBe(42);
    expect(ok.publicacao.estado).toBe("publicada");
    expect(existsSync(marca)).toBe(false);
    await expect(
      c.d.protegerTroca(async () => {
        throw new Error("falhou");
      }),
    ).rejects.toThrow("falhou");
    expect(existsSync(marca)).toBe(true);
    await c.d.descartar();
    expect(existsSync(marca)).toBe(false);
  });

  it("servidor no ar recusa sem pegar a vez", async () => {
    const c = await cenario();
    c.ligar(true);
    await expect(c.d.publicar()).rejects.toThrow(/ainda está no ar/);
    await expect(c.d.desfazer()).rejects.toThrow(/ainda está no ar/);
    expect(c.ev).toEqual([]);
  });
});
