import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  truncateSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { execFileSync } from "node:child_process";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gerarMundo, hashesDoMundo, mudarRegioes } from "../../test/ajuda/mundos.js";
import { compararManifestos, gerarManifesto, validarManifesto } from "./manifesto.js";

const pastas: string[] = [];
const leituras: Array<{ pedaco: number; abertos: number }> = [];

// Passa direto para o node:fs de verdade, só anotando cada leitura em fluxo (tamanho do pedaço e quantas abertas).
vi.mock("node:fs", async (original) => {
  const real = await original<typeof import("node:fs")>();
  let abertos = 0;
  return {
    ...real,
    createReadStream: (...args: Parameters<typeof real.createReadStream>) => {
      const fluxo = real.createReadStream(...args);
      abertos++;
      leituras.push({ pedaco: fluxo.readableHighWaterMark, abertos });
      fluxo.once("close", () => abertos--);
      return fluxo;
    },
  };
});
const opcoes = { versao: 3, epoca: 1, agora: new Date("2026-10-30T12:00:00Z") };

function mundo(tamanho: "1MB" | "20MB" = "1MB"): string {
  const pasta = mkdtempSync(join(tmpdir(), "sabre-manifesto-"));
  pastas.push(pasta);
  return gerarMundo({ tamanho, pasta });
}

afterEach(() => {
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true });
});

describe("gerarManifesto", () => {
  it("lista caminhos relativos ordenados com tamanho e SHA-256 certos", async () => {
    const pasta = mundo();
    const m = await gerarManifesto(pasta, opcoes);
    const caminhos = m.arquivos.map((a) => a.caminho);
    expect(caminhos).toEqual([...caminhos].sort());
    expect(Object.fromEntries(m.arquivos.map((a) => [a.caminho, a.sha256]))).toEqual(
      hashesDoMundo(pasta),
    );
    expect(m).toMatchObject({
      formato: 1,
      versao: 3,
      epoca: 1,
      criadoEm: "2026-10-30T12:00:00.000Z",
    });
    expect(m.arquivos.find((a) => a.caminho === "level.dat")?.tamanho).toBe(1024);
  });

  it("é determinístico para a mesma pasta", async () => {
    const pasta = mundo();
    expect(await gerarManifesto(pasta, opcoes)).toEqual(await gerarManifesto(pasta, opcoes));
  });

  it("pastas vazias não entram no manifesto", async () => {
    const pasta = mundo();
    mkdirSync(join(pasta, "vazia", "dentro"), { recursive: true });
    const m = await gerarManifesto(pasta, opcoes);
    expect(m.arquivos.some((a) => a.caminho.startsWith("vazia"))).toBe(false);
  });

  it("ignora session.lock e links simbólicos, avisando do link", async () => {
    const pasta = mundo();
    writeFileSync(join(pasta, "session.lock"), "x");
    symlinkSync(join(pasta, "level.dat"), join(pasta, "atalho.dat"));
    const avisos: string[] = [];
    const m = await gerarManifesto(pasta, { ...opcoes, aviso: (t) => avisos.push(t) });
    const caminhos = m.arquivos.map((a) => a.caminho);
    expect(caminhos).not.toContain("session.lock");
    expect(caminhos).not.toContain("atalho.dat");
    expect(avisos.join()).toContain("atalho.dat");
  });

  // Lento (~20 s): só sob pedido, como o mundo de 200 MB.
  it.skipIf(process.env["SABRE_TESTE_LENTO"] !== "1")(
    "lê em fluxo: arquivo de 2,5 GiB (esparso) que readFile não consegue ler inteiro",
    async () => {
      const pasta = mundo();
      truncateSync(join(pasta, "level.dat"), 2.5 * 1024 ** 3);
      const m = await gerarManifesto(pasta, opcoes);
      expect(m.arquivos.find((a) => a.caminho === "level.dat")?.tamanho).toBe(2.5 * 1024 ** 3);
    },
    60_000,
  );
});

