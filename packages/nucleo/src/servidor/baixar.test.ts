import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createServer as createServidorHttps } from "node:https";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { baixarConferido, type OpcoesDownload } from "./baixar.js";

const conteudo = Buffer.from("conteudo-de-teste-".repeat(200));
const sha256 = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const hashCerto = { algoritmo: "sha256", valor: sha256(conteudo) } as const;

/** O servidor de teste é http em 127.0.0.1: o teste liga a exceção, como o app nunca faz. */
const baixar = (o: OpcoesDownload) => baixarConferido({ permitirHttpLocal: true, ...o });

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

describe("http na rede privada", () => {
  it.each(["http://192.168.0.5/a", "http://10.66.1.5/a", "http://8.8.8.8/a"])(
    "recusa %s mesmo com permitirHttpPrivado",
    async (u) => {
      await expect(
        baixarConferido({
          url: u,
          hashEsperado: hashCerto,
          destino: join(pasta, "x"),
          permitirHttpPrivado: true,
        }),
      ).rejects.toThrow(/https/);
    },
  );
});

describe("baixarConferido", () => {
  it("hash certo: renomeia para o destino e não deixa parcial", async () => {
    const destino = join(pasta, "a.jar");
    const r = await baixar({ url: url(), hashEsperado: hashCerto, destino });
    expect(r).toEqual({ caminho: destino, doCache: false });
    expect(await readFile(destino)).toEqual(conteudo);
    expect(await readdir(pasta)).toEqual(["a.jar"]);
  });

  it("hash errado: recusa em pt-BR e não deixa arquivo final nem parcial", async () => {
    const destino = join(pasta, "a.jar");
    const hashErrado = { algoritmo: "sha256", valor: "0".repeat(64) } as const;
    await expect(baixar({ url: url(), hashEsperado: hashErrado, destino })).rejects.toThrow(
      /não confere/,
    );
    expect(await readdir(pasta)).toEqual([]);
  });

  it("segunda chamada usa o cache: zero requisições", async () => {
    const destino = join(pasta, "a.jar");
    await baixar({ url: url(), hashEsperado: hashCerto, destino });
    requisicoes = 0;
    const r = await baixar({ url: url(), hashEsperado: hashCerto, destino });
    expect(r.doCache).toBe(true);
    expect(requisicoes).toBe(0);
  });

  it("arquivo final corrompido não vale como cache: baixa de novo", async () => {
    const destino = join(pasta, "a.jar");
    await writeFile(destino, "lixo");
    const r = await baixar({ url: url(), hashEsperado: hashCerto, destino });
    expect(r.doCache).toBe(false);
    expect(await readFile(destino)).toEqual(conteudo);
  });

  it("queda no meio: a próxima chamada retoma com Range + If-Range e recebe 206", async () => {
    const destino = join(pasta, "a.jar");
    manipulador = (_req, res) => responder(res, conteudo, 1000);
    await expect(
      baixar({ url: url(), hashEsperado: hashCerto, destino, tentativas: 1 }),
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
    await baixar({ url: url(), hashEsperado: hashCerto, destino });
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
    await baixar({ url: url(), hashEsperado: hashCerto, destino });
    expect(requisicoes).toBe(2);
    expect(await readFile(destino)).toEqual(conteudo);
  });

  it("servidor responde 200 no lugar de 206: recomeça do zero", async () => {
    const destino = join(pasta, "a.jar");
    manipulador = (_req, res) => responder(res, conteudo, 1000);
    await expect(
      baixar({ url: url(), hashEsperado: hashCerto, destino, tentativas: 1 }),
    ).rejects.toThrow();
    manipulador = (_req, res) => responder(res, conteudo);
    await baixar({ url: url(), hashEsperado: hashCerto, destino });
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
    await baixar({ url: url(), hashEsperado: hashCerto, destino });
    expect(range).toBeUndefined();
    expect(await readFile(destino)).toEqual(conteudo);
  });

  it("recusa http fora da máquina local e algoritmo/hash malformado", async () => {
    const destino = join(pasta, "a.jar");
    await expect(
      baixar({ url: "http://exemplo.com/a.jar", hashEsperado: hashCerto, destino }),
    ).rejects.toThrow(/https/);
    await expect(
      baixar({
        url: url(),
        hashEsperado: { algoritmo: "sha256", valor: "abc" },
        destino,
      }),
    ).rejects.toThrow(/hash/);
    expect(requisicoes).toBe(0);
  });

  it("http em localhost sem a opção permitirHttpLocal: recusa sem tocar a rede", async () => {
    const destino = join(pasta, "a.jar");
    await expect(baixarConferido({ url: url(), hashEsperado: hashCerto, destino })).rejects.toThrow(
      /https/,
    );
    expect(requisicoes).toBe(0);
  });

  it("HTTP de erro: falha em pt-BR sem criar arquivo final", async () => {
    const destino = join(pasta, "a.jar");
    manipulador = (_req, res) => {
      res.writeHead(404);
      res.end();
    };
    await expect(baixar({ url: url(), hashEsperado: hashCerto, destino })).rejects.toThrow(/404/);
    expect(existsSync(destino)).toBe(false);
  });

  it("final corrompido é apagado antes de baixar; se o download falha, ele não fica", async () => {
    const destino = join(pasta, "a.jar");
    await writeFile(destino, "lixo");
    manipulador = (_req, res) => {
      res.writeHead(500);
      res.end();
    };
    await expect(baixar({ url: url(), hashEsperado: hashCerto, destino })).rejects.toThrow(/500/);
    expect(existsSync(destino)).toBe(false);
  });

  it("416 na retomada: recomeça do zero sem Range", async () => {
    const destino = join(pasta, "a.jar");
    manipulador = (_req, res) => responder(res, conteudo, 1000);
    await expect(
      baixar({ url: url(), hashEsperado: hashCerto, destino, tentativas: 1 }),
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
    await baixar({ url: url(), hashEsperado: hashCerto, destino });
    expect(ranges).toHaveLength(2);
    expect(ranges[1]).toBeUndefined();
    expect(await readFile(destino)).toEqual(conteudo);
  });

  it("206 com Content-Range fora do lugar: descarta o parcial e recomeça de verdade", async () => {
    const destino = join(pasta, "a.jar");
    manipulador = (_req, res) => responder(res, conteudo, 1000);
    await expect(
      baixar({ url: url(), hashEsperado: hashCerto, destino, tentativas: 1 }),
    ).rejects.toThrow();
    manipulador = (req, res) => {
      if (!req.headers.range) return responder(res, conteudo);
      res.writeHead(206, { "content-range": "bytes 5-9/10", "content-length": 5 });
      res.end("12345");
    };
    await baixar({ url: url(), hashEsperado: hashCerto, destino });
    expect(await readFile(destino)).toEqual(conteudo);
  });

  it("retomada seguida de hash errado: limpa parcial e .meta", async () => {
    const destino = join(pasta, "a.jar");
    manipulador = (_req, res) => responder(res, conteudo, 1000);
    await expect(
      baixar({ url: url(), hashEsperado: hashCerto, destino, tentativas: 1 }),
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
    await expect(baixar({ url: url(), hashEsperado: hashCerto, destino })).rejects.toThrow(
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
      baixar({
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
      baixar({ url: url(), hashEsperado: hashCerto, destino, tamanhoMaximo: 100 }),
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
      baixar({ url: url(), hashEsperado: hashCerto, destino, tamanhoMaximo: 100 }),
    ).rejects.toThrow(/limite/);
    expect(await readdir(pasta)).toEqual([]);
  });

  it("redirecionamento para http: recusa; para https não seguro nem tenta", async () => {
    const destino = join(pasta, "a.jar");
    manipulador = (_req, res) => {
      res.writeHead(301, { location: "http://exemplo.com/a.jar" });
      res.end();
    };
    await expect(baixar({ url: url(), hashEsperado: hashCerto, destino })).rejects.toThrow(
      /não seguro/,
    );
    expect(await readdir(pasta)).toEqual([]);
  });

  describe("redirecionamento https e tempo total", () => {
    let https: Server;
    let pastaCert: string;
    let hopsHttps = 0;
    const tlsAntes = process.env.NODE_TLS_REJECT_UNAUTHORIZED;
    const urlHttps = (k: number) =>
      `https://127.0.0.1:${(https.address() as AddressInfo).port}/h/${k}`;

    /** Certificado autoassinado gerado agora, só para o servidor https local do teste. */
    beforeAll(async () => {
      pastaCert = await mkdtemp(join(tmpdir(), "sabre-cert-"));
      const chave = join(pastaCert, "k.pem");
      const cert = join(pastaCert, "c.pem");
      execFileSync(
        "openssl",
        ["req", "-x509", "-newkey", "rsa:2048", "-nodes", "-keyout", chave, "-out", cert].concat([
          "-days",
          "1",
          "-subj",
          "/CN=127.0.0.1",
        ]),
        { stdio: "ignore" },
      );
      // O fetch do Node não aceita CA só para uma chamada: a confiança vale só neste bloco.
      process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
      https = createServidorHttps(
        { key: await readFile(chave), cert: await readFile(cert) },
        (req, res) => {
          hopsHttps++;
          const k = Number(/\/h\/(\d+)/.exec(req.url ?? "")?.[1]);
          if (k < saltosHttps) {
            res.writeHead(302, { location: `/h/${k + 1}` });
            return void res.end();
          }
          responder(res, conteudo);
        },
      );
      await new Promise<void>((ok) => https.listen(0, "127.0.0.1", ok));
    });

    afterAll(async () => {
      if (tlsAntes === undefined) delete process.env.NODE_TLS_REJECT_UNAUTHORIZED;
      else process.env.NODE_TLS_REJECT_UNAUTHORIZED = tlsAntes;
      https.closeAllConnections();
      await new Promise((ok) => https.close(ok));
      await rm(pastaCert, { recursive: true, force: true });
    });

    let saltosHttps = 0;
    beforeEach(() => {
      hopsHttps = 0;
    });

    /** O http local dá o 1º salto; o https local dá mais `saltos` antes do 200. */
    const comSaltos = (saltos: number) => {
      saltosHttps = saltos;
      manipulador = (_req, res) => {
        res.writeHead(301, { location: urlHttps(0) });
        res.end();
      };
    };

    it("5 redirecionamentos https até o 200: baixa, hash confere e só fica o final", async () => {
      const destino = join(pasta, "a.jar");
      comSaltos(4); // 1 (http local) + 4 (https) = 5, o limite
      const r = await baixar({ url: url(), hashEsperado: hashCerto, destino });
      expect(r).toEqual({ caminho: destino, doCache: false });
      expect(await readFile(destino)).toEqual(conteudo);
      expect(await readdir(pasta)).toEqual(["a.jar"]);
      expect(hopsHttps).toBe(5);
    });

    it("um salto além do limite (6): recusa, não segue o 6º e não deixa arquivo", async () => {
      const destino = join(pasta, "a.jar");
      comSaltos(5);
      await expect(baixar({ url: url(), hashEsperado: hashCerto, destino })).rejects.toThrow(
        /redirecionou/,
      );
      expect(hopsHttps).toBe(5);
      expect(await readdir(pasta)).toEqual([]);
    });
  });

  it("tempoTotal estourado com o servidor ainda mandando dados: cancela e não cria o arquivo final", async () => {
    const destino = join(pasta, "a.jar");
    let gota: NodeJS.Timeout | undefined;
    manipulador = (_req, res) => {
      res.writeHead(200, { "transfer-encoding": "chunked" });
      gota = setInterval(() => res.write("x"), 20); // nunca termina, mas nunca fica parado
      res.on("close", () => clearInterval(gota));
    };
    // tempoSemDados alto: só o tempo total pode cortar este download.
    await expect(
      baixar({
        url: url(),
        hashEsperado: hashCerto,
        destino,
        tempoTotal: 300,
        tempoSemDados: 60_000,
      }),
    ).rejects.toThrow(/demorou demais/);
    clearInterval(gota);
    // O parcial fica (a próxima chamada retoma); o que nunca pode existir é o arquivo final.
    expect(existsSync(destino)).toBe(false);
  });
});
