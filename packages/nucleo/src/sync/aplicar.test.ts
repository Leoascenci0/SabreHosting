import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { copyFile, mkdir, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gerarMundo, hashesDoMundo } from "../../test/ajuda/mundos.js";
import { gerarManifesto, type ArquivoDoManifesto, type Manifesto } from "../backup/manifesto.js";
import { MARCADOR_RESTAURACAO } from "../servidor/configurar.js";
import { hashDoArquivo } from "../integridade/hash.js";
import { aplicarDelta, type OpcoesAplicar } from "./aplicar.js";

const pastas: string[] = [];
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

/** N = mundo local (semente A); M = N com uma região mudada, uma nova e uma apagada. */
async function cenario() {
  const base = mkdtempSync(join(tmpdir(), "sabre-aplicar-"));
  pastas.push(base);
  const mundo = gerarMundo({ tamanho: "1MB", semente: "A", pasta: join(base, "mundo") });
  const remoto = join(base, "remoto");
  cpSync(mundo, remoto, { recursive: true });
  writeFileSync(join(remoto, "region", "r.0.0.mca"), "região mudada no host");
  writeFileSync(join(remoto, "region", "r.9.9.mca"), "região nova");
  rmSync(join(remoto, "region", "r.1.0.mca"));
  const alvo = await gerarManifesto(remoto, { versao: 7, epoca: 2 });
  const local = await gerarManifesto(mundo, { versao: 6, epoca: 2 });
  const antes = hashesDoMundo(mundo);
  const baixados: ArquivoDoManifesto[] = [];
  const o: OpcoesAplicar = {
    pastaDoMundo: mundo,
    alvo,
    local,
    // Faz o papel do host: entrega o arquivo de M, e só ele, no caminho pedido.
    baixar: async (a, destino) => {
      baixados.push(a);
      await mkdir(dirname(destino), { recursive: true });
      await copyFile(join(remoto, a.caminho), destino);
    },
    temAtualizacao: async () => true,
    hospedaAgora: async () => false,
    servidorParado: () => true,
    avisarCopia: vi.fn(async () => undefined),
  };
  return { base, mundo, remoto, alvo, local, antes, baixados, o };
}

const sobras = (base: string) =>
  readdirSync(base)
    .filter((n) => n.startsWith("mundo."))
    .sort();

