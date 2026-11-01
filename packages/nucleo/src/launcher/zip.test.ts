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

  it("arquivo que não é zip: recusa", async () => {
    const z = join(raiz, "jre.zip");
    await writeFile(z, "isto não é zip");
    await expect(extrairJava(z, join(raiz, "jre-21"))).rejects.toThrow(/zip/);
    expect(await sobras()).toEqual([]);
  });
});
