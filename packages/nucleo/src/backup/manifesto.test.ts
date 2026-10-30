import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  truncateSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { setFlagsFromString } from "node:v8";
import { runInNewContext } from "node:vm";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { gerarMundo, hashesDoMundo, mudarRegioes } from "../../test/ajuda/mundos.js";
import { compararManifestos, gerarManifesto, validarManifesto } from "./manifesto.js";

const pastas: string[] = [];
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

it("mundo de 20 MB: memória viva não cresce com o tamanho do mundo", async () => {
  setFlagsFromString("--expose-gc");
  const gc = runInNewContext("gc") as () => void;
  const pasta = mundo("20MB");
  gc();
  const antes = process.memoryUsage().arrayBuffers;
  let pico = antes;
  const timer = setInterval(() => {
    gc();
    pico = Math.max(pico, process.memoryUsage().arrayBuffers);
  }, 20);
  const m = await gerarManifesto(pasta, opcoes);
  clearInterval(timer);
  expect(m.arquivos.length).toBe(81);
  expect(pico - antes).toBeLessThan(8 * 1024 * 1024);
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

  it("recusa formato desconhecido, hash ruim e caminho repetido", () => {
    expect(() => validarManifesto({ ...base, formato: 2, arquivos: [] })).toThrow();
    expect(() =>
      validarManifesto({ ...base, arquivos: [{ caminho: "a", tamanho: 1, sha256: "zz" }] }),
    ).toThrow();
    expect(() => validarManifesto({ ...base, arquivos: [arq("a"), arq("a")] })).toThrow();
    expect(() => validarManifesto(null)).toThrow();
  });
});
