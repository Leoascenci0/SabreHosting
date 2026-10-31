import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { crc32 } from "node:zlib";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gravarInstancia, montarInstancia, nomeSeguroDoGrupo } from "./instancia.js";

const base = { grupo: "Amigos", versaoMinecraft: "1.21.1", versaoNeoForge: "21.1.172", mods: [] };

/** Lê um zip sem compressão (método 0) pelo diretório central, conferindo o CRC de cada entrada. */
function lerZip(zip: Buffer): Map<string, string> {
  const fim = zip.lastIndexOf(Buffer.from([0x50, 0x4b, 0x05, 0x06]));
  expect(fim).toBeGreaterThanOrEqual(0);
  const total = zip.readUInt16LE(fim + 10);
  let pos = zip.readUInt32LE(fim + 16);
  const saida = new Map<string, string>();
  for (let i = 0; i < total; i++) {
    expect(zip.readUInt32LE(pos)).toBe(0x02014b50);
    expect(zip.readUInt16LE(pos + 10)).toBe(0);
    const crc = zip.readUInt32LE(pos + 16);
    const tam = zip.readUInt32LE(pos + 24);
    const nome = zip.subarray(pos + 46, pos + 46 + zip.readUInt16LE(pos + 28)).toString("utf8");
    const local = zip.readUInt32LE(pos + 42);
    const dados = local + 30 + zip.readUInt16LE(local + 26) + zip.readUInt16LE(local + 28);
    const conteudo = zip.subarray(dados, dados + tam);
    expect(crc32(conteudo)).toBe(crc);
    saida.set(nome, conteudo.toString("utf8"));
    pos +=
      46 + zip.readUInt16LE(pos + 28) + zip.readUInt16LE(pos + 30) + zip.readUInt16LE(pos + 32);
  }
  return saida;
}

let raiz: string;
beforeEach(async () => {
  raiz = await mkdtemp(join(tmpdir(), "instancia-"));
});
afterEach(() => rm(raiz, { recursive: true, force: true }));

describe("montarInstancia", () => {
  it("gera o índice do Modrinth (formatVersion 1) com Minecraft e NeoForge", () => {
    const r = montarInstancia(base);
    const arquivos = lerZip(r.bytes);
    expect([...arquivos.keys()]).toEqual(["modrinth.index.json"]);
    const indice = JSON.parse(arquivos.get("modrinth.index.json") ?? "");
    expect(indice).toEqual({
      formatVersion: 1,
      game: "minecraft",
      versionId: "1.21.1-21.1.172",
      name: "SabreHosting — Amigos",
      files: [],
      dependencies: { minecraft: "1.21.1", neoforge: "21.1.172" },
    });
    expect(r.indice).toEqual(indice);
    expect(r.nomeArquivo).toBe("Amigos.mrpack");
  });

  it("é pura: mesma entrada, mesmos bytes", () => {
    expect(montarInstancia(base).bytes.equals(montarInstancia(base).bytes)).toBe(true);
  });

  it("higieniza o nome do grupo para nome de arquivo do Windows", () => {
    expect(nomeSeguroDoGrupo('Os "Craques": 2/3?')).toBe("Os Craques 23");
    expect(nomeSeguroDoGrupo("CON")).toBe("CON_");
    expect(nomeSeguroDoGrupo("  turma.  ")).toBe("turma");
    expect(nomeSeguroDoGrupo("a".repeat(200)).length).toBeLessThanOrEqual(64);
    // O corte não pode deixar a metade de um emoji (par substituto) no fim do nome.
    const emoji = nomeSeguroDoGrupo("a".repeat(63) + "😀");
    expect(emoji).toBe("a".repeat(63) + "😀");
    expect(nomeSeguroDoGrupo("😀".repeat(70))).toBe("😀".repeat(64));
    expect(montarInstancia({ ...base, grupo: "A/B" }).nomeArquivo).toBe("AB.mrpack");
    // O nome exibido no Prism mantém o texto do grupo, sem controles.
    expect(montarInstancia({ ...base, grupo: "A\nB" }).indice.name).toBe("SabreHosting — A B");
  });

  it("recusa grupo vazio e versões estranhas, em pt-BR", () => {
    expect(() => montarInstancia({ ...base, grupo: " /? " })).toThrow(/nome do grupo/i);
    expect(() => montarInstancia({ ...base, versaoMinecraft: '1.21"x' })).toThrow(/versão/i);
    expect(() => montarInstancia({ ...base, versaoNeoForge: "" })).toThrow(/versão/i);
  });
});

describe("gravarInstancia", () => {
  it("grava em <destino>/SabreHosting/<grupo>.mrpack e é idempotente", async () => {
    const um = await gravarInstancia({ ...base, pastaDestino: raiz });
    expect(um).toEqual({ caminho: join(raiz, "SabreHosting", "Amigos.mrpack"), alterado: true });
    const bytes = await readFile(um.caminho);
    expect(bytes.equals(montarInstancia(base).bytes)).toBe(true);
    const dois = await gravarInstancia({ ...base, pastaDestino: raiz });
    expect(dois).toEqual({ caminho: um.caminho, alterado: false });
    const tres = await gravarInstancia({ ...base, versaoNeoForge: "21.1.200", pastaDestino: raiz });
    expect(tres.alterado).toBe(true);
    expect(await readdir(join(raiz, "SabreHosting"))).toEqual(["Amigos.mrpack"]);
  });

  it("não toca em instâncias nem arquivos alheios", async () => {
    const alheia = join(raiz, "instances", "Meu Modpack");
    await mkdir(alheia, { recursive: true });
    await writeFile(join(alheia, "instance.cfg"), "name=Meu Modpack");
    await mkdir(join(raiz, "SabreHosting"));
    await writeFile(join(raiz, "SabreHosting", "Outro.mrpack"), "do amigo");
    await gravarInstancia({ ...base, pastaDestino: raiz });
    await gravarInstancia({ ...base, versaoMinecraft: "1.21.4", pastaDestino: raiz });
    expect(await readFile(join(alheia, "instance.cfg"), "utf8")).toBe("name=Meu Modpack");
    expect(await readFile(join(raiz, "SabreHosting", "Outro.mrpack"), "utf8")).toBe("do amigo");
  });

  it("só trata 'não existe' como arquivo ausente; outros erros de leitura são repassados sem gravar", async () => {
    const acesso = Object.assign(new Error("sem permissão"), { code: "EACCES" });
    await expect(
      gravarInstancia({ ...base, pastaDestino: raiz, lerArquivo: () => Promise.reject(acesso) }),
    ).rejects.toBe(acesso);
    expect(await readdir(raiz)).toEqual([]);
  });

  it("trata ENOENT na leitura como arquivo ainda não gravado", async () => {
    const sumido = Object.assign(new Error("não existe"), { code: "ENOENT" });
    const r = await gravarInstancia({
      ...base,
      pastaDestino: raiz,
      lerArquivo: () => Promise.reject(sumido),
    });
    expect(r.alterado).toBe(true);
    expect(await readFile(r.caminho)).toEqual(montarInstancia(base).bytes);
  });

  it("não deixa arquivo temporário para trás", async () => {
    await gravarInstancia({ ...base, pastaDestino: raiz });
    expect((await readdir(join(raiz, "SabreHosting"))).filter((n) => n.includes("tmp"))).toEqual(
      [],
    );
  });
});
