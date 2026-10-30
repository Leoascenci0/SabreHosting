import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { baixarConferido } from "./baixar.js";

const conteudo = Buffer.from("conteudo-de-teste-".repeat(200));
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const hashCerto = { algoritmo: "sha256", valor: sha256(conteudo) } as const;

type Manipulador = (req: IncomingMessage, res: ServerResponse, n: number) => void;

let servidor: Server;
let pasta: string;
let requisicoes = 0;
let manipulador: Manipulador;

const url = () => `http://127.0.0.1:${(servidor.address() as AddressInfo).port}/arquivo.jar`;

/** Resposta completa; `cortarEm` derruba a conexão depois de N bytes. */
function responder(res: ServerResponse, corpo: Buffer, cortarEm?: number) {
  res.writeHead(200, { "content-length": corpo.length, etag: '"v1"' });
  if (cortarEm === undefined) return void res.end(corpo);
  res.write(corpo.subarray(0, cortarEm), () => setTimeout(() => res.destroy(), 50));
}

beforeEach(async () => {
  requisicoes = 0;
  pasta = await mkdtemp(join(tmpdir(), "sabre-baixar-"));
  manipulador = (_req, res) => responder(res, conteudo);
  servidor = createServer((req, res) => manipulador(req, res, ++requisicoes));
  await new Promise<void>((ok) => servidor.listen(0, "127.0.0.1", ok));
});

afterEach(async () => {
  servidor.closeAllConnections();
  await new Promise((ok) => servidor.close(ok));
  await rm(pasta, { recursive: true, force: true });
});

