import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  truncateSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { gerarMundo } from "../../test/ajuda/mundos.js";
import { criarPacote } from "./pacote.js";
import { nomeDoBackup } from "./agendador.js";
import { conferirPacoteDetalhado } from "./rotacao.js";
import { arquivoDeMarcas, lerMarcas, marcarBackup, rotacionarPasta } from "./rotacao-pasta.js";

const AGORA = new Date(2026, 9, 30, 15, 0, 0);
const nomeEm = (diasAtras: number, hora = 12): string =>
  nomeDoBackup(new Date(2026, 9, 30 - diasAtras, hora, 0, 0), 1);

let raiz: string;
let modelo: { caminho: string; sha256: string };
beforeAll(async () => {
  raiz = mkdtempSync(join(tmpdir(), "sabre-rotpasta-"));
  const mundo = gerarMundo({ tamanho: "1MB" }); // mundo inventado (tests/mundos)
  modelo = { caminho: join(raiz, "modelo.tar.gz"), sha256: "" };
  modelo.sha256 = (await criarPacote(mundo, modelo.caminho, { versao: 1, epoca: 1 })).sha256;
  rmSync(mundo, { recursive: true, force: true });
});
afterAll(() => rmSync(raiz, { recursive: true, force: true }));

/** Pasta de backups com um pacote real por nome (cópias do modelo: mesmo hash). */
function cenario(nomes: string[]): string {
  const pasta = mkdtempSync(join(raiz, "c-")) + "/backups";
  mkdirSync(pasta);
  for (const n of nomes) copyFileSync(modelo.caminho, join(pasta, n));
  return pasta;
}
const restantes = (pasta: string): string[] => readdirSync(pasta).sort();

describe("marcas (arquivo ao lado da pasta)", () => {
  it("sem arquivo, arquivo torto ou entradas tortas: nada de marca", () => {
    const pasta = cenario([nomeEm(0)]);
    const arq = arquivoDeMarcas(pasta);
    expect(arq).toBe(`${pasta}.marcas.json`);
    expect(lerMarcas(arq).size).toBe(0);
    writeFileSync(arq, "{ lixo");
    expect(lerMarcas(arq).size).toBe(0);
    const ok = nomeEm(0);
    writeFileSync(
      arq,
      JSON.stringify({
        marcas: {
          [ok]: { estado: "bom", sha256: modelo.sha256 },
          "../fora-v1.tar.gz": { estado: "bom", sha256: modelo.sha256 },
          [nomeEm(1)]: { estado: "otimo", sha256: modelo.sha256 },
          [nomeEm(2)]: { estado: "bom", sha256: "curto" },
          [nomeEm(3)]: null,
        },
      }),
    );
    expect([...lerMarcas(arq).keys()]).toEqual([ok]);
  });
});

