import { describe, expect, it } from "vitest";
import {
  resolverAdoptium,
  resolverModrinth,
  resolverMojang,
  resolverNeoForge,
} from "./resolvedores.js";

const sha1 = "a".repeat(40);
const sha256 = "b".repeat(64);
const sha512 = "c".repeat(128);

describe("resolverAdoptium", () => {
  const json = [
    {
      binary: {
        package: {
          link: "https://exemplo.test/jdk.zip",
          checksum: sha256,
          name: "jdk.zip",
          size: 10,
        },
      },
    },
  ];
  it("devolve url e sha256 do primeiro pacote", () => {
    expect(resolverAdoptium(json)).toEqual({
      url: "https://exemplo.test/jdk.zip",
      hashEsperado: { algoritmo: "sha256", valor: sha256 },
    });
  });
  it("resposta vazia ou sem checksum: recusa", () => {
    expect(() => resolverAdoptium([])).toThrow(/Adoptium/);
    expect(() => resolverAdoptium([{ binary: { package: { link: "https://x.test/a" } } }])).toThrow(
      /hash/,
    );
  });
});

describe("resolverModrinth", () => {
  const versao = {
    files: [
      { url: "https://cdn.test/outro.jar", primary: false, hashes: { sha512: "d".repeat(128) } },
      { url: "https://cdn.test/mod.jar", primary: true, hashes: { sha1, sha512 } },
    ],
  };
  it("prefere o arquivo primário e o sha512", () => {
    expect(resolverModrinth(versao)).toEqual({
      url: "https://cdn.test/mod.jar",
      hashEsperado: { algoritmo: "sha512", valor: sha512 },
    });
  });
  it("sem sha512: recusa", () => {
    expect(() =>
      resolverModrinth({ files: [{ url: "https://x.test/a", hashes: { sha1 } }] }),
    ).toThrow(/hash/);
  });
});

describe("url que não é https", () => {
  it("Adoptium e Modrinth recusam http e endereço inválido", () => {
    const h = "a".repeat(64);
    for (const link of ["http://x.test/a", "ftp://x.test/a", "não-é-url"]) {
      expect(() => resolverAdoptium([{ binary: { package: { link, checksum: h } } }])).toThrow(
        /https/,
      );
      expect(() =>
        resolverModrinth({ files: [{ url: link, hashes: { sha512: "d".repeat(128) } }] }),
      ).toThrow(/https/);
    }
  });
});

describe("resolverNeoForge", () => {
  const tabela = { "9.9.9": sha1 };
  it("monta a URL do instalador no Maven oficial e usa o hash da tabela", () => {
    const r = resolverNeoForge(
      "9.9.9",
      `${sha1.toUpperCase()}  neoforge-9.9.9-installer.jar\n`,
      tabela,
    );
    expect(r).toEqual({
      url: "https://maven.neoforged.net/releases/net/neoforged/neoforge/9.9.9/neoforge-9.9.9-installer.jar",
      hashEsperado: { algoritmo: "sha1", valor: sha1 },
    });
  });
  it("sidecar adulterado (servidor comprometido): recusa", () => {
    expect(() => resolverNeoForge("9.9.9", "d".repeat(40), tabela)).toThrow(/não confere/);
  });
  it("versão sem entrada na tabela: recusa, sem cair para o sidecar", () => {
    expect(() => resolverNeoForge("1.2.3", sha1, tabela)).toThrow(/ainda não tem o hash conferido/);
    expect(() => resolverNeoForge("9.9.9", sha1, {})).toThrow(/ainda não tem o hash conferido/);
  });
  it("a tabela padrão não vem com valor real: versão qualquer é recusada", () => {
    expect(() => resolverNeoForge("9.9.9", sha1)).toThrow(/ainda não tem o hash conferido/);
  });
  it("versão obrigatória, sem ../ nem -x, e sidecar válido", () => {
    expect(() => resolverNeoForge("", sha1, tabela)).toThrow(/versão/);
    expect(() => resolverNeoForge("../x", sha1, tabela)).toThrow(/versão/);
    expect(() => resolverNeoForge("-x", sha1, tabela)).toThrow(/versão/);
    expect(() => resolverNeoForge("..", sha1, tabela)).toThrow(/versão/);
    expect(() => resolverNeoForge("x.1", sha1, tabela)).toThrow(/versão/);
    expect(resolverNeoForge("1.x", sha1, { "1.x": sha1 }).url).toContain("/1.x/");
    expect(() => resolverNeoForge("9.9.9", "não-é-hash", tabela)).toThrow(/hash/);
  });
});

describe("resolverMojang", () => {
  const json = (url: string, sha: unknown = sha1, java: unknown = 21) => ({
    downloads: { server: { url, sha1: sha } },
    javaVersion: { majorVersion: java },
  });
  const ok = "https://piston-data.mojang.com/v1/objects/abc/server.jar";
  it("devolve url, sha1 e Java maior", () => {
    expect(resolverMojang(json(ok))).toEqual({
      url: ok,
      hashEsperado: { algoritmo: "sha1", valor: sha1 },
      javaMajor: 21,
    });
  });
  it("recusa host fora da Mojang, http, sem sha1, sem servidor e Java estranho", () => {
    expect(() => resolverMojang(json("https://evil.test/server.jar"))).toThrow(/oficiais/);
    expect(() => resolverMojang(json("https://piston-data.mojang.com.evil.test/s.jar"))).toThrow(
      /oficiais/,
    );
    expect(() => resolverMojang(json("http://piston-data.mojang.com/s.jar"))).toThrow(/https/);
    expect(() => resolverMojang(json(ok, "zz"))).toThrow(/sha1/);
    expect(() => resolverMojang({ downloads: {} })).toThrow(/servidor/);
    expect(() => resolverMojang(json(ok, sha1, "21"))).toThrow(/Java/);
    expect(() => resolverMojang(json(ok, sha1, 1000))).toThrow(/Java/);
    expect(() => resolverMojang(null)).toThrow(/servidor/);
  });
});