describe("gerarManifesto: Windows e arquivos não comuns", () => {
  it("recusa mundo com nome que o Windows não aceita, antes de ler os arquivos", async () => {
    const pasta = mundo();
    writeFileSync(join(pasta, "CON.txt"), "x");
    await expect(gerarManifesto(pasta, opcoes)).rejects.toThrow(/Windows/);
  });

  it("recusa duas regiões que só diferem na maiúscula", async () => {
    const pasta = mundo();
    mkdirSync(join(pasta, "region"), { recursive: true });
    writeFileSync(join(pasta, "region", "R.mca"), "1");
    writeFileSync(join(pasta, "region", "r.mca"), "2");
    await expect(gerarManifesto(pasta, opcoes)).rejects.toThrow(/maiúscula/);
  });

  it.skipIf(process.platform === "win32")("avisa de FIFO em vez de pular em silêncio", async () => {
    const pasta = mundo();
    execFileSync("mkfifo", [join(pasta, "canal")]);
    const avisos: string[] = [];
    const m = await gerarManifesto(pasta, { ...opcoes, aviso: (t) => avisos.push(t) });
    expect(avisos.some((t) => t.includes("canal"))).toBe(true);
    expect(m.arquivos.some((a) => a.caminho === "canal")).toBe(false);
  });
});

it("mundo de 20 MB: lê em pedaços pequenos, um arquivo por vez (memória não cresce com o tamanho do mundo)", async () => {
  // Medir `arrayBuffers` com gc por amostra dependia da velocidade da máquina (o lixo entre dois gc chegava a
  // 8-14 MB sob carga). Aqui se mede o que a causa: tamanho do pedaço e quantos arquivos abertos ao mesmo tempo.
  const pasta = mundo("20MB");
  leituras.length = 0;
  const m = await gerarManifesto(pasta, opcoes);
  expect(m.arquivos.length).toBe(81);
  expect(leituras.length).toBeGreaterThanOrEqual(81);
  expect(Math.max(...leituras.map((l) => l.pedaco))).toBeLessThanOrEqual(1024 * 1024);
  expect(Math.max(...leituras.map((l) => l.abertos))).toBe(1);
}, 30_000);

describe("compararManifestos", () => {
  it("muda 2 regiões: só as 2 aparecem em mudados", async () => {
    const pasta = mundo();
    const a = await gerarManifesto(pasta, opcoes);
    const mudadas = mudarRegioes(pasta, 2);
    const b = await gerarManifesto(pasta, opcoes);
    const diff = compararManifestos(a, b);
    expect(diff.mudados.sort()).toEqual(mudadas.sort());
    expect(diff.novos).toEqual([]);
    expect(diff.apagados).toEqual([]);
  });

  it("aponta arquivo novo e apagado", async () => {
    const pasta = mundo();
    const a = await gerarManifesto(pasta, opcoes);
    mkdirSync(join(pasta, "data"));
    writeFileSync(join(pasta, "data", "novo.dat"), "oi");
    unlinkSync(join(pasta, "level.dat"));
    const diff = compararManifestos(a, await gerarManifesto(pasta, opcoes));
    expect(diff).toEqual({ novos: ["data/novo.dat"], mudados: [], apagados: ["level.dat"] });
  });
});