describe("aplicarDelta", () => {
  it("transfere só o que mudou e deixa o mundo igual a M inteiro", async () => {
    const c = await cenario();
    const r = await aplicarDelta(c.o);
    expect(c.baixados.map((a) => a.caminho).sort()).toEqual([
      "region/r.0.0.mca",
      "region/r.9.9.mca",
    ]);
    expect(r.arquivosBaixados).toBe(2);
    expect(r.bytesBaixados).toBe(
      Buffer.byteLength("região mudada no host") + Buffer.byteLength("região nova"), // bem menos que o mundo de 1 MB
    );
    expect(hashesDoMundo(c.mundo)).toEqual(hashesDoMundo(c.remoto));
    expect(existsSync(join(c.mundo, "region", "r.1.0.mca"))).toBe(false);
    expect(sobras(c.base)).toEqual([]); // sem temporária nem .antigo
    expect(c.o.avisarCopia).toHaveBeenCalledWith(7);
    expect(r.avisoCartorio).toBeUndefined();
  });

  it("sem manifesto local, gera o de N da pasta parada", async () => {
    const c = await cenario();
    const semLocal: OpcoesAplicar = { ...c.o, local: undefined };
    await aplicarDelta(semLocal);
    expect(c.baixados).toHaveLength(2);
    expect(hashesDoMundo(c.mundo)).toEqual(hashesDoMundo(c.remoto));
  });

  it("sem a trava de atualização, hospedando ou com servidor rodando: recusa antes de criar qualquer coisa", async () => {
    const c = await cenario();
    await expect(aplicarDelta({ ...c.o, temAtualizacao: async () => false })).rejects.toThrow(
      /trava de atualização/i,
    );
    // Este PC hospeda (trava de host dele): o mundo vivo nunca é tocado (regra de ouro 1).
    await expect(aplicarDelta({ ...c.o, hospedaAgora: async () => true })).rejects.toThrow(
      /hospedando/i,
    );
    // Não deu para saber se hospeda (erro ou demora): fecha para o lado seguro.
    const semResposta = { ...c.o, prazoTravaMs: 30 };
    await expect(
      aplicarDelta({ ...semResposta, hospedaAgora: () => Promise.reject(new Error("rede")) }),
    ).rejects.toThrow(/hospedando/i);
    await expect(
      aplicarDelta({ ...semResposta, hospedaAgora: () => new Promise<boolean>(() => {}) }),
    ).rejects.toThrow(/hospedando/i);
    await expect(aplicarDelta({ ...c.o, servidorParado: () => false })).rejects.toThrow(
      /servidor/i,
    );
    expect(sobras(c.base)).toEqual([]);
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
    expect(c.baixados).toHaveLength(0);
  });

  it("trava perdida durante o download: não troca e N fica intacto", async () => {
    const c = await cenario();
    let n = 0;
    await expect(
      aplicarDelta({ ...c.o, temAtualizacao: async () => ++n < 2 }), // 1ª confere, 2ª (após o download, antes do 1º rename) não
    ).rejects.toThrow(/trava de atualização/i);
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
    expect(sobras(c.base)).toEqual([]);
    expect(c.o.avisarCopia).not.toHaveBeenCalled();
  });

  it.each([
    ["download cai no segundo arquivo", 2],
    ["download cai no primeiro arquivo", 1],
  ])("%s: N intacto e sem sobras", async (_nome, quando) => {
    const c = await cenario();
    let n = 0;
    const baixar = c.o.baixar;
    await expect(
      aplicarDelta({
        ...c.o,
        baixar: async (a, d) => {
          if (++n === quando) throw new Error("rede caiu");
          await baixar(a, d);
        },
      }),
    ).rejects.toThrow(/rede caiu/);
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
    expect(sobras(c.base)).toEqual([]);
    expect(c.o.avisarCopia).not.toHaveBeenCalled();
  });

  it("arquivo entregue com conteúdo errado: a conferência de M inteiro recusa", async () => {
    const c = await cenario();
    await expect(
      aplicarDelta({
        ...c.o,
        baixar: async (_a, destino) => {
          await mkdir(dirname(destino), { recursive: true });
          writeFileSync(destino, "lixo");
        },
      }),
    ).rejects.toThrow(/não confere/i);
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
    expect(sobras(c.base)).toEqual([]);
  });

  it("arquivo 'igual' no manifesto de N mas diferente no disco: recusa (reconfere os iguais)", async () => {
    const c = await cenario();
    writeFileSync(join(c.mundo, "level.dat"), "adulterado depois do manifesto");
    const depois = hashesDoMundo(c.mundo);
    await expect(aplicarDelta(c.o)).rejects.toThrow(/não confere/i);
    expect(hashesDoMundo(c.mundo)).toEqual(depois);
    expect(sobras(c.base)).toEqual([]);
  });

  it("hard link falhou (outro disco/Windows): copia e o resultado é o mesmo", async () => {
    const c = await cenario();
    const ligar = vi.fn(async () => {
      throw Object.assign(new Error("EXDEV"), { code: "EXDEV" });
    });
    await aplicarDelta({ ...c.o, ligar });
    expect(ligar).toHaveBeenCalled();
    expect(hashesDoMundo(c.mundo)).toEqual(hashesDoMundo(c.remoto));
  });

  it("os arquivos iguais são hard links de N, e os mudados são arquivos novos (N não é tocado)", async () => {
    const c = await cenario();
    const ligacoes: [string, string][] = [];
    const real = (await import("node:fs/promises")).link;
    await aplicarDelta({
      ...c.o,
      ligar: async (de, para) => {
        ligacoes.push([de, para]);
        await real(de, para);
      },
      // Troca interrompida logo após montar: a temporária some e N tem de estar inteiro.
      renomear: async () => {
        throw new Error("sem permissão");
      },
    }).catch(() => undefined);
    expect(ligacoes.length).toBeGreaterThan(0);
    expect(ligacoes.some(([, para]) => para.endsWith("r.0.0.mca"))).toBe(false); // mudado não é link
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
  });

  it("falha no 1º rename: N intacto e sem sobras", async () => {
    const c = await cenario();
    await expect(
      aplicarDelta({
        ...c.o,
        renomear: async () => {
          throw new Error("disco cheio");
        },
      }),
    ).rejects.toThrow(/mundo continua como estava/i);
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
    expect(sobras(c.base)).toEqual([]);
  });

  it("falha entre os dois renames: o mundo de antes volta ao lugar", async () => {
    const c = await cenario();
    let n = 0;
    const renomear = vi.fn(async (de: string, para: string) => {
      if (++n === 2) throw new Error("travou no meio");
      await rename(de, para);
    });
    await expect(aplicarDelta({ ...c.o, renomear })).rejects.toThrow(/mundo continua/i);
    expect(renomear).toHaveBeenCalledTimes(3); // mundo→antigo, temp→mundo (falha), antigo→mundo
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
    expect(sobras(c.base)).toEqual([]);
    expect(c.o.avisarCopia).not.toHaveBeenCalled();
  });

  it("trava de atualização perdida logo antes do 1º rename: nada renomeado, N intacto (1.8b a)", async () => {
    const c = await cenario();
    let n = 0;
    const renomear = vi.fn(rename);
    await expect(
      aplicarDelta({ ...c.o, renomear, temAtualizacao: async () => ++n < 2 }), // 2ª = antes do 1º rename
    ).rejects.toThrow(/trava de atualização/i);
    expect(n).toBe(2);
    expect(renomear).not.toHaveBeenCalled();
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
    expect(sobras(c.base)).toEqual([]);
    expect(existsSync(join(c.base, "TROCA-EM-ANDAMENTO.json"))).toBe(false);
    expect(c.o.avisarCopia).not.toHaveBeenCalled();
  });

  it("trava de atualização perdida entre os renames: não põe M no lugar, N volta (1.8b a)", async () => {
    const c = await cenario();
    let n = 0;
    const renomear = vi.fn(rename);
    await expect(
      aplicarDelta({ ...c.o, renomear, temAtualizacao: async () => ++n < 3 }), // 3ª = antes do 2º rename
    ).rejects.toThrow(/trava de atualização/i);
    expect(n).toBe(3);
    // mundo→antigo e, sem a trava, antigo→mundo (desfazer); temp→mundo nunca acontece.
    expect(renomear.mock.calls.map(([de]) => String(de).split(/[\\/]/).pop())).toEqual([
      "mundo",
      "mundo.antigo-v7",
    ]);
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
    expect(sobras(c.base)).toEqual([]);
    expect(existsSync(join(c.base, "TROCA-EM-ANDAMENTO.json"))).toBe(false);
    expect(c.o.avisarCopia).not.toHaveBeenCalled();
  });

  it("entre os renames só olha a trava LOCAL: nenhuma consulta de rede com o mundo fora do lugar (1.9a)", async () => {
    const c = await cenario();
    const temAtualizacao = vi.fn(async () => true);
    const hospedaAgora = vi.fn(async () => false);
    let rede = 0;
    await aplicarDelta({
      ...c.o,
      temAtualizacao,
      hospedaAgora,
      temAtualizacaoLocal: async () => true,
      aposPrimeiroRename: () => {
        rede = temAtualizacao.mock.calls.length + hospedaAgora.mock.calls.length;
      },
    });
    expect(temAtualizacao.mock.calls.length + hospedaAgora.mock.calls.length).toBe(rede);
    expect(hashesDoMundo(c.mundo)).toEqual(hashesDoMundo(c.remoto));
  });

  it("a rede é consultada de propósito ANTES do 1º rename (host e trava), nunca entre os renames (1.12 b)", async () => {
    const c = await cenario();
    const hospedaAgora = vi.fn(async () => false);
    const temAtualizacao = vi.fn(async () => true);
    let redeAntes = 0;
    await aplicarDelta({
      ...c.o,
      hospedaAgora,
      temAtualizacao,
      temAtualizacaoLocal: async () => true,
      aposPrimeiroRename: () => {
        redeAntes = hospedaAgora.mock.calls.length;
      },
    });
    expect(redeAntes).toBeGreaterThan(0); // fora do host confirmado na rede antes de mexer no mundo
    expect(hospedaAgora.mock.calls.length).toBe(redeAntes); // e nenhuma consulta depois
  });

  it("trava local perdida entre os renames: M não entra e N volta (1.9a)", async () => {
    const c = await cenario();
    await expect(aplicarDelta({ ...c.o, temAtualizacaoLocal: async () => false })).rejects.toThrow(
      /trava de atualização/i,
    );
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
    expect(sobras(c.base)).toEqual([]);
  });

  it("servidor deste PC ligado no meio da troca: para antes do 2º rename e N volta", async () => {
    const c = await cenario();
    let ligado = false;
    await expect(
      aplicarDelta({
        ...c.o,
        servidorParado: () => !ligado,
        aposPrimeiroRename: () => void (ligado = true),
      }),
    ).rejects.toThrow(/servidor/i);
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
    expect(sobras(c.base)).toEqual([]);
  });

  it("falha no aviso ao cartório não desfaz a troca", async () => {
    const c = await cenario();
    const avisarCopia = vi.fn(async () => {
      throw new Error("cartório fora do ar");
    });
    const r = await aplicarDelta({ ...c.o, avisarCopia });
    expect(r.avisoCartorio?.message).toMatch(/cartório fora do ar/);
    expect(hashesDoMundo(c.mundo)).toEqual(hashesDoMundo(c.remoto));
    expect(sobras(c.base)).toEqual([]);
  });

  it("manifesto alvo com caminho inseguro: recusado antes de criar a temporária", async () => {
    const c = await cenario();
    const ruim: Manifesto = {
      ...c.alvo,
      arquivos: [{ caminho: "../fora.txt", tamanho: 1, sha256: "a".repeat(64) }],
    };
    await expect(aplicarDelta({ ...c.o, alvo: ruim })).rejects.toThrow(/inseguro/i);
    expect(sobras(c.base)).toEqual([]);
    expect(existsSync(join(c.base, "fora.txt"))).toBe(false);
  });

  it("mundo local ausente: recusa sem criar nada", async () => {
    const c = await cenario();
    rmSync(c.mundo, { recursive: true });
    await expect(aplicarDelta(c.o)).rejects.toThrow(/mundo/i);
    expect(readdirSync(c.base).filter((n) => n.startsWith("mundo"))).toEqual([]);
  });

  it("temporária de uma tentativa anterior: não escreve por cima", async () => {
    const c = await cenario();
    await mkdir(`${c.mundo}.atualizando-v7`);
    await expect(aplicarDelta(c.o)).rejects.toThrow(/já existe/i);
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
    expect(await hashDoArquivo(join(c.mundo, "level.dat"))).toBe(
      c.local.arquivos.find((a) => a.caminho === "level.dat")?.sha256,
    );
  });
});

