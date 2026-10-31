import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, stat, writeFile, mkdir } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { montarVersao } from "./montar.js";

const sha1 = (b: Buffer | string) => createHash("sha1").update(b).digest("hex");

const cliente = Buffer.from("jar-do-cliente");
const biblioteca = Buffer.from("jar-da-biblioteca");
const bibliotecaLinux = Buffer.from("jar-so-linux");
const asset1 = Buffer.from("som-1");
const asset2 = Buffer.from("textura-2");

let servidor: Server;
let base: string;
let cache: string;
let pedidos: string[];
let corpos: Map<string, Buffer>;

function montarMundoFalso(
  opcoes: { jsonSha1Errado?: boolean; caminhoLib?: string; hostLib?: string } = {},
) {
  const indice = JSON.stringify({
    objects: {
      "a/b.ogg": { hash: sha1(asset1), size: asset1.length },
      "c.png": { hash: sha1(asset2), size: asset2.length },
    },
  });
  corpos = new Map<string, Buffer>([
    ["/client.jar", cliente],
    ["/lib.jar", biblioteca],
    ["/liblinux.jar", bibliotecaLinux],
    ["/indice.json", Buffer.from(indice)],
    [`/obj/${sha1(asset1).slice(0, 2)}/${sha1(asset1)}`, asset1],
    [`/obj/${sha1(asset2).slice(0, 2)}/${sha1(asset2)}`, asset2],
  ]);
  const versaoJson = JSON.stringify({
    id: "1.21.1",
    downloads: { client: { url: `${base}/client.jar`, sha1: sha1(cliente), size: cliente.length } },
    javaVersion: { majorVersion: 21 },
    assetIndex: { id: "17", url: `${base}/indice.json`, sha1: sha1(indice), size: indice.length },
    libraries: [
      {
        name: "a:b:1",
        downloads: {
          artifact: {
            path: opcoes.caminhoLib ?? "a/b/1/b-1.jar",
            url: opcoes.hostLib ?? `${base}/lib.jar`,
            sha1: sha1(biblioteca),
            size: biblioteca.length,
          },
        },
      },
      {
        name: "c:d:1",
        rules: [{ action: "allow", os: { name: "linux" } }],
        downloads: {
          artifact: {
            path: "c/d/1/d-1.jar",
            url: `${base}/liblinux.jar`,
            sha1: sha1(bibliotecaLinux),
            size: bibliotecaLinux.length,
          },
        },
      },
    ],
  });
  corpos.set("/1.21.1.json", Buffer.from(versaoJson));
  const manifesto = JSON.stringify({
    versions: [
      {
        id: "1.21.1",
        type: "release",
        url: "https://piston-meta.mojang.com/v1/packages/x/1.21.1.json",
        sha1: opcoes.jsonSha1Errado ? "0".repeat(40) : sha1(versaoJson),
      },
    ],
  });
  return async (url: string): Promise<string> => {
    if (url.endsWith("version_manifest_v2.json")) return manifesto;
    if (url === "https://piston-meta.mojang.com/v1/packages/x/1.21.1.json") return versaoJson;
    throw new Error(`url inesperada ${url}`);
  };
}

beforeEach(async () => {
  pedidos = [];
  servidor = createServer((req, res) => {
    pedidos.push(req.url ?? "");
    const corpo = corpos.get(req.url ?? "");
    if (!corpo) return void res.writeHead(404).end();
    res.writeHead(200, { "content-length": corpo.length }).end(corpo);
  });
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
  base = `http://127.0.0.1:${(servidor.address() as AddressInfo).port}`;
  cache = await mkdtemp(join(tmpdir(), "sabre-montar-"));
});

afterEach(async () => {
  servidor.closeAllConnections();
  await new Promise((ok) => servidor.close(ok));
  await rm(cache, { recursive: true, force: true });
});

const existe = (c: string) =>
  stat(c).then(
    () => true,
    () => false,
  );