describe("validarManifesto", () => {
  const base = {
    formato: 1,
    versao: 1,
    epoca: 1,
    criadoEm: "2026-10-30T12:00:00.000Z",
  };
  const arq = (caminho: string) => ({ caminho, tamanho: 1, sha256: "a".repeat(64) });

  it("aceita um manifesto gerado", async () => {
    const m = await gerarManifesto(mundo(), opcoes);
    expect(validarManifesto(JSON.parse(JSON.stringify(m)))).toEqual(m);
  });

  it.each(["../x", "a/../../x", "/etc/x", "C:\\x", "a\\b", "C:/x", ""])(
    "recusa o caminho %j",
    (caminho) => {
      expect(() => validarManifesto({ ...base, arquivos: [arq(caminho)] })).toThrow(/caminho/i);
    },
  );

  it("recusa sha256 que não é texto e tamanho que não é inteiro seguro", () => {
    const hex = "a".repeat(64);
    expect(() =>
      validarManifesto({ ...base, arquivos: [{ caminho: "a", tamanho: 1, sha256: [hex] }] }),
    ).toThrow(/inválido/);
    for (const tamanho of [-1, 1.5, 2 ** 53, "1"]) {
      expect(() =>
        validarManifesto({ ...base, arquivos: [{ caminho: "a", tamanho, sha256: hex }] }),
      ).toThrow(/inválido/);
    }
  });

  it("recusa formato desconhecido, hash ruim e caminho repetido", () => {
    expect(() => validarManifesto({ ...base, formato: 2, arquivos: [] })).toThrow();
    expect(() =>
      validarManifesto({ ...base, arquivos: [{ caminho: "a", tamanho: 1, sha256: "zz" }] }),
    ).toThrow();
    expect(() => validarManifesto({ ...base, arquivos: [arq("a"), arq("a")] })).toThrow();
    expect(() => validarManifesto(null)).toThrow();
  });

  it.each([
    "CON.txt",
    "nul",
    "a/COM1",
    "lpt9.dat",
    "Aux.tar.gz",
    "COM¹",
    "com².txt",
    "LPT³",
    "lpt¹.dat",
    "CONIN$",
    "conout$.log",
    "a/CONOUT$",
    "prn ",
    "a/con .txt",
  ])("recusa o nome reservado do Windows %j", (caminho) => {
    expect(() => validarManifesto({ ...base, arquivos: [arq(caminho)] })).toThrow(/caminho/i);
  });

  it.each([
    "a.",
    "a ",
    "d/a./b",
    "a:b",
    "a?b",
    "a*b",
    'a"b',
    "a<b",
    "a>b",
    "a|b",
    "a\u0001b",
    "a\u001fb",
  ])("recusa o nome %j que o Windows não aceita", (caminho) => {
    expect(() => validarManifesto({ ...base, arquivos: [arq(caminho)] })).toThrow(/caminho/i);
  });

  it("aceita nomes parecidos com reservados que o Windows aceita", () => {
    const nomes = [
      "console.txt",
      "com10",
      "com¹0",
      "conin",
      "con$x",
      "lpt0",
      "region/r.0.0.mca",
      "a.b",
      ".hidden",
    ];
    expect(validarManifesto({ ...base, arquivos: nomes.map(arq) }).arquivos).toHaveLength(9);
  });

  it("recusa caminhos que colidem sem diferenciar maiúscula", () => {
    expect(() =>
      validarManifesto({ ...base, arquivos: [arq("region/R.mca"), arq("region/r.mca")] }),
    ).toThrow(/maiúscula/);
  });

  it("recusa profundidade 33 e aceita 32", () => {
    const fundo = (n: number) => Array.from({ length: n }, () => "d").join("/");
    expect(() => validarManifesto({ ...base, arquivos: [arq(fundo(33))] })).toThrow(/profundidade/);
    expect(validarManifesto({ ...base, arquivos: [arq(fundo(32))] }).arquivos).toHaveLength(1);
  });

  it("recusa caminho de 241 caracteres e aceita 240", () => {
    expect(() => validarManifesto({ ...base, arquivos: [arq("a".repeat(241))] })).toThrow(/longo/);
    expect(validarManifesto({ ...base, arquivos: [arq("a".repeat(240))] }).arquivos).toHaveLength(
      1,
    );
  });

  it("recusa 200 001 arquivos (lista sintética) e aceita 200 000", () => {
    const lista = (n: number) => Array.from({ length: n }, (_, i) => arq(`f${i}`));
    expect(() => validarManifesto({ ...base, arquivos: lista(200_001) })).toThrow(/arquivos/);
    expect(validarManifesto({ ...base, arquivos: lista(200_000) }).arquivos).toHaveLength(200_000);
  });

  it("devolve objeto reconstruído, sem campos extras", () => {
    const sujo = {
      ...base,
      extra: 1,
      arquivos: [{ ...arq("a"), modo: 0o777, __proto__: { x: 1 } }],
    };
    const m = validarManifesto(sujo);
    expect(m).toEqual({ ...base, arquivos: [arq("a")] });
    expect(m).not.toBe(sujo);
    expect(Object.keys(m.arquivos[0] as object).sort()).toEqual(["caminho", "sha256", "tamanho"]);
  });
});
