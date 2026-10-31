import { createHash } from "node:crypto";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { baixarConferido } from "./baixar.js";
import { resolverAdoptium } from "./resolvedores.js";
import {
  URL_MANIFESTO,
  buscarPadrao,
  listarVersoes,
  opcoesDaVersao,
  planoDaVersao,
  urlAdoptium,
  type Buscar,
} from "./versoes.js";

const sha1 = "a".repeat(40);
const jsonUrl = (id: string) => `https://piston-meta.mojang.com/v1/packages/x/${id}.json`;
const manifesto = {
  versions: [
    { id: "26w01a", type: "snapshot", url: jsonUrl("26w01a") },
    { id: "1.21.1", type: "release", url: jsonUrl("1.21.1") },
    { id: "1.20.1", type: "release", url: jsonUrl("1.20.1") },
    { id: "1.19.4", type: "release", url: jsonUrl("1.19.4") },
    { id: "1.7.10", type: "release", url: "https://evil.test/1.7.10.json" },
    { id: "../x", type: "release", url: jsonUrl("x") },
    { id: "b1.7.3", type: "old_beta", url: jsonUrl("b1.7.3") },
  ],
};
const versaoJson = (id: string) => ({
  id,
  downloads: {
    server: { url: `https://piston-data.mojang.com/v1/objects/${id}/server.jar`, sha1 },
  },
  javaVersion: { majorVersion: id === "1.21.1" ? 21 : 17 },
});

const MAVEN = `<metadata><versioning><versions>
<version>20.4.190</version><version>21.0.5</version><version>21.1.1</version><version>21.1.2</version>
</versions></versioning></metadata>`;
const MAVEN_LEGADO = "<versions><version>1.20.1-47.1.106</version></versions>";

function falso(extra: Record<string, string> = {}): Buscar & { pedidos: string[] } {
  const pedidos: string[] = [];
  const f = async (url: string) => {
    pedidos.push(url);
    if (extra[url] !== undefined) return extra[url];
    if (url === URL_MANIFESTO) return JSON.stringify(manifesto);
    const m = /\/([\d.]+)\.json$/.exec(url);
    if (m?.[1]) return JSON.stringify(versaoJson(m[1]));
    throw new Error("sem rede nos testes: " + url);
  };
  return Object.assign(f, { pedidos });
}

describe("listarVersoes", () => {
  it("só release de id e URL confiáveis, na ordem do manifesto (mais nova primeiro)", async () => {
    expect((await listarVersoes(falso())).map((v) => v.id)).toEqual(["1.21.1", "1.20.1", "1.19.4"]);
  });
  it("manifesto sem lista é recusado", async () => {
    await expect(listarVersoes(async () => "{}")).rejects.toThrow(/manifesto/);
  });
});

describe("planoDaVersao", () => {
  it("devolve jar (url oficial + sha1 do manifesto) e o Java daquela versão", async () => {
    expect(await planoDaVersao("1.21.1", falso())).toEqual({
      versao: "1.21.1",
      jar: {
        url: "https://piston-data.mojang.com/v1/objects/1.21.1/server.jar",
        hashEsperado: { algoritmo: "sha1", valor: sha1 },
      },
      javaMajor: 21,
    });
    expect((await planoDaVersao("1.20.1", falso())).javaMajor).toBe(17);
  });
  it("versão fora da lista (snapshot, id estranho, URL não oficial) é recusada sem baixar o JSON", async () => {
    for (const v of ["26w01a", "../x", "1.7.10", "9.9.9"]) {
      const b = falso();
      await expect(planoDaVersao(v, b)).rejects.toThrow(/lista oficial/);
      expect(b.pedidos).toEqual([URL_MANIFESTO]);
    }
  });
});

describe("urlAdoptium + resolverAdoptium", () => {
  it("monta o pedido com a versão maior e recusa Java absurdo", () => {
    expect(urlAdoptium(21)).toContain("/latest/21/hotspot");
    expect(() => urlAdoptium(0)).toThrow(/Java/);
    expect(() => urlAdoptium(21.5)).toThrow(/Java/);
    const link = "https://github.com/adoptium/jre.zip";
    expect(
      resolverAdoptium([{ binary: { package: { link, checksum: "b".repeat(64) } } }]).url,
    ).toBe(link);
  });
});

