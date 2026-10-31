import { copyFileSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gerarMundo, hashesDoMundo } from "../../test/ajuda/mundos.js";
import { type Manifesto } from "../backup/manifesto.js";
import { abrirPacote, criarPacote } from "../backup/pacote.js";
import type { Copias, RespostaAtualizacao } from "../cartorio/tipos.js";
import { alcancar, MAX_PASSOS, type OpcoesAlcancar } from "./alcancar.js";
import { ErroLocal } from "./aplicar.js";
import { espalhar, type Fonte, type OpcoesEspalhar } from "./espalhar.js";
import { servirArquivos, type Servidor } from "./transferencia.js";

const pastas: string[] = [];
const servidores: Servidor[] = [];
afterEach(async () => {
  for (const s of servidores.splice(0)) await s.fechar();
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

const CREDENCIAL = "token-de-teste";
const ok = (epoca: number): RespostaAtualizacao => ({
  ok: true,
  epoca,
  expiraEm: 0,
  renovarMs: 20_000,
});

/** Um grupo inventado: este PC na v10; o mundo do grupo na v300 (mundo e pacote gerados aqui). */
async function grupo(opcoes: { pcOnline: boolean; nuvem: boolean }) {
  const base = mkdtempSync(join(tmpdir(), "sabre-alcancar-"));
  pastas.push(base);
  const servidorLocal = join(base, "este");
  const meu = gerarMundo({ tamanho: "1MB", semente: "A", pasta: join(servidorLocal, "world") });
  const doGrupo = gerarMundo({ tamanho: "1MB", semente: "A", pasta: join(base, "grupo", "world") });
  writeFileSync(join(doGrupo, "region", "r.0.0.mca"), "região mudada depois de muito tempo");
  const pacote = await criarPacote(doGrupo, join(base, "nuvem-v300.tar.gz"), {
    versao: 300,
    epoca: 5,
  });
  // PC online: serve os arquivos por hash em porta local (o cartório diria o IP da rede privada).
  const manifesto: Manifesto = await abrirPacote(
    pacote.caminho,
    pacote.sha256,
    join(base, "aberto"),
  );
  const arquivoManifesto = join(base, "manifesto.json");
  writeFileSync(arquivoManifesto, JSON.stringify(manifesto));
  const porHash = new Map(manifesto.arquivos.map((a) => [a.sha256, join(doGrupo, a.caminho)]));
  // O cartório registra o hash do manifesto do pacote; o PC serve o mesmo manifesto sob esse hash.
  porHash.set(pacote.manifesto.sha256, arquivoManifesto);
  const servidor = await servirArquivos({
    endereco: "127.0.0.1",
    porta: 0,
    permitirLoopbackParaTeste: true,
    conferirToken: async (t) => (t === CREDENCIAL ? "pc" : null),
    arquivos: (h) => {
      const caminho = porHash.get(h);
      return caminho ? { caminho } : undefined;
    },
  });
  servidores.push(servidor);

  const versaoMaisNova = { numero: 300, manifestoSha256: pacote.manifesto.sha256 };
  const copias: Copias = {
    numero: 300,
    nuvem: opcoes.nuvem,
    pcs: opcoes.pcOnline ? [{ id: 2, nome: "PC do Lucas", ip: "10.66.0.3" }] : [],
  } as Copias;
  const pegou: string[] = [];
  const baixarPacote = vi.fn(
    async (
      _n: number,
      destino: string,
      _maximo?: number,
      _sinal?: AbortSignal,
      aoBytes?: (feitos: number, total: number) => void,
    ) => {
      void aoBytes;
      copyFileSync(pacote.caminho, destino);
      return { sha256: pacote.sha256 };
    },
  );
  const cliente = {
    maisNova: vi.fn(async () => ({
      ...versaoMaisNova,
      epoca: 5,
      pcId: 2,
      arquivos: 0,
      bytes: 0,
      criadaEm: 0,
    })),
    quemTem: vi.fn(async () => copias),
    eu: vi.fn(async () => ({ id: 1, nome: "Este PC", dono: false })),
    baixarPacote,
  };
  const avisarCopia = vi.fn(async () => undefined);
  const noEspalhar = vi.fn();
  /** `espalhar` real; só troca o IP de 10.66.0.3 pela porta local do servidor de teste. */
  const executar: OpcoesAlcancar["espalhar"] = async (versao, fontes, nuvem, aoProgresso) => {
    noEspalhar(fontes.length, nuvem !== undefined);
    const locais: Fonte[] = fontes.map(() => ({
      tipo: "pc",
      endereco: "127.0.0.1",
      porta: servidor.porta,
    }));
    const o: OpcoesEspalhar = {
      pastaDoMundo: meu,
      pastaDoServidor: servidorLocal,
      pastaTemporaria: join(base, "tmp"),
      versao,
      versaoLocal: 10,
      fontes: locais,
      ...(nuvem ? { nuvem } : {}),
      ...(aoProgresso ? { aoProgresso } : {}),
      token: CREDENCIAL,
      permitirLoopbackParaTeste: true,
      atualizacao: {
        pegar: async () => (pegou.push("pegar"), ok(1)),
        renovar: async (e) => ok(e),
        soltar: async (e) => (pegou.push("soltar"), ok(e)),
      },
      hospedaAgora: async () => false,
      servidorParado: () => true,
      avisarCopia,
    };
    return espalhar(o);
  };
  return { base, meu, doGrupo, cliente, executar, avisarCopia, noEspalhar, pegou, pacote };
}

describe("alcancar", () => {
  it("PC na v10, grupo na v300, só a nuvem online → chega à 300 (progresso até 100%)", async () => {
    const g = await grupo({ pcOnline: false, nuvem: true });
    const percentuais: (number | undefined)[] = [];
    const r = await alcancar({
      cliente: g.cliente,
      espalhar: g.executar,
      versaoLocal: async () => 10,
      aoProgresso: (p) => percentuais.push(p),
    });
    expect(r).toEqual({ versao: 300, passos: 1 });
    expect(hashesDoMundo(g.meu)).toEqual(hashesDoMundo(g.doGrupo));
    expect(g.noEspalhar).toHaveBeenCalledWith(0, true);
    expect(g.avisarCopia).toHaveBeenCalledWith(300);
    expect(g.pegou).toEqual(["pegar", "soltar"]); // trava de atualização pega e devolvida
    expect(percentuais[0]).toBe(0);
    expect(percentuais).toContain(100);
    expect(percentuais.at(-1)).toBeUndefined(); // terminou: a tela volta ao normal
  });

  it("com PC online puxa dele e não toca a nuvem", async () => {
    const g = await grupo({ pcOnline: true, nuvem: true });
    await alcancar({ cliente: g.cliente, espalhar: g.executar, versaoLocal: async () => 10 });
    expect(hashesDoMundo(g.meu)).toEqual(hashesDoMundo(g.doGrupo));
    expect(g.noEspalhar).toHaveBeenCalledTimes(1);
    expect(g.noEspalhar).toHaveBeenCalledWith(1, false);
    expect(g.cliente.baixarPacote).not.toHaveBeenCalled();
  });

  it("PC falha → cai para a nuvem e ainda chega à 300", async () => {
    const g = await grupo({ pcOnline: true, nuvem: true });
    let primeira = true;
    const r = await alcancar({
      cliente: g.cliente,
      espalhar: async (v, f, n, p) => {
        if (primeira) {
          primeira = false;
          throw new Error("PC caiu no meio");
        }
        return g.executar(v, f, n, p);
      },
      versaoLocal: async () => 10,
    });
    expect(r.versao).toBe(300);
    expect(hashesDoMundo(g.meu)).toEqual(hashesDoMundo(g.doGrupo));
  });

  it("sem PC e sem nuvem: erro claro, mundo intacto", async () => {
    const g = await grupo({ pcOnline: false, nuvem: false });
    const antes = hashesDoMundo(g.meu);
    await expect(
      alcancar({ cliente: g.cliente, espalhar: g.executar, versaoLocal: async () => 10 }),
    ).rejects.toThrow(/nenhum pc nem a nuvem/i);
    expect(hashesDoMundo(g.meu)).toEqual(antes);
  });

  it("pacote da nuvem de outra versão (hash do manifesto não bate) é recusado, mundo intacto", async () => {
    const g = await grupo({ pcOnline: false, nuvem: true });
    g.cliente.maisNova.mockResolvedValue({
      numero: 300,
      manifestoSha256: "0".repeat(64),
      epoca: 5,
      pcId: 2,
      arquivos: 0,
      bytes: 0,
      criadaEm: 0,
    });
    const antes = hashesDoMundo(g.meu);
    await expect(
      alcancar({ cliente: g.cliente, espalhar: g.executar, versaoLocal: async () => 10 }),
    ).rejects.toThrow(/não é o que o cartório registrou/i);
    expect(hashesDoMundo(g.meu)).toEqual(antes);
  });

  it("já na versão mais nova (ou sem versão): não faz nada", async () => {
    const g = await grupo({ pcOnline: true, nuvem: true });
    expect(
      await alcancar({ cliente: g.cliente, espalhar: g.executar, versaoLocal: async () => 300 }),
    ).toEqual({ versao: 300, passos: 0 });
    g.cliente.maisNova.mockResolvedValue(null as never);
    await alcancar({ cliente: g.cliente, espalhar: g.executar, versaoLocal: async () => 10 });
    expect(g.noEspalhar).not.toHaveBeenCalled();
  });

  it("o grupo avança no meio: segue até a nova, com teto de passos", async () => {
    const g = await grupo({ pcOnline: true, nuvem: true });
    let n = 300;
    g.cliente.maisNova.mockImplementation(async () => ({
      numero: n++,
      manifestoSha256: "a".repeat(64),
      epoca: 5,
      pcId: 2,
      arquivos: 0,
      bytes: 0,
      criadaEm: 0,
    }));
    const chamadas: number[] = [];
    const r = await alcancar({
      cliente: g.cliente,
      espalhar: async (v) => (
        chamadas.push(v.numero),
        { estado: "ja-tinha", arquivosBaixados: 0, bytesBaixados: 0 }
      ),
      versaoLocal: async () => 10,
    });
    expect(chamadas).toEqual([300, 301, 302, 303, 304]);
    expect(r.passos).toBe(MAX_PASSOS);
  });

  it("syncmel-1.14: o download do pacote da nuvem reporta bytes e a barra só sobe", async () => {
    const g = await grupo({ pcOnline: false, nuvem: true });
    g.cliente.baixarPacote.mockImplementation(
      async (
        _n: number,
        destino: string,
        _m?: number,
        _s?: AbortSignal,
        aoBytes?: (f: number, t: number) => void,
      ) => {
        copyFileSync(g.pacote.caminho, destino);
        aoBytes?.(250, 1000);
        aoBytes?.(1000, 1000);
        return { sha256: g.pacote.sha256 };
      },
    );
    const vistos: (number | undefined)[] = [];
    await alcancar({
      cliente: g.cliente,
      espalhar: g.executar,
      versaoLocal: async () => 10,
      aoProgresso: (p) => vistos.push(p),
    });
    const numeros = vistos.filter((p): p is number => p !== undefined);
    expect(numeros).toContain(12); // 25% do download = metade da faixa 0–50
    expect(numeros).toContain(50);
    expect(numeros).toEqual([...numeros].sort((a, b) => a - b)); // nunca volta atrás
    expect(numeros.at(-1)).toBe(100);
  });

  it("syncmel-1.14: falha local (servidor rodando / trava perdida) não tenta a nuvem", async () => {
    const g = await grupo({ pcOnline: true, nuvem: true });
    await expect(
      alcancar({
        cliente: g.cliente,
        espalhar: async () => {
          throw new ErroLocal(
            "O servidor está rodando; pare o servidor antes de atualizar o mundo.",
          );
        },
        versaoLocal: async () => 10,
      }),
    ).rejects.toThrow(/servidor está rodando/);
    expect(g.cliente.baixarPacote).not.toHaveBeenCalled();
  });
});