describe("montarVersao", () => {
  it("baixa cliente, biblioteca do Windows e assets no cache e marca como montada", async () => {
    const buscar = montarMundoFalso();
    const r = await montarVersao({ versao: "1.21.1", cache, buscar, permitirHttpLocal: true });
    expect(await readFile(r.jarCliente)).toEqual(cliente);
    expect(r.bibliotecas).toHaveLength(1);
    expect(await readFile(r.bibliotecas[0] ?? "")).toEqual(biblioteca);
    expect(r.assets).toBe(2);
    expect(r.javaMajor).toBe(21);
    expect(await existe(join(cache, "libraries/c/d/1/d-1.jar"))).toBe(false); // regra: só linux
    expect(
      await existe(join(cache, "assets/objects", sha1(asset1).slice(0, 2), sha1(asset1))),
    ).toBe(true);
    expect(await existe(join(cache, "versions/1.21.1/.montada.json"))).toBe(true);
  });

  it("segunda montagem usa o cache: nenhum arquivo é baixado de novo", async () => {
    const buscar = montarMundoFalso();
    await montarVersao({ versao: "1.21.1", cache, buscar, permitirHttpLocal: true });
    pedidos.length = 0;
    await montarVersao({ versao: "1.21.1", cache, buscar, permitirHttpLocal: true });
    expect(pedidos).toEqual([]);
  });

  it("peça com hash errado aborta e a versão não fica marcada como montada", async () => {
    const buscar = montarMundoFalso();
    corpos.set("/lib.jar", Buffer.from("adulterado!!!!!!!"));
    await expect(
      montarVersao({ versao: "1.21.1", cache, buscar, permitirHttpLocal: true }),
    ).rejects.toThrow(/confere/);
    expect(await existe(join(cache, "versions/1.21.1/.montada.json"))).toBe(false);
    expect(await existe(join(cache, "libraries/a/b/1/b-1.jar"))).toBe(false);
  });

  it("recusa o JSON da versão cujo sha1 não bate com o manifesto", async () => {
    const buscar = montarMundoFalso({ jsonSha1Errado: true });
    await expect(
      montarVersao({ versao: "1.21.1", cache, buscar, permitirHttpLocal: true }),
    ).rejects.toThrow(/não confere/);
    expect(pedidos).toEqual([]);
  });

  it("recusa caminho de biblioteca que sai do cache", async () => {
    const buscar = montarMundoFalso({ caminhoLib: "../../fora.jar" });
    await expect(
      montarVersao({ versao: "1.21.1", cache, buscar, permitirHttpLocal: true }),
    ).rejects.toThrow(/caminho/i);
    expect(await existe(join(cache, "..", "fora.jar"))).toBe(false);
  });

  it("recusa download fora dos servidores oficiais (sem a exceção de teste)", async () => {
    const buscar = montarMundoFalso();
    await expect(montarVersao({ versao: "1.21.1", cache, buscar })).rejects.toThrow();
    expect(pedidos).toEqual([]);
  });

  it("recusa versão que não está na lista oficial", async () => {
    const buscar = montarMundoFalso();
    await expect(
      montarVersao({ versao: "1.99", cache, buscar, permitirHttpLocal: true }),
    ).rejects.toThrow(/lista oficial/);
  });

  it("baixa o Java com hash conferido no cache compartilhado (download injetado)", async () => {
    const buscar = montarMundoFalso();
    const java = Buffer.from("zip-do-java");
    const chamadas: string[] = [];
    const comJava = async (url: string): Promise<string> =>
      url.includes("adoptium")
        ? JSON.stringify([
            {
              binary: {
                package: {
                  link: "https://github.com/x/jre.zip",
                  checksum: createHash("sha256").update(java).digest("hex"),
                },
              },
            },
          ])
        : buscar(url);
    const r = await montarVersao({
      versao: "1.21.1",
      cache,
      buscar: comJava,
      permitirHttpLocal: true,
      java: true,
      baixar: async (o) => {
        if (o.url.startsWith("https://github.com/")) {
          chamadas.push(o.url);
          await mkdir(join(o.destino, ".."), { recursive: true });
          await writeFile(o.destino, java);
          return { caminho: o.destino, doCache: false };
        }
        const { baixarConferido } = await import("../servidor/baixar.js");
        return baixarConferido(o);
      },
    });
    expect(chamadas).toHaveLength(1);
    expect(r.pacoteJava && (await readFile(r.pacoteJava))).toEqual(java);
  });
});