describe("opcoesDaVersao (o que dá em cada versão)", () => {
  const modrinth = (v: string) =>
    "https://api.modrinth.com/v2/project/connector/version?game_versions=" +
    encodeURIComponent(`["${v}"]`) +
    "&loaders=" +
    encodeURIComponent('["neoforge"]');
  const maven = "https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml";
  const legado = "https://maven.neoforged.net/releases/net/neoforged/forge/maven-metadata.xml";

  it("com NeoForge e Connector oferece NeoForge, Fabric+Forge e sem mods", async () => {
    const b = falso({ [maven]: MAVEN, [modrinth("1.21.1")]: '[{"id":"c1"}]' });
    expect(await opcoesDaVersao("1.21.1", b)).toEqual({
      neoforge: true,
      fabricForge: true,
      semMods: true,
      consultou: true,
    });
  });
  it("versão sem Connector não oferece Fabric+Forge", async () => {
    const b = falso({ [maven]: MAVEN, [modrinth("1.21.1")]: "[]" });
    expect(await opcoesDaVersao("1.21.1", b)).toMatchObject({ neoforge: true, fabricForge: false });
  });
  it("1.20.1 usa o Maven legado; antes da 1.20.1 e versão sem build: só sem mods, sem consulta", async () => {
    const b = falso({ [legado]: MAVEN_LEGADO, [modrinth("1.20.1")]: '[{"id":"c"}]' });
    expect(await opcoesDaVersao("1.20.1", b)).toMatchObject({ neoforge: true, fabricForge: true });
    const antiga = falso();
    expect(await opcoesDaVersao("1.19.4", antiga)).toEqual({
      neoforge: false,
      fabricForge: false,
      semMods: true,
      consultou: true,
    });
    expect(antiga.pedidos).toEqual([]);
    expect(await opcoesDaVersao("1.21.9", falso({ [maven]: MAVEN }))).toMatchObject({
      neoforge: false,
      fabricForge: false,
    });
  });
  it("consulta que falha vira só 'sem mods' (nunca bloqueia a escolha)", async () => {
    expect(await opcoesDaVersao("1.21.1", falso())).toEqual({
      neoforge: false,
      fabricForge: false,
      semMods: true,
      consultou: false,
    });
  });
  it("id de versão estranho é recusado antes de qualquer consulta", async () => {
    const b = falso();
    await expect(opcoesDaVersao("1.21/../x", b)).rejects.toThrow(/inválida/);
    expect(b.pedidos).toEqual([]);
  });
});

describe("hash errado do server.jar", () => {
  it("recusa e não deixa o arquivo baixado na pasta", async () => {
    const corpo = Buffer.from("jar-de-teste");
    const srv = createServer((_q, r) => r.end(corpo));
    await new Promise<void>((ok) => srv.listen(0, "127.0.0.1", ok));
    const pasta = await mkdtemp(join(tmpdir(), "sabre-versoes-"));
    try {
      const plano = await planoDaVersao("1.21.1", falso()); // sha1 "aaaa…" não é o do corpo
      await expect(
        baixarConferido({
          url: `http://127.0.0.1:${(srv.address() as AddressInfo).port}/server.jar`,
          hashEsperado: plano.jar.hashEsperado,
          destino: join(pasta, "server.jar"),
          permitirHttpLocal: true,
        }),
      ).rejects.toThrow(/não confere/);
      expect(await readdir(pasta)).toEqual([]);
      expect(createHash("sha1").update(corpo).digest("hex")).not.toBe(sha1);
    } finally {
      srv.closeAllConnections();
      await new Promise((ok) => srv.close(ok));
      await rm(pasta, { recursive: true, force: true });
    }
  });
});

describe("buscarPadrao (rede real trocada por fetch falso)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const teto = 8 * 1024 * 1024;
  const falsoFetch = (r: Response | Error) => {
    const f = vi.fn(async (...args: [string, RequestInit?]) => {
      void args;
      if (r instanceof Error) throw r;
      return r;
    });
    vi.stubGlobal("fetch", f);
    return f;
  };
  it("pede com redirect:'error' e devolve o texto", async () => {
    const f = falsoFetch(new Response('{"ok":1}'));
    expect(await buscarPadrao("https://piston-meta.mojang.com/x.json")).toBe('{"ok":1}');
    expect(f.mock.calls[0]?.[1]).toMatchObject({ redirect: "error" });
  });
  it("redirect vira erro", async () => {
    falsoFetch(new TypeError("fetch failed: redirect mode is set to error"));
    await expect(buscarPadrao("https://piston-meta.mojang.com/x.json")).rejects.toThrow(/redirect/);
  });
  it("content-length acima do teto: recusa sem ler o corpo", async () => {
    const lido = vi.fn();
    const corpo = new ReadableStream(
      {
        pull(c) {
          lido();
          c.close();
        },
      },
      { highWaterMark: 0 },
    );
    falsoFetch(new Response(corpo, { headers: { "content-length": String(teto + 1) } }));
    await expect(buscarPadrao("https://piston-meta.mojang.com/x.json")).rejects.toThrow(
      /grande demais/,
    );
    expect(lido).not.toHaveBeenCalled();
  });
  it("sem content-length: corta no teto e cancela o resto", async () => {
    let enviados = 0;
    let cancelado = false;
    const corpo = new ReadableStream({
      pull(c) {
        enviados++;
        c.enqueue(new Uint8Array(1024 * 1024));
      },
      cancel() {
        cancelado = true;
      },
    });
    falsoFetch(new Response(corpo));
    await expect(buscarPadrao("https://piston-meta.mojang.com/x.json")).rejects.toThrow(
      /grande demais/,
    );
    expect(cancelado).toBe(true);
    expect(enviados).toBeLessThan(20);
  });
  it("só https", async () => {
    await expect(buscarPadrao("http://piston-meta.mojang.com/x.json")).rejects.toThrow(/https/);
  });
});