describe("aplicarDelta — queda em cada passo e proteção de N", () => {
  it("montagem: ligar falha no meio, a cópia assume e N segue intacto", async () => {
    const c = await cenario();
    let n = 0;
    const real = (await import("node:fs/promises")).link;
    await aplicarDelta({
      ...c.o,
      ligar: async (de, para) => {
        if (++n % 2 === 0) throw new Error("EXDEV");
        await real(de, para);
      },
    });
    expect(hashesDoMundo(c.mundo)).toEqual(hashesDoMundo(c.remoto));
  });

  it("conferência final recusa: N com os mesmos hashes e nada de aviso", async () => {
    const c = await cenario();
    const baixar = c.o.baixar;
    await expect(
      aplicarDelta({
        ...c.o,
        baixar: async (a, d) => {
          await baixar(a, d);
          writeFileSync(d, "corrompido depois de baixar");
        },
      }),
    ).rejects.toThrow(/não confere/i);
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
    expect(sobras(c.base)).toEqual([]);
    expect(c.o.avisarCopia).not.toHaveBeenCalled();
  });

  it("o desfazer também falha (rename 3): marcador gravado e .antigo/.atualizando preservados", async () => {
    const c = await cenario();
    let n = 0;
    const renomear = vi.fn(async (de: string, para: string) => {
      if (++n >= 2) throw new Error(`falhou o rename ${n}`);
      await rename(de, para);
    });
    await expect(aplicarDelta({ ...c.o, renomear })).rejects.toThrow(/nem desfazer/i);
    expect(renomear).toHaveBeenCalledTimes(3);
    const marcador = join(c.base, MARCADOR_RESTAURACAO);
    expect(existsSync(marcador)).toBe(true);
    expect(readFileSync(marcador, "utf8")).toContain("mundo.antigo-v7");
    expect(sobras(c.base)).toEqual(["mundo.antigo-v7", "mundo.atualizando-v7"]);
    // N está inteiro no .antigo (fora do lugar, mas apontado pelo marcador); a temporária não foi apagada.
    expect(hashesDoMundo(join(c.base, "mundo.antigo-v7"))).toEqual(c.antes);
    expect(hashesDoMundo(join(c.base, "mundo.atualizando-v7"))).toEqual(hashesDoMundo(c.remoto));
    expect(c.o.avisarCopia).not.toHaveBeenCalled();
  });

  it("arquivo mudado é arquivo NOVO: inode diferente do de N, e igual é o mesmo inode (link)", async () => {
    const c = await cenario();
    const inoN = (r: string) => statSync(join(c.mundo, r)).ino;
    const mudado = inoN("region/r.0.0.mca");
    const igual = inoN("level.dat");
    const baixar = c.o.baixar;
    let conferido = false;
    await aplicarDelta({
      ...c.o,
      baixar: async (a, destino) => {
        await baixar(a, destino);
        if (a.caminho === "region/r.0.0.mca") {
          expect(statSync(destino).ino).not.toBe(mudado);
          expect(statSync(join(c.mundo, a.caminho)).ino).toBe(mudado);
          expect(hashesDoMundo(c.mundo)).toEqual(c.antes); // N não mudou um byte
          conferido = true;
        }
      },
    });
    expect(conferido).toBe(true);
    // Depois da troca, o arquivo igual continua sendo o mesmo inode (hard link) e o mudado é outro.
    expect(statSync(join(c.mundo, "level.dat")).ino).toBe(igual);
    expect(statSync(join(c.mundo, "region/r.0.0.mca")).ino).not.toBe(mudado);
  });

  it("pasta dentro de N que é link simbólico para fora: recusa e não toca em nada", async () => {
    const c = await cenario();
    const fora = join(c.base, "fora");
    mkdirSync(fora);
    writeFileSync(join(fora, "segredo.txt"), "dado de fora do mundo");
    symlinkSync(fora, join(c.mundo, "atalho"));
    const hash = (await hashDoArquivo(join(fora, "segredo.txt"))) as string;
    const arq = { caminho: "atalho/segredo.txt", tamanho: 21, sha256: hash };
    // O manifesto de N (informado de fora) e o de M listam o arquivo como igual.
    const local = { ...c.local, arquivos: [...c.local.arquivos, arq] };
    const alvo = { ...c.alvo, arquivos: [...c.alvo.arquivos, arq] };
    await expect(aplicarDelta({ ...c.o, local, alvo })).rejects.toThrow(/link simbólico/i);
    expect(readFileSync(join(fora, "segredo.txt"), "utf8")).toBe("dado de fora do mundo");
    expect(statSync(join(fora, "segredo.txt")).nlink).toBe(1); // nada foi ligado ao arquivo de fora
    expect(sobras(c.base)).toEqual([]);
  });
});
