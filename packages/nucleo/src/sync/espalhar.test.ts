import { existsSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gerarMundo, hashesDoMundo } from "../../test/ajuda/mundos.js";
import { gerarManifesto, type Manifesto } from "../backup/manifesto.js";
import { hashDoArquivo } from "../integridade/hash.js";
import { escolherFontes, espalhar, type Fonte, type OpcoesEspalhar } from "./espalhar.js";
import { servirArquivos, type Servidor } from "./transferencia.js";

const pastas: string[] = [];
const servidores: Servidor[] = [];
afterEach(async () => {
  for (const s of servidores.splice(0)) await s.fechar();
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

const LOOP = "127.0.0.1";
const CREDENCIAL = "token-de-teste";

/** Um PC de teste: pasta do servidor com o mundo dentro (direto), e, se tiver M, serve os arquivos por hash. */
async function pc(nome: string, semente: string, base: string) {
  const pastaDoServidor = join(base, nome);
  const mundo = gerarMundo({ tamanho: "1MB", semente, pasta: join(pastaDoServidor, "world") });
  return { nome, pastaDoServidor, mundo };
}

async function servirMundo(mundo: string, manifesto: Manifesto) {
  const porHash = new Map<string, string>();
  for (const a of manifesto.arquivos) porHash.set(a.sha256, join(mundo, a.caminho));
  const arquivoManifesto = join(mundo, "..", `manifesto-v${manifesto.versao}.json`);
  writeFileSync(arquivoManifesto, JSON.stringify(manifesto));
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
  return { servidor, manifestoSha256 };
}

/** N (semente A) nos três PCs; M = N com uma região mudada, uma nova e uma apagada, só no host. */
async function cenario() {
  const base = mkdtempSync(join(tmpdir(), "sabre-espalhar-"));
  pastas.push(base);
  const host = await pc("host", "A", base);
  const pc1 = await pc("pc1", "A", base);
  const pc2 = await pc("pc2", "A", base);
  writeFileSync(join(host.mundo, "region", "r.0.0.mca"), "região mudada no host");
  writeFileSync(join(host.mundo, "region", "r.9.9.mca"), "região nova");
  rmSync(join(host.mundo, "region", "r.1.0.mca"));
  const alvo = await gerarManifesto(host.mundo, { versao: 7, epoca: 2 });
  const { servidor, manifestoSha256 } = await servirMundo(host.mundo, alvo);
  const doHost: Fonte = { tipo: "host", endereco: LOOP, porta: servidor.porta };
  const opcoes = (
    p: { pastaDoServidor: string; mundo: string },
    fontes: Fonte[],
  ): OpcoesEspalhar => ({
    pastaDoMundo: p.mundo,
    pastaDoServidor: p.pastaDoServidor,
    pastaTemporaria: join(base, `tmp-${p.pastaDoServidor.split(/[\\/]/).pop()}`),
    versao: { numero: 7, manifestoSha256 },
    versaoLocal: 6,
    fontes,
    token: CREDENCIAL,
    permitirLoopbackParaTeste: true,
    temTrava: async () => true,
    servidorParado: () => true,
    avisarCopia: vi.fn(async () => undefined),
  });
  return { base, host, pc1, pc2, alvo, doHost, opcoes, manifestoSha256 };
}

const sobras = (pasta: string) => readdirSync(pasta).filter((n) => n.startsWith("world."));

describe("escolherFontes", () => {
  it("PCs antes do host, sem repetir o mesmo endereço, e vazia é erro", () => {
    const h: Fonte = { tipo: "host", endereco: "10.66.0.2", porta: 1 };
    const a: Fonte = { tipo: "pc", endereco: "10.66.0.3", porta: 1 };
    const b: Fonte = { tipo: "pc", endereco: "10.66.0.4", porta: 1 };
    expect(escolherFontes([h, a, { ...a }, b])).toEqual([a, b, h]);
    expect(() => escolherFontes([])).toThrow(/nenhum PC/i);
  });

  it("recusa endereço fora da rede privada (entrada não confiável)", () => {
    expect(() => escolherFontes([{ tipo: "pc", endereco: "8.8.8.8", porta: 25000 }])).toThrow(
      /10\.66\.0/,
    );
  });
});

describe("espalhar", () => {
  it("3 PCs simulados: todos chegam a M (o 2º puxa do 1º, sem o host)", async () => {
    const c = await cenario();
    const o1 = c.opcoes(c.pc1, [c.doHost]);
    const r1 = await espalhar(o1);
    expect(r1.estado).toBe("atualizado");
    expect(r1.arquivosBaixados).toBe(2); // só o que mudou
    expect(hashesDoMundo(c.pc1.mundo)).toEqual(hashesDoMundo(c.host.mundo));
    expect(o1.avisarCopia).toHaveBeenCalledWith(7);

    // O PC 1 agora também serve M; o host sai do ar e o PC 2 puxa do PC 1.
    const { servidor } = await servirMundo(c.pc1.mundo, c.alvo);
    await servidores[0]?.fechar();
    const o2 = c.opcoes(c.pc2, [{ tipo: "pc", endereco: LOOP, porta: servidor.porta }]);
    const r2 = await espalhar(o2);
    expect(r2.estado).toBe("atualizado");
    expect(hashesDoMundo(c.pc2.mundo)).toEqual(hashesDoMundo(c.host.mundo));
    expect(o2.avisarCopia).toHaveBeenCalledWith(7);
    expect(sobras(c.pc1.pastaDoServidor)).toEqual([]);
    expect(sobras(c.pc2.pastaDoServidor)).toEqual([]);
  });

  it("fonte que não responde cai para a próxima", async () => {
    const c = await cenario();
    const morta: Fonte = { tipo: "pc", endereco: LOOP, porta: 1 };
    const o = c.opcoes(c.pc1, [morta, c.doHost]);
    const r = await espalhar({ ...o, tentativas: 1 });
    expect(r.estado).toBe("atualizado");
    expect(hashesDoMundo(c.pc1.mundo)).toEqual(hashesDoMundo(c.host.mundo));
  });

  it("queda no meio do download deixa a versão N intacta, sem sobras e sem avisar o cartório", async () => {
    const c = await cenario();
    const antes = hashesDoMundo(c.pc1.mundo);
    let chamadas = 0;
    const o = c.opcoes(c.pc1, [c.doHost]);
    const r = espalhar({
      ...o,
      tentativas: 1,
      aoBaixar: () => {
        if (++chamadas === 2) throw new Error("rede caiu");
      },
    });
    await expect(r).rejects.toThrow();
    expect(hashesDoMundo(c.pc1.mundo)).toEqual(antes);
    expect(sobras(c.pc1.pastaDoServidor)).toEqual([]);
    expect(o.avisarCopia).not.toHaveBeenCalled();
    expect(existsSync(join(c.pc1.pastaDoServidor, "TROCA-EM-ANDAMENTO.json"))).toBe(false);
  });

  it("recusa mundo fora da pasta do servidor e não mexe em nada", async () => {
    const c = await cenario();
    const fora = gerarMundo({
      tamanho: "1MB",
      semente: "A",
      pasta: join(c.base, "solto", "a", "world"),
    });
    const antes = hashesDoMundo(fora);
    const o = { ...c.opcoes(c.pc1, [c.doHost]), pastaDoMundo: fora };
    await expect(espalhar(o)).rejects.toThrow(/dentro da pasta do servidor/);
    expect(hashesDoMundo(fora)).toEqual(antes);
    expect(o.avisarCopia).not.toHaveBeenCalled();
  });

  it("manifesto de outra versão que a do cartório é recusado (versão manda)", async () => {
    const c = await cenario();
    const antes = hashesDoMundo(c.pc1.mundo);
    const o = c.opcoes(c.pc1, [c.doHost]);
    await expect(espalhar({ ...o, versao: { ...o.versao, numero: 8 } })).rejects.toThrow(/versão/i);
    expect(hashesDoMundo(c.pc1.mundo)).toEqual(antes);
  });

  it("já tem a versão (ou mais nova): não baixa nada", async () => {
    const c = await cenario();
    const o = c.opcoes(c.pc1, [c.doHost]);
    const r = await espalhar({ ...o, versaoLocal: 7 });
    expect(r.estado).toBe("ja-tinha");
    expect(o.avisarCopia).not.toHaveBeenCalled();
  });

  it("servidor rodando neste PC: não troca o mundo", async () => {
    const c = await cenario();
    const antes = hashesDoMundo(c.pc1.mundo);
    const o = c.opcoes(c.pc1, [c.doHost]);
    await expect(espalhar({ ...o, servidorParado: () => false })).rejects.toThrow(/servidor/i);
    expect(hashesDoMundo(c.pc1.mundo)).toEqual(antes);
  });

  it("sem a trava confirmada não troca o mundo (regra de ouro 1)", async () => {
    const c = await cenario();
    const antes = hashesDoMundo(c.pc1.mundo);
    const o = c.opcoes(c.pc1, [c.doHost]);
    await expect(espalhar({ ...o, temTrava: async () => false, prazoTravaMs: 50 })).rejects.toThrow(
      /trava/i,
    );
    expect(hashesDoMundo(c.pc1.mundo)).toEqual(antes);
    // a pasta temporária do manifesto não sobra
    expect(readdirSync(c.base).filter((n) => n.startsWith("tmp-pc1"))).toEqual([]);
  });
});
