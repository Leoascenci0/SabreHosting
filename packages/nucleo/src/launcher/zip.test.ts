import { mkdtemp, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { montarZip, type EntradaDeZip } from "../../test/ajuda/zip.js";
import { extrairJava } from "./zip.js";

let raiz: string;
beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), "sabre-java-"));
});
afterEach(() => rm(raiz, { recursive: true, force: true }));

const f = (nome: string, texto = "x"): EntradaDeZip => ({ nome, dados: Buffer.from(texto) });
const javaOk = [f("jdk-21+7-jre/bin/javaw.exe", "MZ"), f("jdk-21+7-jre/lib/modules", "m")];

async function zipEm(entradas: EntradaDeZip[]): Promise<string> {
  const z = join(raiz, "jre.zip");
  await writeFile(z, montarZip(entradas));
  return z;
}
const sobras = async () => (await readdir(raiz)).filter((n) => n !== "jre.zip");

describe("extrairJava", () => {
  it("extrai para a pasta final e acha o javaw", async () => {
    const destino = join(raiz, "jre-21");
    const r = await extrairJava(await zipEm(javaOk), destino);
    expect(r.javaw).toBe(join(destino, "jdk-21+7-jre", "bin", "javaw.exe"));
    expect(await readFile(r.javaw, "utf8")).toBe("MZ");
    expect(await sobras()).toEqual(["jre-21"]);
  });

  it("já extraído: reaproveita sem refazer", async () => {
    const destino = join(raiz, "jre-21");
    const z = await zipEm(javaOk);
    const a = await extrairJava(z, destino);
    const antes = (await stat(a.javaw)).ino;
    const b = await extrairJava(z, destino);
    expect(b.javaw).toBe(a.javaw);
    expect((await stat(b.javaw)).ino).toBe(antes);
  });

  describe("reaproveitamento confere o javaw (lancmel-2.8)", () => {
    const ORIGINAL = "MZ-original";
    const zipJava = () =>
      zipEm([f("jdk-21+7-jre/bin/javaw.exe", ORIGINAL), f("jdk-21+7-jre/lib/modules")]);

    it.each([
      ["1 byte trocado", async (j: string) => writeFile(j, "MZ-originaX")],
      ["truncado", async (j: string) => writeFile(j, "MZ-ori")],
      ["sumido", async (j: string) => rm(j)],
    ])("javaw %s: extrai de novo e volta ao original", async (_t, estraga) => {
      const destino = join(raiz, "jre-21");
      const z = await zipJava();
      const a = await extrairJava(z, destino);
      await estraga(a.javaw);
      const b = await extrairJava(z, destino);
      expect(b.javaw).toBe(a.javaw);
      expect(await readFile(b.javaw, "utf8")).toBe(ORIGINAL);
      expect(await sobras()).toEqual(["jre-21"]);
    });

    it("marcador antigo (sem tamanho/hash): extrai de novo, mesmo com o javaw trocado", async () => {
      const destino = join(raiz, "jre-21");
      const z = await zipJava();
      const a = await extrairJava(z, destino);
      await writeFile(
        join(destino, ".java.json"),
        JSON.stringify({ javaw: "jdk-21+7-jre/bin/javaw.exe" }),
      );
      await writeFile(a.javaw, "TROCADO");
      const b = await extrairJava(z, destino);
      expect(await readFile(b.javaw, "utf8")).toBe(ORIGINAL);
      const m = JSON.parse(await readFile(join(destino, ".java.json"), "utf8")) as Record<
        string,
        unknown
      >;
      expect(m.tamanho).toBe(Buffer.byteLength(ORIGINAL));
      expect(m.sha256).toMatch(/^[0-9a-f]{64}$/);
    });

    it("intacto: não extrai de novo", async () => {
      const destino = join(raiz, "jre-21");
      const z = await zipJava();
      const a = await extrairJava(z, destino);
      const antes = (await stat(a.javaw)).ino;
      await rm(z); // sem o zip, só reaproveitando é que não falha
      const b = await extrairJava(z, destino);
      expect((await stat(b.javaw)).ino).toBe(antes);
    });
  });

  it.each([
    ["com ..", "../fora.txt"],
    ["no meio", "jdk/../../fora.txt"],
    ["absoluto", "/etc/fora.txt"],
    ["com barra de volta", "jdk\\..\\fora.txt"],
    ["com unidade", "C:/fora.txt"],
  ])("recusa entrada %s e não deixa nada", async (_t, nome) => {
    const destino = join(raiz, "jre-21");
    await expect(extrairJava(await zipEm([...javaOk, f(nome)]), destino)).rejects.toThrow(
      /recusado/,
    );
    expect(await sobras()).toEqual([]);
  });

  it("recusa link simbólico", async () => {
    const destino = join(raiz, "jre-21");
    const link: EntradaDeZip = {
      nome: "jdk/bin/atalho",
      dados: Buffer.from("/etc"),
      modo: 0o120777,
    };
    await expect(extrairJava(await zipEm([...javaOk, link]), destino)).rejects.toThrow(/link/);
    expect(await sobras()).toEqual([]);
  });

  it("zip sem javaw: falha e não deixa pasta", async () => {
    const destino = join(raiz, "jre-21");
    await expect(extrairJava(await zipEm([f("jdk/lib/modules")]), destino)).rejects.toThrow(
      /javaw/,
    );
    expect(await sobras()).toEqual([]);
  });

  it("falha no meio (tamanho adulterado): não deixa pasta pela metade", async () => {
    const destino = join(raiz, "jre-21");
    const ruim: EntradaDeZip = {
      nome: "jdk/lib/x",
      dados: Buffer.from("abc"),
      tamanhoDeclarado: 99,
    };
    await expect(extrairJava(await zipEm([...javaOk, ruim]), destino)).rejects.toThrow();
    expect(await sobras()).toEqual([]);
  });

  it("recusa pelo tamanho total declarado, antes de ler", async () => {
    const destino = join(raiz, "jre-21");
    const grande: EntradaDeZip = {
      nome: "jdk/lib/enorme",
      dados: Buffer.from("x"),
      tamanhoDeclarado: 2 * 1024 ** 3,
    };
    await expect(extrairJava(await zipEm([...javaOk, grande]), destino)).rejects.toThrow(
      /tamanho total/,
    );
    expect(await sobras()).toEqual([]);
  });

  it("recusa zip com entradas demais (mais de 20 mil)", async () => {
    const destino = join(raiz, "jre-21");
    const muitas = Array.from({ length: 20_001 }, (_, i) => f(`jdk/p/${i}`, ""));
    await expect(extrairJava(await zipEm([...javaOk, ...muitas]), destino)).rejects.toThrow(
      /entradas demais/,
    );
    expect(await sobras()).toEqual([]);
  });

  it.each([
    ["igual", "jdk/lib/a", "jdk/lib/a"],
    ["só na caixa", "jdk/lib/A", "jdk/lib/a"],
  ])("recusa entrada repetida (%s) em vez de sobrescrever", async (_t, um, outro) => {
    const destino = join(raiz, "jre-21");
    await expect(
      extrairJava(await zipEm([...javaOk, f(um, "1"), f(outro, "2")]), destino),
    ).rejects.toThrow(/duas vezes/);
    expect(await sobras()).toEqual([]);
  });

  it("arquivo que não é zip: recusa", async () => {
    const z = join(raiz, "jre.zip");
    await writeFile(z, "isto não é zip");
    await expect(extrairJava(z, join(raiz, "jre-21"))).rejects.toThrow(/zip/);
    expect(await sobras()).toEqual([]);
  });
});
