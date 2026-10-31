import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gerarMundo, hashesDoMundo, mudarRegioes } from "../../test/ajuda/mundos.js";
import { gerarManifesto, type Manifesto } from "../backup/manifesto.js";
import type { RespostaAtualizacao } from "../cartorio/tipos.js";
import { hashDoArquivo } from "../integridade/hash.js";
import type { Fonte, OpcoesEspalhar } from "../sync/espalhar.js";
import { servirArquivos, type Servidor } from "../sync/transferencia.js";
import { medirDeltaFinal, pedirPreCopia } from "./precopia.js";

const pastas: string[] = [];
const servidores: Servidor[] = [];
afterEach(async () => {
  for (const s of servidores.splice(0)) await s.fechar();
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

const LOOP = "127.0.0.1";
const CREDENCIAL = "token-de-teste";
const KB = 1024;

const manifesto = (versao: number, arquivos: [string, number, string][]): Manifesto => ({
  formato: 1,
  versao,
  epoca: 1,
  criadoEm: "2026-10-31T00:00:00.000Z",
  arquivos: arquivos.map(([caminho, tamanho, letra]) => ({
    caminho,
    tamanho,
    sha256: letra.repeat(64),
  })),
});

describe("medirDeltaFinal", () => {
  it("soma só novos e mudados, dá a porcentagem do mundo final e o tempo previsto", () => {
    const local = manifesto(7, [
      ["level.dat", 1 * KB, "a"],
      ["region/r.0.0.mca", 256 * KB, "b"],
      ["region/r.1.0.mca", 256 * KB, "c"],
      ["region/r.2.0.mca", 256 * KB, "d"],
    ]);
    const final = manifesto(8, [
      ["level.dat", 1 * KB, "a"], // igual
      ["region/r.0.0.mca", 256 * KB, "e"], // mudou
      ["region/r.1.0.mca", 256 * KB, "c"], // igual
      ["region/r.9.9.mca", 255 * KB, "f"], // nova (r.2.0 apagada: não pesa)
    ]);
    const d = medirDeltaFinal(local, final, 1024 * KB);
    expect(d.arquivos).toBe(2);
    expect(d.bytes).toBe(511 * KB);
    expect(d.bytesDoMundo).toBe(768 * KB);
    expect(d.porcento).toBeCloseTo((511 / 768) * 100, 6);
    expect(d.tempoPrevistoMs).toBe(Math.ceil((511 / 1024) * 1000));
  });

  it("sem vazão medida não inventa tempo; mundo igual é delta zero", () => {
    const m = manifesto(7, [["level.dat", KB, "a"]]);
    expect(medirDeltaFinal(m, m)).toEqual({
      arquivos: 0,
      bytes: 0,
      bytesDoMundo: KB,
      porcento: 0,
      tempoPrevistoMs: null,
    });
    expect(medirDeltaFinal(m, { ...m, arquivos: [] }).porcento).toBe(0);
  });
});

/** Cartório falso da trava de atualização (a de host não entra: migra-2.2). */
function cartorioFalso() {
  const eventos: string[] = [];
  let epoca = 0;
  const ok = (e: number): RespostaAtualizacao => ({
    ok: true,
    epoca: e,
    expiraEm: 0,
    renovarMs: 20_000,
  });
  return {
    eventos,
    cliente: {
      pegar: async () => (eventos.push("pegar"), ok(++epoca)),
      renovar: async (e: number) => (eventos.push(`renovar ${e}`), ok(e)),
      soltar: async (e: number) => (eventos.push(`soltar ${e}`), ok(e)),
    },
  };
}

/** O host joga e serve (por hash) o último backup bom, versão 7; o candidato está parado, com outro mundo (v6). */
async function cenario() {
  const base = mkdtempSync(join(tmpdir(), "sabre-precopia-"));
  pastas.push(base);
  const hostVivo = gerarMundo({
    tamanho: "20MB",
    semente: "M",
    pasta: join(base, "host", "world"),
  });
  const backupBom = gerarMundo({ tamanho: "20MB", semente: "M", pasta: join(base, "backup-v7") });
  const candidato = join(base, "candidato");
  const mundoCandidato = gerarMundo({
    tamanho: "20MB",
    semente: "N",
    pasta: join(candidato, "world"),
  });
  const m7 = await gerarManifesto(backupBom, { versao: 7, epoca: 3 });

  const porHash = new Map(m7.arquivos.map((a) => [a.sha256, join(backupBom, a.caminho)]));
  const arquivoManifesto = join(base, "manifesto-v7.json");
  writeFileSync(arquivoManifesto, JSON.stringify(m7));
  const manifestoSha256 = await hashDoArquivo(arquivoManifesto);
  porHash.set(manifestoSha256, arquivoManifesto);
  const servidor = await servirArquivos({
    endereco: LOOP,
    porta: 0,
    permitirLoopbackParaTeste: true,
    conferirToken: async (t) => (t === CREDENCIAL ? "pc" : null),
    arquivos: (h) => {
      const caminho = porHash.get(h);
      return caminho ? { caminho } : undefined;
    },
  });
  servidores.push(servidor);
  const doHost: Fonte = { tipo: "host", endereco: LOOP, porta: servidor.porta };
  const cartorio = cartorioFalso();
  const opcoes: OpcoesEspalhar = {
    pastaDoMundo: mundoCandidato,
    pastaDoServidor: candidato,
    pastaTemporaria: join(base, "tmp-candidato"),
    versao: { numero: 7, manifestoSha256 },
    versaoLocal: 6,
    fontes: [doHost],
    token: CREDENCIAL,
    permitirLoopbackParaTeste: true,
    atualizacao: cartorio.cliente,
    hospedaAgora: async () => false,
    servidorParado: () => true,
    avisarCopia: vi.fn(async () => undefined),
  };
  return { hostVivo, mundoCandidato, m7, opcoes, cartorio };
}

// Mundo de 20 MB puxado pela rede local e conferido por hash: prazo explícito (S-01), não afrouxa o que se prova.
const PRAZO = 60_000;

describe("pedirPreCopia", () => {
  it(
    "após a pré-cópia, delta final < 5% do mundo de teste (host ativo como fonte, candidato parado)",
    async () => {
      const c = await cenario();
      const antesDoHost = hashesDoMundo(c.hostVivo);
      const antesDaPreCopia = await gerarManifesto(c.mundoCandidato, { versao: 6, epoca: 0 });

      const r = await pedirPreCopia(c.opcoes);
      expect(r.estado).toBe("atualizado");
      expect(r.bytesBaixados).toBeGreaterThan(0);
      expect(r.manifesto.versao).toBe(7);
      expect(hashesDoMundo(c.mundoCandidato)).toEqual(hashesDoMundo(c.hostVivo));
      expect(hashesDoMundo(c.hostVivo)).toEqual(antesDoHost); // o mundo que roda nunca é tocado
      expect(c.cartorio.eventos[0]).toBe("pegar");
      expect(c.cartorio.eventos.at(-1)).toMatch(/^soltar/);

      // O host continua jogando: 1 região muda; o backup final (v8) é o que o delta final leva.
      mudarRegioes(c.hostVivo, 1);
      const final = await gerarManifesto(c.hostVivo, { versao: 8, epoca: 3 });
      const delta = medirDeltaFinal(r.manifesto, final, r.bytesPorSegundo ?? undefined);
      expect(delta.arquivos).toBe(1);
      expect(delta.porcento).toBeLessThan(5);
      // Sem a pré-cópia o delta final seria o mundo quase inteiro.
      expect(medirDeltaFinal(antesDaPreCopia, final).porcento).toBeGreaterThan(90);
    },
    PRAZO,
  );

  it(
    "candidato que já tem a versão não baixa nada e devolve o manifesto da própria pasta",
    async () => {
      const c = await cenario();
      await pedirPreCopia(c.opcoes);
      const r = await pedirPreCopia({ ...c.opcoes, versaoLocal: 7 });
      expect(r.estado).toBe("ja-tinha");
      expect(r.bytesBaixados).toBe(0);
      expect(r.bytesPorSegundo).toBeNull();
      expect(medirDeltaFinal(r.manifesto, c.m7).bytes).toBe(0);
    },
    PRAZO,
  );

  it(
    "candidato que já tem a versão recusa se o cartório diz que ele hospeda: não lê o mundo",
    async () => {
      const c = await cenario();
      await pedirPreCopia(c.opcoes);
      await expect(
        pedirPreCopia({
          ...c.opcoes,
          versaoLocal: 7,
          hospedaAgora: async () => true,
          prazoTravaMs: 50,
        }),
      ).rejects.toThrow(/hospedando/);
    },
    PRAZO,
  );

  it(
    "recusa com o servidor do candidato rodando: nada pego no cartório, mundo intacto",
    async () => {
      const c = await cenario();
      const antes = hashesDoMundo(c.mundoCandidato);
      for (const versaoLocal of [6, 7]) {
        await expect(
          pedirPreCopia({ ...c.opcoes, versaoLocal, servidorParado: () => false }),
        ).rejects.toThrow(/servidor está rodando/);
      }
      expect(c.cartorio.eventos).toEqual([]);
      expect(hashesDoMundo(c.mundoCandidato)).toEqual(antes);
      expect(c.opcoes.avisarCopia).not.toHaveBeenCalled();
    },
    PRAZO,
  );
});