describe("baixarConferido", () => {
  it("hash certo: renomeia para o destino e não deixa parcial", async () => {
    const destino = join(pasta, "a.jar");
    const r = await baixarConferido({ url: url(), hashEsperado: hashCerto, destino });
    expect(r).toEqual({ caminho: destino, doCache: false });
    expect(await readFile(destino)).toEqual(conteudo);
    expect(await readdir(pasta)).toEqual(["a.jar"]);
  });

  it("hash errado: recusa em pt-BR e não deixa arquivo final nem parcial", async () => {
    const destino = join(pasta, "a.jar");
    const hashErrado = { algoritmo: "sha256", valor: "0".repeat(64) } as const;
    await expect(
      baixarConferido({ url: url(), hashEsperado: hashErrado, destino }),
    ).rejects.toThrow(/não confere/);
    expect(await readdir(pasta)).toEqual([]);
  });

  it("segunda chamada usa o cache: zero requisições", async () => {
    const destino = join(pasta, "a.jar");
    await baixarConferido({ url: url(), hashEsperado: hashCerto, destino });
    requisicoes = 0;
    const r = await baixarConferido({ url: url(), hashEsperado: hashCerto, destino });
    expect(r.doCache).toBe(true);
    expect(requisicoes).toBe(0);
  });

  it("arquivo final corrompido não vale como cache: baixa de novo", async () => {
    const destino = join(pasta, "a.jar");
    await writeFile(destino, "lixo");
    const r = await baixarConferido({ url: url(), hashEsperado: hashCerto, destino });
    expect(r.doCache).toBe(false);
    expect(await readFile(destino)).toEqual(conteudo);
  });

  it("queda no meio: a próxima chamada retoma com Range + If-Range e recebe 206", async () => {
    const destino = join(pasta, "a.jar");
    manipulador = (_req, res) => responder(res, conteudo, 1000);
    await expect(
      baixarConferido({ url: url(), hashEsperado: hashCerto, destino, tentativas: 1 }),
    ).rejects.toThrow(/conexão/);
    expect(existsSync(`${destino}.parcial`)).toBe(true);
    expect(existsSync(destino)).toBe(false);

    let cabecalhos: IncomingMessage["headers"] = {};
    manipulador = (req, res) => {
      cabecalhos = req.headers;
      const ini = Number(/bytes=(\d+)-/.exec(req.headers.range ?? "")?.[1]);
      const resto = conteudo.subarray(ini);
      res.writeHead(206, {
        "content-length": resto.length,
        "content-range": `bytes ${ini}-${conteudo.length - 1}/${conteudo.length}`,
      });
      res.end(resto);
    };
    await baixarConferido({ url: url(), hashEsperado: hashCerto, destino });
    expect(cabecalhos.range).toMatch(/^bytes=\d+-$/);
    expect(cabecalhos["if-range"]).toBe('"v1"');
    expect(await readFile(destino)).toEqual(conteudo);
    expect(await readdir(pasta)).toEqual(["a.jar"]);
  });

  it("queda no meio com tentativas sobrando: retoma sozinho na mesma chamada", async () => {
    const destino = join(pasta, "a.jar");
    manipulador = (req, res, n) => {
      if (n === 1) return responder(res, conteudo, 1000);
      const ini = Number(/bytes=(\d+)-/.exec(req.headers.range ?? "")?.[1]);
      const resto = conteudo.subarray(ini);
      res.writeHead(206, {
        "content-length": resto.length,
        "content-range": `bytes ${ini}-${conteudo.length - 1}/${conteudo.length}`,
      });
      res.end(resto);
    };
    await baixarConferido({ url: url(), hashEsperado: hashCerto, destino });
    expect(requisicoes).toBe(2);
    expect(await readFile(destino)).toEqual(conteudo);
  });

  it("servidor responde 200 no lugar de 206: recomeça do zero", async () => {
    const destino = join(pasta, "a.jar");
    manipulador = (_req, res) => responder(res, conteudo, 1000);
    await expect(
      baixarConferido({ url: url(), hashEsperado: hashCerto, destino, tentativas: 1 }),
    ).rejects.toThrow();
    manipulador = (_req, res) => responder(res, conteudo);
    await baixarConferido({ url: url(), hashEsperado: hashCerto, destino });
    expect(await readFile(destino)).toEqual(conteudo);
  });

  it("parcial sem validador (ETag) não é retomado: recomeça do zero", async () => {
    const destino = join(pasta, "a.jar");
    await writeFile(`${destino}.parcial`, "pedaco-sem-meta");
    let range: string | undefined = "x";
    manipulador = (req, res) => {
      range = req.headers.range;
      responder(res, conteudo);
    };
    await baixarConferido({ url: url(), hashEsperado: hashCerto, destino });
    expect(range).toBeUndefined();
    expect(await readFile(destino)).toEqual(conteudo);
  });

  it("recusa http fora da máquina local e algoritmo/hash malformado", async () => {
    const destino = join(pasta, "a.jar");
    await expect(
      baixarConferido({ url: "http://exemplo.com/a.jar", hashEsperado: hashCerto, destino }),
    ).rejects.toThrow(/https/);
    await expect(
      baixarConferido({
        url: url(),
        hashEsperado: { algoritmo: "sha256", valor: "abc" },
        destino,
      }),
    ).rejects.toThrow(/hash/);
    expect(requisicoes).toBe(0);
  });

  it("HTTP de erro: falha em pt-BR sem criar arquivo final", async () => {
    const destino = join(pasta, "a.jar");
    manipulador = (_req, res) => {
      res.writeHead(404);
      res.end();
    };
    await expect(baixarConferido({ url: url(), hashEsperado: hashCerto, destino })).rejects.toThrow(
      /404/,
    );
    expect(existsSync(destino)).toBe(false);
  });

  it("final corrompido é apagado antes de baixar; se o download falha, ele não fica", async () => {
    const destino = join(pasta, "a.jar");
    await writeFile(destino, "lixo");
    manipulador = (_req, res) => {
      res.writeHead(500);
      res.end();
    };
    await expect(baixarConferido({ url: url(), hashEsperado: hashCerto, destino })).rejects.toThrow(
      /500/,
    );
    expect(existsSync(destino)).toBe(false);
  });

  it("416 na retomada: recomeça do zero sem Range", async () => {
    const destino = join(pasta, "a.jar");
    manipulador = (_req, res) => responder(res, conteudo, 1000);
    await expect(
      baixarConferido({ url: url(), hashEsperado: hashCerto, destino, tentativas: 1 }),
    ).rejects.toThrow();
    const ranges: (string | undefined)[] = [];
    manipulador = (req, res) => {
      ranges.push(req.headers.range);
      if (req.headers.range) {
        res.writeHead(416);
        return void res.end();
      }
      responder(res, conteudo);
    };
    await baixarConferido({ url: url(), hashEsperado: hashCerto, destino });
    expect(ranges).toHaveLength(2);
    expect(ranges[1]).toBeUndefined();
    expect(await readFile(destino)).toEqual(conteudo);
  });

  it("206 com Content-Range fora do lugar: descarta o parcial e recomeça de verdade", async () => {
    const destino = join(pasta, "a.jar");
    manipulador = (_req, res) => responder(res, conteudo, 1000);
    await expect(
      baixarConferido({ url: url(), hashEsperado: hashCerto, destino, tentativas: 1 }),
    ).rejects.toThrow();
    manipulador = (req, res) => {
      if (!req.headers.range) return responder(res, conteudo);
      res.writeHead(206, { "content-range": "bytes 5-9/10", "content-length": 5 });
      res.end("12345");
    };
    await baixarConferido({ url: url(), hashEsperado: hashCerto, destino });
    expect(await readFile(destino)).toEqual(conteudo);
  });

  it("retomada seguida de hash errado: limpa parcial e .meta", async () => {
    const destino = join(pasta, "a.jar");
    manipulador = (_req, res) => responder(res, conteudo, 1000);
    await expect(
      baixarConferido({ url: url(), hashEsperado: hashCerto, destino, tentativas: 1 }),
    ).rejects.toThrow();
    manipulador = (req, res) => {
      const ini = Number(/bytes=(\d+)-/.exec(req.headers.range ?? "")?.[1]);
      const resto = Buffer.from("x".repeat(conteudo.length - ini));
      res.writeHead(206, {
        "content-length": resto.length,
        "content-range": `bytes ${ini}-${conteudo.length - 1}/${conteudo.length}`,
      });
      res.end(resto);
    };
    await expect(baixarConferido({ url: url(), hashEsperado: hashCerto, destino })).rejects.toThrow(
      /não confere/,
    );
    expect(await readdir(pasta)).toEqual([]);
  });

  it("servidor que para de mandar bytes: desiste pelo tempo sem dados", async () => {
    const destino = join(pasta, "a.jar");
    manipulador = (_req, res) => {
      res.writeHead(200, { "content-length": conteudo.length });
      res.write("a");
    };
    await expect(
      baixarConferido({
        url: url(),
        hashEsperado: hashCerto,
        destino,
        tentativas: 1,
        tempoSemDados: 150,
      }),
    ).rejects.toThrow(/parou de enviar/);
    expect(existsSync(destino)).toBe(false);
  });

  it("arquivo acima do teto: recusa pelo Content-Length e não deixa nada", async () => {
    const destino = join(pasta, "a.jar");
    await expect(
      baixarConferido({ url: url(), hashEsperado: hashCerto, destino, tamanhoMaximo: 100 }),
    ).rejects.toThrow(/limite/);
    expect(await readdir(pasta)).toEqual([]);
  });

  it("arquivo acima do teto sem Content-Length: aborta o fluxo e apaga o parcial", async () => {
    const destino = join(pasta, "a.jar");
    manipulador = (_req, res) => {
      res.writeHead(200, { "transfer-encoding": "chunked" });
      res.end(conteudo);
    };
    await expect(
      baixarConferido({ url: url(), hashEsperado: hashCerto, destino, tamanhoMaximo: 100 }),
    ).rejects.toThrow(/limite/);
    expect(await readdir(pasta)).toEqual([]);
  });

  it("redirecionamento para http: recusa; para https não seguro nem tenta", async () => {
    const destino = join(pasta, "a.jar");
    manipulador = (_req, res) => {
      res.writeHead(301, { location: "http://exemplo.com/a.jar" });
      res.end();
    };
    await expect(baixarConferido({ url: url(), hashEsperado: hashCerto, destino })).rejects.toThrow(
      /não seguro/,
    );
    expect(await readdir(pasta)).toEqual([]);
  });
});