describe("rotacionarPasta", () => {
  it("quantosGuardar=3: sobram os recentes + tudo dos 7 dias; o último bom e os sem marca nunca saem", async () => {
    // 12 backups, um a cada 2 dias (0, 2, ..., 22 dias atrás); dentro dos 7 dias: 0, 2, 4, 6.
    const nomes = Array.from({ length: 12 }, (_, i) => nomeEm(i * 2));
    const pasta = cenario(nomes);
    const semMarca = nomes[7] as string; // 14 dias atrás, fora de toda janela
    const ruimVelho = nomes[8] as string;
    for (const n of nomes) {
      if (n === semMarca) continue;
      marcarBackup(pasta, n, n === ruimVelho ? "ruim" : "bom", modelo.sha256);
    }
    const r = await rotacionarPasta(pasta, { recentes: 3, agora: AGORA });
    expect(r.falhas).toEqual([]);
    const esperados = [...nomes.slice(0, 4), semMarca].sort();
    expect(restantes(pasta).filter((n) => n.endsWith(".tar.gz"))).toEqual(esperados);
    // a marca dos apagados foi podada; a dos que ficaram, não
    expect(lerMarcas(arquivoDeMarcas(pasta)).has(nomes[10] as string)).toBe(false);
    expect(lerMarcas(arquivoDeMarcas(pasta)).has(nomes[0] as string)).toBe(true);
  });

  it("valor maior guarda mais: quantosGuardar=6 mantém os 6 mais novos", async () => {
    const nomes = Array.from({ length: 12 }, (_, i) => nomeEm(i * 2));
    const pasta = cenario(nomes);
    for (const n of nomes) marcarBackup(pasta, n, "bom", modelo.sha256);
    await rotacionarPasta(pasta, { recentes: 6, agora: AGORA });
    expect(restantes(pasta).filter((n) => n.endsWith(".tar.gz"))).toEqual(nomes.slice(0, 6).sort());
  });

  it("sem nenhuma marca (nada conferido ainda): não apaga nada", async () => {
    const nomes = Array.from({ length: 12 }, (_, i) => nomeEm(i * 3));
    const pasta = cenario(nomes);
    const r = await rotacionarPasta(pasta, { recentes: 1, agora: AGORA });
    expect(r.apagados).toEqual([]);
    expect(restantes(pasta)).toEqual([...nomes].sort());
  });

  it("nenhum bom passou na conferência de agora: não apaga nada e marca o pacote como ruim", async () => {
    const nomes = Array.from({ length: 6 }, (_, i) => nomeEm(10 + i));
    const pasta = cenario(nomes);
    for (const n of nomes) marcarBackup(pasta, n, "bom", modelo.sha256);
    // corrompe o mais novo E todos os outros "bons": nenhum confere
    for (const n of nomes) truncateSync(join(pasta, n), 100);
    await expect(rotacionarPasta(pasta, { recentes: 1, agora: AGORA })).rejects.toThrow(
      /nenhum backup bom/i,
    );
    expect(restantes(pasta)).toEqual([...nomes].sort());
    expect(lerMarcas(arquivoDeMarcas(pasta)).get(nomes[0] as string)?.estado).toBe("ruim");
  });

  it("marca adulterada (hash errado no último bom): a conferência barra e nada é apagado", async () => {
    const nomes = Array.from({ length: 6 }, (_, i) => nomeEm(10 + i));
    const pasta = cenario(nomes);
    for (const n of nomes) marcarBackup(pasta, n, "bom", "0".repeat(64));
    await expect(rotacionarPasta(pasta, { recentes: 1, agora: AGORA })).rejects.toThrow();
    expect(restantes(pasta)).toEqual([...nomes].sort());
  });

  it("o bom mais novo corrompido: usa o próximo bom e ainda apaga só o plano", async () => {
    const nomes = Array.from({ length: 6 }, (_, i) => nomeEm(10 + i));
    const pasta = cenario(nomes);
    for (const n of nomes) marcarBackup(pasta, n, "bom", modelo.sha256);
    truncateSync(join(pasta, nomes[0] as string), 100);
    const r = await rotacionarPasta(pasta, { recentes: 2, agora: AGORA });
    expect(r.apagados.length).toBe(4);
    expect(restantes(pasta).filter((n) => n.endsWith(".tar.gz"))).toEqual(nomes.slice(0, 2).sort());
  });

  it("arquivo estranho na pasta (nome fora do padrão) não é tocado", async () => {
    const nomes = Array.from({ length: 5 }, (_, i) => nomeEm(10 + i));
    const pasta = cenario(nomes);
    writeFileSync(join(pasta, "minhas-fotos.tar.gz"), "x");
    for (const n of nomes) marcarBackup(pasta, n, "bom", modelo.sha256);
    await rotacionarPasta(pasta, { recentes: 1, agora: AGORA });
    expect(existsSync(join(pasta, "minhas-fotos.tar.gz"))).toBe(true);
  });

  it("pasta que não existe: não faz nada", async () => {
    const r = await rotacionarPasta(join(raiz, "nao-existe"), { agora: AGORA });
    expect(r.apagados).toEqual([]);
  });
});

