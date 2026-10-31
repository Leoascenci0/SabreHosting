import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { createServer, type Server } from "node:http";
import { connect, type AddressInfo } from "node:net";
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

describe("conexões", () => {
  it("conexão ociosa (sem enviar nada) é derrubada pelo servidor", async () => {
    servidor = await servirArquivos({
      endereco: "127.0.0.1",
      porta: 0,
      permitirLoopbackParaTeste: true,
      conferirToken: async () => null,
      arquivos: () => undefined,
      tempoOciosoMs: 150,
    });
    const socket = connect(portaDoServidor(), "127.0.0.1");
    await new Promise<void>((ok) => socket.once("close", () => ok()));
    expect(socket.destroyed).toBe(true);
  });
});

describe("limites do servidor (cabeçalho lento e conexões)", () => {
  const abrir = (porta: number) =>
    new Promise<import("node:net").Socket>((ok, erro) => {
      const s = connect(porta, "127.0.0.1");
      // resume(): sem ler os dados o cliente não processa o FIN do servidor e o "close" não vem.
      s.resume();
      s.once("connect", () => ok(s));
      s.once("error", erro);
    });
  const fechado = (s: import("node:net").Socket) =>
    new Promise<void>((ok) => {
      if (s.destroyed) return ok();
      s.once("close", () => ok());
    });

  it("cabeçalho que nunca termina: o servidor derruba o socket antes do tempo ocioso de 60 s (headersTimeout)", async () => {
    await subir();
    const s = await abrir(portaDoServidor());
    s.write(`GET /arquivos/${HASH} HTTP/1.1\r\nHost: teste\r\n`);
    const t0 = Date.now();
    await fechado(s);
    const decorrido = Date.now() - t0;
    // O Node confere prazos de cabeçalho a cada ~30 s, então o corte real sai perto de 30 s.
    // Abaixo de 9 s seria outra causa; acima de 45 s o corte veio do tempo ocioso (60 s), não deste prazo.
    expect(decorrido).toBeGreaterThanOrEqual(9_000);
    expect(decorrido).toBeLessThan(45_000);
  }, 60_000);

  it("17ª conexão não é atendida enquanto 16 estão abertas; liberar uma vaga volta a atender", async () => {
    await subir();
    const porta = portaDoServidor();
    const abertas: import("node:net").Socket[] = [];
    for (let i = 0; i < 16; i++) abertas.push(await abrir(porta));

    const extra = await abrir(porta);
    let resposta = "";
    extra.on("data", (d: Buffer) => (resposta += d.toString("latin1")));
    extra.write(
      `GET /arquivos/${HASH} HTTP/1.1\r\nHost: teste\r\nauthorization: Bearer ${CREDENCIAL}\r\n\r\n`,
    );
    await fechado(extra);
    expect(resposta).not.toMatch(/HTTP\/1\.1 \d{3}/);

    abertas[0]?.destroy();
    await new Promise((ok) => setTimeout(ok, 100));
    const r = await pedir();
    expect(r.status).toBe(200);
    await r.arrayBuffer();
    for (const s of abertas) s.destroy();
  }, 20_000);
});

