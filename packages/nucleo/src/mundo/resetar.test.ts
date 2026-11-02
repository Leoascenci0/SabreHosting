import { randomBytes } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { hashesDoMundo } from "../../test/ajuda/mundos.js";
import { escreverRegiao } from "../../test/ajuda/regiao-mca.js";
import { listarBackups } from "../backup/listar.js";
import { MARCADOR_TROCA, podeSubir } from "../servidor/configurar.js";
import { recuperarTroca } from "../backup/restaurar.js";
import { resetarMundo, type OpcoesResetar } from "./resetar.js";

// Passa direto para o real; testes fazem o backup/conferência falhar.
vi.mock("../backup/pacote.js", async (original) => {
  const real = await original<typeof import("../backup/pacote.js")>();
  return { ...real, criarPacote: vi.fn(real.criarPacote), abrirPacote: vi.fn(real.abrirPacote) };
});
const pacoteMod = await import("../backup/pacote.js");

const pastas: string[] = [];
afterEach(() => {
  vi.mocked(pacoteMod.criarPacote).mockClear();
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

const retangulo = (x1: number, z1: number, x2: number, z2: number) =>
  ({ tipo: "retangulo", x1, z1, x2, z2 }) as const;

/** Corpo com bytes aleatórios (mantém o cabeçalho): pacote pequeno e muito compressível expõe uma corrida do abrirPacote (achado do PR). */
function incompressivel(arquivo: string): void {
  const b = readFileSync(arquivo);
  randomBytes(b.length - 8192).copy(b, 8192);
  writeFileSync(arquivo, b);
}

/** Mundo inventado: region/entities/poi em r.0.0 e r.1.0, level.dat e playerdata. */
function cenario() {
  const base = mkdtempSync(join(tmpdir(), "sabre-resetar-"));
  pastas.push(base);
  const servidor = join(base, "servidor");
  const mundo = join(servidor, "mundo");
  mkdirSync(join(mundo, "playerdata"), { recursive: true });
  writeFileSync(join(mundo, "level.dat"), "level-falso");
  writeFileSync(join(mundo, "playerdata", "abc.dat"), "jogador-falso");
  for (const t of ["region", "entities", "poi"]) {
    escreverRegiao(join(mundo, t, "r.0.0.mca"), [0, 1, 33, 500], undefined, 8);
    escreverRegiao(join(mundo, t, "r.1.0.mca"), [0, 1, 2, 100], undefined, 8);
    for (const r of ["r.0.0.mca", "r.1.0.mca"]) incompressivel(join(mundo, t, r));
  }
  const o: OpcoesResetar = {
    pastaDoMundo: mundo,
    pastaDoServidor: servidor,
    pastaBackups: join(base, "backups"),
    dimensao: "overworld",
    area: retangulo(0, 0, 1, 0),
    temTrava: async () => true,
    servidorParado: () => true,
    versao: 7,
    epoca: 3,
    agora: () => new Date("2026-11-02T10:00:00.000Z"),
  };
  return { base, servidor, mundo, o, antes: hashesDoMundo(mundo) };
}

const sobras = (mundo: string) =>
  hashesDoMundo(join(mundo, "..")) &&
  Object.keys(hashesDoMundo(join(mundo, ".."))).filter((c) =>
    /\.(tmp|antigo|resetando)|TROCA-EM/.test(c),
  );

function cabecalho(arquivo: string): Buffer {
  return readFileSync(arquivo).subarray(0, 8192);
}
const posicao = (arquivo: string, i: number) => cabecalho(arquivo).readUIntBE(i * 4, 3);
const data = (arquivo: string, i: number) => cabecalho(arquivo).readUInt32BE(4096 + i * 4);

describe("resetarMundo — caminho feliz", () => {
  it("reset de 1 chunk: zera posição e data nas 3 pastas; resto, level.dat e playerdata iguais", async () => {
    const { mundo, o, antes } = cenario();
    const r = await resetarMundo({ ...o, area: retangulo(1, 0, 1, 0) });
    for (const t of ["region", "entities", "poi"]) {
      const f = join(mundo, t, "r.0.0.mca");
      expect(posicao(f, 1)).toBe(0);
      expect(data(f, 1)).toBe(0);
      expect(posicao(f, 0)).not.toBe(0);
    }
    const depois = hashesDoMundo(mundo);
    expect(depois["level.dat"]).toBe(antes["level.dat"]);
    expect(depois["playerdata/abc.dat"]).toBe(antes["playerdata/abc.dat"]);
    expect(depois["region/r.1.0.mca"]).toBe(antes["region/r.1.0.mca"]);
    expect(depois["region/r.0.0.mca"]).not.toBe(antes["region/r.0.0.mca"]);
    expect(r.arquivosTrocados).toBe(3);
    expect(sobras(mundo)).toEqual([]);
    expect(existsSync(join(mundo, "..", MARCADOR_TROCA))).toBe(false);
    expect((await podeSubir(join(mundo, ".."))).motivo).not.toMatch(/troca/);
  });

  it("região inteira: os 3 arquivos somem; o resto fica", async () => {
    const { mundo, o, antes } = cenario();
    await resetarMundo({ ...o, area: retangulo(32, 0, 63, 31) });
    for (const t of ["region", "entities", "poi"]) {
      expect(existsSync(join(mundo, t, "r.1.0.mca"))).toBe(false);
      expect(existsSync(join(mundo, t, "r.0.0.mca"))).toBe(true);
    }
    expect(hashesDoMundo(mundo)["region/r.0.0.mca"]).toBe(antes["region/r.0.0.mca"]);
    expect(sobras(mundo)).toEqual([]);
  });

  it("faz o backup antes-de-resetar (origem no manifesto) e ele abre", async () => {
    const { o } = cenario();
    const r = await resetarMundo(o);
    expect(r.backup.caminho.startsWith(o.pastaBackups)).toBe(true);
    const lista = await listarBackups(o.pastaBackups);
    expect(JSON.stringify(lista)).toContain("antes-de-resetar");
  });
});

describe("resetarMundo — recusas (nada é tocado)", () => {
  async function recusa(mod: Partial<OpcoesResetar>, texto: RegExp) {
    const { mundo, o, antes } = cenario();
    await expect(resetarMundo({ ...o, ...mod })).rejects.toThrow(texto);
    expect(hashesDoMundo(mundo)).toEqual(antes);
    expect(existsSync(o.pastaBackups)).toBe(false);
    expect(sobras(mundo)).toEqual([]);
  }
  it("servidor rodando", () => recusa({ servidorParado: () => false }, /servidor está rodando/));
  it("sem trava deste PC", () => recusa({ temTrava: async () => false }, /trava/));
  it("trava que dá erro", () =>
    recusa(
      {
        temTrava: async () => {
          throw new Error("rede");
        },
      },
      /trava/,
    ));
  it("backup/restauração em andamento", () =>
    recusa({ operacaoEmAndamento: () => true }, /em andamento/));
  it("mundo fora da pasta do servidor", () =>
    recusa({ pastaDoServidor: join(tmpdir(), "outra") }, /pasta do servidor/));
  it("marcador de troca já existente", async () => {
    const { mundo, o } = cenario();
    writeFileSync(join(mundo, "..", MARCADOR_TROCA), "{}");
    await expect(resetarMundo(o)).rejects.toThrow(/outra troca/);
  });
  it("área grande sem confirmar (erro fixo do plano)", () =>
    recusa({ area: retangulo(0, 0, 100, 100) }, /Área grande/));
});

describe("resetarMundo — backup obrigatório", () => {
  it("criarPacote falha: nenhum .mca tocado", async () => {
    const { mundo, o, antes } = cenario();
    vi.mocked(pacoteMod.criarPacote).mockRejectedValueOnce(new Error("disco cheio /segredo/x"));
    await expect(resetarMundo(o)).rejects.toThrow(/backup/);
    expect(hashesDoMundo(mundo)).toEqual(antes);
    expect(sobras(mundo)).toEqual([]);
  });
  it("conferência do pacote falha: nada tocado e o pacote ruim é descartado", async () => {
    const { mundo, o, antes } = cenario();
    vi.mocked(pacoteMod.abrirPacote).mockRejectedValueOnce(new Error("hash"));
    await expect(resetarMundo(o)).rejects.toThrow(/conferência/);
    expect(hashesDoMundo(mundo)).toEqual(antes);
    expect(existsSync(o.pastaBackups) ? readdirSync(o.pastaBackups) : []).toEqual([]);
  });
  it("backup com o mesmo nome já existe: não escreve por cima", async () => {
    const { mundo, o, antes } = cenario();
    mkdirSync(o.pastaBackups, { recursive: true });
    writeFileSync(join(o.pastaBackups, "2026-11-02T10-00-00-000Z-v7.tar.gz"), "bom");
    await expect(resetarMundo(o)).rejects.toThrow(/Já existe/);
    expect(hashesDoMundo(mundo)).toEqual(antes);
    expect(readFileSync(join(o.pastaBackups, "2026-11-02T10-00-00-000Z-v7.tar.gz"), "utf8")).toBe(
      "bom",
    );
  });
});

describe("resetarMundo — falha no meio (mundo byte a byte como estava)", () => {
  it("rename falha no 2º arquivo: desfaz tudo, sem sobras nem marcador", async () => {
    const { mundo, o, antes } = cenario();
    let n = 0;
    const renomear = async (de: string, para: string) => {
      n++;
      if (n === 4) throw new Error("antivírus segurou /c/x");
      await rename(de, para);
    };
    const erro = await resetarMundo({ ...o, renomear }).catch((e: unknown) => e as Error);
    expect((erro as Error).message).toMatch(/mundo continua como estava/);
    expect((erro as Error).message).not.toContain("/c/x");
    expect((erro as Error).message).not.toContain(mundo);
    expect(hashesDoMundo(mundo)).toEqual(antes);
    expect(sobras(mundo)).toEqual([]);
  });

  it("falha no 1º rename: mundo intacto", async () => {
    const { mundo, o, antes } = cenario();
    const renomear = async () => {
      throw new Error("x");
    };
    await expect(resetarMundo({ ...o, renomear })).rejects.toThrow(/continua como estava/);
    expect(hashesDoMundo(mundo)).toEqual(antes);
    expect(sobras(mundo)).toEqual([]);
  });

  it("app morre entre renames: servidor não sobe e recuperarTroca devolve os hashes", async () => {
    const { mundo, servidor, o, antes } = cenario();
    let n = 0;
    await expect(
      resetarMundo({
        ...o,
        aposRename: () => {
          if (++n === 3) throw new Error("morreu");
        },
      }),
    ).rejects.toThrow();
    expect((await podeSubir(servidor)).pode).toBe(false);
    expect(await recuperarTroca(servidor)).toBe("desfez");
    expect(hashesDoMundo(mundo)).toEqual(antes);
    expect(sobras(mundo)).toEqual([]);
    expect(await recuperarTroca(servidor)).toBe("nada");
  });

  it("app morre com região apagada na lista: recuperação devolve o arquivo", async () => {
    const { mundo, servidor, o, antes } = cenario();
    let n = 0;
    await expect(
      resetarMundo({
        ...o,
        area: retangulo(32, 0, 63, 31),
        aposRename: () => {
          if (++n === 2) throw new Error("morreu");
        },
      }),
    ).rejects.toThrow();
    await recuperarTroca(servidor);
    expect(hashesDoMundo(mundo)).toEqual(antes);
  });

  it("morte depois do último rename (fase concluída): só limpa, não desfaz parcial", async () => {
    const { mundo, servidor, o } = cenario();
    await expect(
      resetarMundo({
        ...o,
        aposTroca: () => {
          throw new Error("morreu");
        },
      }),
    ).rejects.toThrow();
    const semSobras = () =>
      Object.fromEntries(
        Object.entries(hashesDoMundo(mundo)).filter(([c]) => !/\.antigo-/.test(c)),
      );
    const depoisDaTroca = semSobras();
    expect(Object.keys(hashesDoMundo(mundo)).some((c) => /\.antigo-/.test(c))).toBe(true);
    expect(await recuperarTroca(servidor)).toBe("limpou");
    expect(semSobras()).toEqual(depoisDaTroca);
    expect(sobras(mundo)).toEqual([]);
  });
});

describe("resetarMundo — cabeçalho hostil", () => {
  it("entrada com lixo dentro da área é zerada; fora da área fica; .mca curto não é tocado", async () => {
    const { mundo, o } = cenario();
    const f = join(mundo, "region", "r.0.0.mca");
    const buf = readFileSync(f);
    buf.writeUIntBE(0xffffff, 2 * 4, 3); // chunk 2 (fora da área 0..1): posição absurda
    buf.writeUInt8(200, 2 * 4 + 3);
    buf.writeUIntBE(0xffffff, 1 * 4, 3); // chunk 1 (dentro): lixo
    buf.writeUInt8(255, 1 * 4 + 3);
    writeFileSync(f, buf);
    const curto = join(mundo, "poi", "r.0.0.mca");
    writeFileSync(curto, Buffer.alloc(5000)); // menor que 8 KiB
    const h = hashesDoMundo(mundo)["poi/r.0.0.mca"];
    await resetarMundo(o);
    expect(posicao(f, 1)).toBe(0);
    expect(cabecalho(f).readUInt8(1 * 4 + 3)).toBe(0);
    expect(posicao(f, 2)).toBe(0xffffff);
    expect(hashesDoMundo(mundo)["poi/r.0.0.mca"]).toBe(h);
  });

  it("temporária adulterada (hash do resto não bate): aborta sem tocar nada", async () => {
    const { mundo, o, antes } = cenario();
    // simula leitura que muda no meio: aposCopia corrompe a temporária
    await expect(
      resetarMundo({
        ...o,
        aposCopia: (temp: string) => {
          const b = readFileSync(temp);
          b[b.length - 1] = (b[b.length - 1] ?? 0) ^ 0xff;
          writeFileSync(temp, b);
        },
      }),
    ).rejects.toThrow(/conferência/);
    expect(hashesDoMundo(mundo)).toEqual(antes);
    expect(sobras(mundo)).toEqual([]);
  });
});
