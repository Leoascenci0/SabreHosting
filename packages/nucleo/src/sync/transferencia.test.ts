import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { ErroDownload } from "../servidor/baixar.js";
import {
  conferirEnderecoPrivado,
  pedirArquivo,
  servirArquivos,
  type Servidor,
} from "./transferencia.js";

const conteudo = Buffer.from("regiao-de-teste-".repeat(500));
const sha = (b: Buffer) => createHash("sha256").update(b).digest("hex");
const HASH = sha(conteudo);
const CREDENCIAL = "token-do-pc-teste";

let pasta: string;
let arquivo: string;
let servidor: Servidor | undefined;
let falso: Server | undefined;

beforeEach(async () => {
  pasta = await mkdtemp(join(tmpdir(), "sabre-transf-"));
  arquivo = join(pasta, "regiao.pacote");
  await writeFile(arquivo, conteudo);
});
afterEach(async () => {
  await servidor?.fechar();
  await new Promise((ok) => (falso ? falso.close(ok) : ok(undefined)));
  servidor = falso = undefined;
  await rm(pasta, { recursive: true, force: true });
});

const subir = async (arquivos = (h: string) => (h === HASH ? { caminho: arquivo } : undefined)) =>
  (servidor = await servirArquivos({
    endereco: "127.0.0.1",
    porta: 0,
    permitirLoopbackParaTeste: true,
    conferirToken: async (t) => (t === CREDENCIAL ? "pc-do-lucas" : null),
    arquivos,
  }));
const portaDoServidor = () => {
  if (!servidor) throw new Error("servidor de teste não subiu");
  return servidor.porta;
};
const url = (h = HASH) => `http://127.0.0.1:${portaDoServidor()}/arquivos/${h}`;
const pedir = (h = HASH, extra: Record<string, string> = {}) =>
  fetch(url(h), { headers: { authorization: `Bearer ${CREDENCIAL}`, ...extra } });

describe("endereço do servidor", () => {
  it.each([
    "0.0.0.0",
    "::",
    "::1",
    "8.8.8.8",
    "192.168.0.5",
    "10.66.1.5",
    "localhost",
    "::ffff:10.66.0.2",
  ])("recusa %s", (e) => expect(() => conferirEnderecoPrivado(e)).toThrow(/rede privada/));
  it("aceita só o IP da rede privada; loopback apenas no teste", () => {
    expect(conferirEnderecoPrivado("10.66.0.7")).toBe("10.66.0.7");
    expect(() => conferirEnderecoPrivado("127.0.0.1")).toThrow();
    expect(conferirEnderecoPrivado("127.0.0.1", true)).toBe("127.0.0.1");
  });
  it("servirArquivos não sobe em 0.0.0.0", async () => {
    await expect(
      servirArquivos({
        endereco: "0.0.0.0",
        porta: 0,
        conferirToken: async () => "x",
        arquivos: () => undefined,
      }),
    ).rejects.toThrow(/rede privada/);
  });
});

describe("servidor", () => {
  it("sem token ou com token errado: 401, sem consultar arquivo", async () => {
    let consultas = 0;
    await subir((h) => (consultas++, h === HASH ? { caminho: arquivo } : undefined));
    expect((await fetch(url())).status).toBe(401);
    expect((await pedir(HASH, { authorization: "Bearer errado" })).status).toBe(401);
    expect(consultas).toBe(0);
  });
  it("entrega o arquivo com ETag = hash", async () => {
    await subir();
    const r = await pedir();
    expect(r.status).toBe(200);
    expect(r.headers.get("etag")).toBe(`"${HASH}"`);
    expect(Buffer.from(await r.arrayBuffer()).equals(conteudo)).toBe(true);
  });
  it("hash desconhecido ou fora do formato e caminho: 404, nunca lê pasta", async () => {
    await subir();
    expect((await pedir("a".repeat(64))).status).toBe(404);
    expect((await pedir("..%2F..%2Fetc%2Fpasswd")).status).toBe(404);
    expect((await pedir("regiao.pacote")).status).toBe(404);
  });
  it("Range devolve 206 com o trecho; fora do fim, 416; If-Range diferente manda inteiro", async () => {
    await subir();
    const r = await pedir(HASH, { range: "bytes=100-" });
    expect(r.status).toBe(206);
    expect(r.headers.get("content-range")).toBe(
      `bytes 100-${conteudo.length - 1}/${conteudo.length}`,
    );
    expect(Buffer.from(await r.arrayBuffer()).equals(conteudo.subarray(100))).toBe(true);
    expect((await pedir(HASH, { range: `bytes=${conteudo.length}-` })).status).toBe(416);
    expect((await pedir(HASH, { range: "bytes=10-", "if-range": '"outro"' })).status).toBe(200);
    expect((await pedir(HASH, { range: "bytes=10-", "if-range": `"${HASH}"` })).status).toBe(206);
  });
  it("falha ao conferir o token (cartório fora): 503", async () => {
    servidor = await servirArquivos({
      endereco: "127.0.0.1",
      porta: 0,
      permitirLoopbackParaTeste: true,
      conferirToken: async () => {
        throw new Error("cartório fora");
      },
      arquivos: () => ({ caminho: arquivo }),
    });
    expect((await pedir()).status).toBe(503);
  });
});