describe("limite de tentativas erradas e cache de token", () => {
  let agora = 1_000_000;
  let consultas = 0;
  const subirCom = async (conferir: (t: string) => Promise<string | null>) =>
    (servidor = await servirArquivos({
      endereco: "127.0.0.1",
      porta: 0,
      permitirLoopbackParaTeste: true,
      agora: () => agora,
      conferirToken: (t) => (consultas++, conferir(t)),
      arquivos: (h) => (h === HASH ? { caminho: arquivo } : undefined),
    }));
  const comToken = (t: string) => fetch(url(), { headers: { authorization: `Bearer ${t}` } });
  const valido = async (t: string) => (t === CREDENCIAL ? "pc-do-lucas" : null);
  beforeEach(() => {
    agora = 1_000_000;
    consultas = 0;
  });

  it("6ª tentativa errada: 429 sem chamar o cartório, mesmo com token válido; libera após 60 s", async () => {
    await subirCom(valido);
    for (let i = 0; i < 5; i++) expect((await comToken("errado")).status).toBe(401);
    expect(consultas).toBe(5);
    consultas = 0;
    expect((await comToken("errado")).status).toBe(429);
    expect((await comToken(CREDENCIAL)).status).toBe(429);
    expect((await fetch(url())).status).toBe(429);
    expect(consultas).toBe(0);
    agora += 60_000;
    expect((await comToken(CREDENCIAL)).status).toBe(200);
  });
  it("a janela conta do 1º erro e os 429 não a prolongam", async () => {
    await subirCom(valido);
    const t0 = agora;
    expect((await comToken("errado")).status).toBe(401);
    for (const salto of [10_000, 10_000, 10_000, 20_000]) {
      agora += salto;
      expect((await comToken("errado")).status).toBe(401);
    }
    agora = t0 + 55_000;
    expect((await comToken(CREDENCIAL)).status).toBe(429);
    agora = t0 + 59_999;
    expect((await comToken(CREDENCIAL)).status).toBe(429);
    agora = t0 + 60_000;
    expect((await comToken(CREDENCIAL)).status).toBe(200);
  });
  it("falhas vencidas são esquecidas: depois de 61 s o IP recomeça do zero e volta a ser limitado", async () => {
    await subirCom(valido);
    for (let i = 0; i < 4; i++) expect((await comToken("errado")).status).toBe(401);
    agora += 61_000;
    for (let i = 0; i < 5; i++) expect((await comToken("errado")).status).toBe(401);
    expect((await comToken("errado")).status).toBe(429);
  });
  it("token ausente também conta como tentativa errada", async () => {
    await subirCom(valido);
    for (let i = 0; i < 5; i++) expect((await fetch(url())).status).toBe(401);
    expect((await fetch(url())).status).toBe(429);
  });
  it("token válido repetido consulta o cartório 1 vez; após 30 s consulta de novo", async () => {
    await subirCom(valido);
    expect((await comToken(CREDENCIAL)).status).toBe(200);
    expect((await comToken(CREDENCIAL)).status).toBe(200);
    expect(consultas).toBe(1);
    agora += 29_000;
    await comToken(CREDENCIAL);
    expect(consultas).toBe(1);
    agora += 1_000;
    await comToken(CREDENCIAL);
    expect(consultas).toBe(2);
  });
  it("token inválido não entra no cache: cada tentativa consulta o cartório", async () => {
    await subirCom(valido);
    await comToken("errado");
    await comToken("errado");
    expect(consultas).toBe(2);
  });
  it("503 (cartório fora) não conta como erro nem entra no cache", async () => {
    let fora = true;
    await subirCom(async (t) => {
      if (fora) throw new Error("cartório fora");
      return valido(t);
    });
    for (let i = 0; i < 8; i++) expect((await comToken(CREDENCIAL)).status).toBe(503);
    fora = false;
    expect((await comToken(CREDENCIAL)).status).toBe(200);
    expect(consultas).toBe(9);
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
    const autorizacoes: Array<string | undefined> = [];
    falso = createServer((req, res) => {
      pedidos.push(req.headers.range);
      autorizacoes.push(req.headers.authorization);
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
    expect(autorizacoes.length).toBeGreaterThan(1);
    expect(autorizacoes.every((a) => a === `Bearer ${CREDENCIAL}`)).toBe(true);
    expect(pedidos[0]).toBeUndefined();
    expect(pedidos[1]).toMatch(/^bytes=[1-9]\d*-$/);
    expect(sha(await (await import("node:fs/promises")).readFile(destino))).toBe(HASH);
  });
  it("arquivo completo como parcial não gera segundo download: só confere o hash", async () => {
    await subir();
    let corpos = 0;
    const destino = join(pasta, "saida.pacote");
    await writeFile(`${destino}.parcial`, conteudo);
    await writeFile(`${destino}.parcial.meta`, `"${HASH}"`);
    const original = globalThis.fetch;
    globalThis.fetch = (async (...a: Parameters<typeof fetch>) => {
      const r = await original(...a);
      if (r.status === 200 || r.status === 206) corpos++;
      return r;
    }) as typeof fetch;
    try {
      await baixar(destino);
    } finally {
      globalThis.fetch = original;
    }
    expect(corpos).toBe(0);
    expect(sha(await (await import("node:fs/promises")).readFile(destino))).toBe(HASH);
    expect(existsSync(`${destino}.parcial`)).toBe(false);
  });
  it("parcial do tamanho certo mas com conteúdo errado: descarta e baixa de novo", async () => {
    await subir();
    const destino = join(pasta, "saida.pacote");
    await writeFile(`${destino}.parcial`, Buffer.alloc(conteudo.length, 1));
    await writeFile(`${destino}.parcial.meta`, `"${HASH}"`);
    // Conta os corpos que o servidor entregou: tem que ser exatamente 1 (o download refeito).
    // Se a conferência do hash for pulada, o parcial errado vira o destino sem nenhum corpo novo.
    let corpos = 0;
    const original = globalThis.fetch;
    globalThis.fetch = (async (...a: Parameters<typeof fetch>) => {
      const r = await original(...a);
      if (r.status === 200 || r.status === 206) corpos++;
      return r;
    }) as typeof fetch;
    try {
      await baixar(destino);
    } finally {
      globalThis.fetch = original;
    }
    expect(corpos).toBe(1);
    expect(sha(await (await import("node:fs/promises")).readFile(destino))).toBe(HASH);
    expect(existsSync(`${destino}.parcial`)).toBe(false);
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