describe("falha de leitura não é backup ruim (drive-1.1b)", () => {
  it("conferência indisponível (Drive baixando, disco cheio): nada apagado e NENHUMA marca ruim", async () => {
    const nomes = Array.from({ length: 6 }, (_, i) => nomeEm(10 + i));
    const pasta = cenario(nomes);
    for (const n of nomes) marcarBackup(pasta, n, "bom", modelo.sha256);
    await expect(
      rotacionarPasta(pasta, {
        recentes: 1,
        agora: AGORA,
        conferir: async () => "indisponivel",
      }),
    ).rejects.toThrow(/nenhum backup bom/i);
    expect(restantes(pasta)).toEqual([...nomes].sort());
    const estados = [...lerMarcas(arquivoDeMarcas(pasta)).values()].map((m) => m.estado);
    expect(estados.every((e) => e === "bom")).toBe(true);
  });

  it("veredito do pacote: sumiu = indisponível; hash errado = ruim; íntegro = ok", async () => {
    const pasta = cenario([nomeEm(0)]);
    const b = { nome: nomeEm(0), data: AGORA, estado: "bom" as const, sha256: modelo.sha256 };
    expect(await conferirPacoteDetalhado(pasta, b)).toBe("ok");
    expect(await conferirPacoteDetalhado(pasta, { ...b, sha256: "0".repeat(64) })).toBe("ruim");
    expect(await conferirPacoteDetalhado(pasta, { ...b, nome: nomeEm(5) })).toBe("indisponivel");
    expect(await conferirPacoteDetalhado(pasta, { ...b, sha256: undefined })).toBe("indisponivel");
  });

  it("marcas em arquivo próprio (pasta de dados do app), não ao lado da pasta sincronizada", async () => {
    const nomes = Array.from({ length: 5 }, (_, i) => nomeEm(10 + i));
    const pasta = cenario(nomes);
    const marcas = join(raiz, "dados-do-app", "marcas-historico.json");
    for (const n of nomes) marcarBackup(pasta, n, "bom", modelo.sha256, marcas);
    const r = await rotacionarPasta(pasta, { recentes: 2, agora: AGORA, arquivoMarcas: marcas });
    expect(r.apagados).toHaveLength(3);
    expect(existsSync(arquivoDeMarcas(pasta))).toBe(false);
    expect(restantes(pasta)).toEqual([nomes[0], nomes[1]].sort());
  });

  it("pasta que some no meio: lista vazia, nada apagado, sem erro", async () => {
    const pasta = cenario([]);
    rmSync(pasta, { recursive: true });
    const r = await rotacionarPasta(pasta, { recentes: 1, agora: AGORA });
    expect(r.apagados).toEqual([]);
  });
});

describe("backup manual na rotação (appuimel-1.1)", () => {
  it("manual conta como qualquer outro: apagado quando passa do limite, e o mínimo garantido nunca cai", async () => {
    const mundo = gerarMundo({ tamanho: "1MB" });
    const manual = join(raiz, "manual.tar.gz");
    const feito = await criarPacote(mundo, manual, { versao: 1, epoca: 1, origem: "manual" });
    rmSync(mundo, { recursive: true, force: true });
    // 6 backups manuais velhos (fora dos 7 dias) e nenhum automático: o botão não fura a regra.
    const nomes = Array.from({ length: 6 }, (_, i) => nomeEm(20 + i));
    const pasta = mkdtempSync(join(raiz, "m-")) + "/backups";
    mkdirSync(pasta);
    for (const n of nomes) {
      copyFileSync(manual, join(pasta, n));
      marcarBackup(pasta, n, "bom", feito.sha256);
    }
    const r = await rotacionarPasta(pasta, { recentes: 2, agora: AGORA });
    expect(r.falhas).toEqual([]);
    expect(restantes(pasta).filter((n) => n.endsWith(".tar.gz"))).toEqual(nomes.slice(0, 2).sort());
    // limite 1: ainda sobra o último bom, nunca zero
    await rotacionarPasta(pasta, { recentes: 1, agora: AGORA });
    expect(restantes(pasta).filter((n) => n.endsWith(".tar.gz"))).toEqual([nomes[0]]);
  });
});