describe("cliente", () => {
  const baixar = (destino: string, hash = HASH) =>
    pedirArquivo({
      endereco: "127.0.0.1",
      porta: servidor?.porta ?? (falso?.address() as AddressInfo).port,
      sha256: hash,
      token: CREDENCIAL,
      destino,
      permitirLoopbackParaTeste: true,
    });

  it("baixa e confere", async () => {
    await subir();
    const destino = join(pasta, "saida.pacote");
    expect((await baixar(destino)).caminho).toBe(destino);
    expect(sha(await (await import("node:fs/promises")).readFile(destino))).toBe(HASH);
  });
  it("retoma de um parcial contra o servidor real (206) e o hash final bate", async () => {
    await subir();
    const destino = join(pasta, "saida.pacote");
    await writeFile(`${destino}.parcial`, conteudo.subarray(0, 1000));
    await writeFile(`${destino}.parcial.meta`, `"${HASH}"`);
    await baixar(destino);
    expect(sha(await (await import("node:fs/promises")).readFile(destino))).toBe(HASH);
  });
  it("conexão cortada no meio retoma com Range e o hash final é igual", async () => {
    const pedidos: Array<string | undefined> = [];
    falso = createServer((req, res) => {
      pedidos.push(req.headers.range);
      expect(req.headers.authorization).toBe(`Bearer ${CREDENCIAL}`);
      if (!req.headers.range) {
        res.writeHead(200, { "content-length": conteudo.length, etag: `"${HASH}"` });
        return void res.write(conteudo.subarray(0, 3000), () =>
          setTimeout(() => res.destroy(), 30),
        );
      }
      const ini = Number(/bytes=(\d+)-/.exec(req.headers.range)?.[1]);
      res.writeHead(206, {
        "content-length": conteudo.length - ini,
        "content-range": `bytes ${ini}-${conteudo.length - 1}/${conteudo.length}`,
        etag: `"${HASH}"`,
      });
      res.end(conteudo.subarray(ini));
    });
    const f = falso;
    await new Promise<void>((ok) => f.listen(0, "127.0.0.1", ok));
    const destino = join(pasta, "saida.pacote");
    await baixar(destino);
    expect(pedidos[0]).toBeUndefined();
    expect(pedidos[1]).toMatch(/^bytes=[1-9]\d*-$/);
    expect(sha(await (await import("node:fs/promises")).readFile(destino))).toBe(HASH);
  });
  it("hash errado: apaga o parcial e não cria o destino", async () => {
    // O servidor entrega outro conteúdo sob o hash pedido (arquivo corrompido ou troca maliciosa).
    const errado = join(pasta, "errado.pacote");
    await writeFile(errado, "conteudo-diferente");
    await subir(() => ({ caminho: errado }));
    const destino = join(pasta, "saida.pacote");
    await expect(baixar(destino)).rejects.toThrow(ErroDownload);
    expect(existsSync(destino)).toBe(false);
    expect(existsSync(`${destino}.parcial`)).toBe(false);
    expect(existsSync(`${destino}.parcial.meta`)).toBe(false);
  });
  it("sem token válido: recusa (401) e não cria nada", async () => {
    await subir();
    const destino = join(pasta, "saida.pacote");
    await expect(
      pedirArquivo({
        endereco: "127.0.0.1",
        porta: portaDoServidor(),
        sha256: HASH,
        token: "errado",
        destino,
        permitirLoopbackParaTeste: true,
      }),
    ).rejects.toThrow(/401/);
    expect(existsSync(destino)).toBe(false);
  });
  it("IP fora da rede privada: recusa antes de abrir conexão", async () => {
    await expect(
      pedirArquivo({
        endereco: "8.8.8.8",
        porta: 1,
        sha256: HASH,
        token: CREDENCIAL,
        destino: join(pasta, "x"),
      }),
    ).rejects.toThrow(/rede privada/);
  });
});
