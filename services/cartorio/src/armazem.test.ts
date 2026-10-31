import { createHash, randomBytes } from "node:crypto";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { request } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { type Armazem, criarArmazem, pacoteGuardado, receberPacote } from "./armazem.js";
import {
  type Banco,
  MIGRACOES,
  abrirBanco,
  criarConvite,
  pcDoToken,
  usarConvite,
} from "./banco.js";
import { gerarSegredo } from "./segredo.js";
import { criarCartorio } from "./servidor.js";
import { passar, pegar, soltar } from "./trava.js";
import { registrarVersao } from "./versoes.js";

const PRAZO = 60_000;
const pastas: string[] = [];
const fechar: Array<() => unknown> = [];

afterEach(async () => {
  for (const f of fechar.splice(0)) await f();
  for (const pasta of pastas.splice(0)) rmSync(pasta, { recursive: true, force: true });
});

function pastaNova() {
  const p = mkdtempSync(join(tmpdir(), "sabre-armazem-"));
  pastas.push(p);
  return p;
}

/** Pacote de teste: bytes aleatórios (o cartório não abre o pacote; só confere hash e tamanho). */
function pacote(tamanho = 4096) {
  const bytes = randomBytes(tamanho);
  return { bytes, sha256: createHash("sha256").update(bytes).digest("hex"), tamanho };
}
type Pacote = ReturnType<typeof pacote>;
const declarado = (p: Pacote) => ({ sha256: p.sha256, bytes: p.tamanho });

/** Banco com 2 PCs, armazém numa pasta de teste e relógio controlado. */
function montar(opcoes: { tetoBytes?: number } = {}) {
  const dados = pastaNova();
  const banco = abrirBanco(join(dados, "cartorio.db"));
  fechar.push(() => banco.close());
  const inserir = banco.prepare("INSERT INTO pcs (nome, criado_em) VALUES (?, 0)");
  inserir.run("PC 1");
  inserir.run("PC 2");
  const relogio = { agora: 1_000 };
  const pasta = join(dados, "mundo");
  const armazem = criarArmazem({ banco, pasta, agora: () => relogio.agora, ...opcoes });
  return { banco, armazem, pasta, relogio };
}

/** O PC 1 pega a trava e registra `n` versões; devolve a época. */
function hospedarERegistrar(banco: Banco, n: number, agora = 1_000) {
  const r = pegar(banco, 1, agora, PRAZO);
  if (!r.ok) throw new Error("trava");
  for (let i = 0; i < n; i++) {
    registrarVersao(banco, 1, r.epoca, agora, {
      manifestoSha256: "b".repeat(64),
      arquivos: 1,
      bytes: 1,
    });
  }
  return r.epoca;
}

function arquivos(pasta: string) {
  return readdirSync(pasta).sort();
}
function linhas(banco: Banco) {
  return banco
    .prepare("SELECT versao FROM copias_nuvem ORDER BY versao")
    .all()
    .map((l) => l["versao"]);
}

/** Fluxo que entrega a primeira metade e então cai (rede que caiu no meio). */
function fluxoQueCai(p: Pacote) {
  return Readable.from(
    (async function* () {
      yield p.bytes.subarray(0, p.tamanho / 2);
      throw new Error("A conexão caiu.");
    })(),
  );
}

async function enviar(a: Armazem, versao: number, epoca: number, p: Pacote, pc = 1) {
  return receberPacote(a, versao, pc, epoca, Readable.from([p.bytes]), declarado(p));
}

describe("armazém: guarda a cópia do mundo com troca atômica", () => {
  it("guarda o pacote conferido e devolve exatamente os bytes", async () => {
    const { banco, armazem, pasta } = montar();
    const epoca = hospedarERegistrar(banco, 1);
    const p = pacote();
    expect(await enviar(armazem, 1, epoca, p)).toEqual({
      ok: true,
      versao: 1,
      sha256: p.sha256,
      bytes: p.tamanho,
    });
    expect(arquivos(pasta)).toEqual(["v1.tar.gz"]);
    const guardado = pacoteGuardado(armazem, 1);
    expect(guardado).toMatchObject({ sha256: p.sha256, bytes: p.tamanho });
    expect(readFileSync(guardado?.caminho ?? "").equals(p.bytes)).toBe(true);
    expect(pacoteGuardado(armazem, 2)).toBeUndefined();
  });

  it("queda no meio do envio: a cópia anterior fica intacta e nenhum parcial sobra", async () => {
    const { banco, armazem, pasta } = montar();
    const epoca = hospedarERegistrar(banco, 1);
    const v1 = pacote();
    await enviar(armazem, 1, epoca, v1);
    registrarVersao(banco, 1, epoca, 1_000, {
      manifestoSha256: "c".repeat(64),
      arquivos: 1,
      bytes: 1,
    });
    const v2 = pacote(64 * 1024);
    expect(await receberPacote(armazem, 2, 1, epoca, fluxoQueCai(v2), declarado(v2))).toEqual({
      ok: false,
      motivo: "interrompido",
    });
    expect(arquivos(pasta)).toEqual(["v1.tar.gz"]);
    expect(readFileSync(join(pasta, "v1.tar.gz")).equals(v1.bytes)).toBe(true);
    expect(linhas(banco)).toEqual([1]);
    // Reenviar depois da queda funciona.
    expect(await enviar(armazem, 2, epoca, v2)).toMatchObject({ ok: true, versao: 2 });
  });

  it("hash errado, pacote menor ou maior que o declarado → recusa e nada fica", async () => {
    const { banco, armazem, pasta } = montar();
    const epoca = hospedarERegistrar(banco, 1);
    const p = pacote();
    const fluxo = () => Readable.from([p.bytes]);
    expect(
      await receberPacote(armazem, 1, 1, epoca, fluxo(), {
        sha256: "0".repeat(64),
        bytes: p.tamanho,
      }),
    ).toEqual({ ok: false, motivo: "hash_errado" });
    expect(
      await receberPacote(armazem, 1, 1, epoca, fluxo(), {
        sha256: p.sha256,
        bytes: p.tamanho + 1,
      }),
    ).toEqual({ ok: false, motivo: "tamanho_errado" });
    expect(
      await receberPacote(armazem, 1, 1, epoca, fluxo(), {
        sha256: p.sha256,
        bytes: p.tamanho - 1,
      }),
    ).toEqual({ ok: false, motivo: "tamanho_errado" });
    expect(arquivos(pasta)).toEqual([]);
    expect(linhas(banco)).toEqual([]);
  });

  it("sem trava, outro dono, época velha ou trava vencida → recusa sem gravar nada", async () => {
    const { banco, armazem, pasta, relogio } = montar();
    const p = pacote();
    expect(await enviar(armazem, 1, 0, p)).toMatchObject({ ok: false, motivo: "nao_e_dono" });
    const epoca = hospedarERegistrar(banco, 1);
    expect(await enviar(armazem, 1, epoca, p, 2)).toMatchObject({
      ok: false,
      motivo: "nao_e_dono",
    });
    expect(await enviar(armazem, 1, epoca + 1, p)).toMatchObject({
      ok: false,
      motivo: "epoca_velha",
    });
    relogio.agora = 1_000 + PRAZO;
    expect(await enviar(armazem, 1, epoca, p)).toMatchObject({ ok: false, motivo: "vencida" });
    expect(arquivos(pasta)).toEqual([]);
    expect(linhas(banco)).toEqual([]);
  });

  it("a trava passou para outro PC durante o envio → recusa no fim, sem parcial e sem registro", async () => {
    const { banco, armazem, pasta } = montar();
    const epoca = hospedarERegistrar(banco, 1);
    banco.prepare("INSERT INTO tokens (hash, pc_id, criado_em) VALUES ('h2', 2, 0)").run();
    const p = pacote(64 * 1024);
    const fluxo = Readable.from(
      (async function* () {
        yield p.bytes.subarray(0, p.tamanho / 2);
        expect(passar(banco, 1, 2, epoca, 1_000, PRAZO)).toMatchObject({ ok: true });
        yield p.bytes.subarray(p.tamanho / 2);
      })(),
    );
    expect(await receberPacote(armazem, 1, 1, epoca, fluxo, declarado(p))).toMatchObject({
      ok: false,
      motivo: "epoca_velha",
    });
    expect(arquivos(pasta)).toEqual([]);
    expect(linhas(banco)).toEqual([]);
  });

  it("só a versão mais nova, registrada pelo próprio PC, e uma vez só", async () => {
    const { banco, armazem } = montar();
    const epoca = hospedarERegistrar(banco, 2);
    const p = pacote();
    expect(await enviar(armazem, 1, epoca, p)).toEqual({ ok: false, motivo: "nao_e_a_mais_nova" });
    expect(await enviar(armazem, 3, epoca, p)).toEqual({ ok: false, motivo: "nao_e_a_mais_nova" });
    expect(await enviar(armazem, 2, epoca, p)).toMatchObject({ ok: true });
    expect(await enviar(armazem, 2, epoca, p)).toEqual({ ok: false, motivo: "ja_guardada" });
    // O PC 2 assume sem registrar nada: a versão 2 é do PC 1, não dele.
    soltar(banco, 1, epoca);
    const r2 = pegar(banco, 2, 2_000, PRAZO);
    expect(await enviar(armazem, 2, r2.epoca, p, 2)).toEqual({
      ok: false,
      motivo: "nao_registrou",
    });
    expect(linhas(banco)).toEqual([2]);
  });

  it("acima do teto → recusa antes de gravar", async () => {
    const { banco, armazem, pasta } = montar({ tetoBytes: 1_000 });
    const epoca = hospedarERegistrar(banco, 1);
    const p = pacote(1_001);
    expect(await enviar(armazem, 1, epoca, p)).toEqual({ ok: false, motivo: "grande_demais" });
    expect(arquivos(pasta)).toEqual([]);
    expect(await enviar(armazem, 1, epoca, pacote(1_000))).toMatchObject({ ok: true });
  });

  it("rotação: mantém as 3 cópias mais novas", async () => {
    const { banco, armazem, pasta } = montar();
    const epoca = hospedarERegistrar(banco, 0);
    const ultimos: Pacote[] = [];
    for (let n = 1; n <= 5; n++) {
      registrarVersao(banco, 1, epoca, 1_000, {
        manifestoSha256: "d".repeat(64),
        arquivos: 1,
        bytes: 1,
      });
      const p = pacote();
      ultimos.push(p);
      expect(await enviar(armazem, n, epoca, p)).toMatchObject({ ok: true });
      expect(linhas(banco).length).toBe(Math.min(n, 3));
    }
    expect(arquivos(pasta)).toEqual(["v3.tar.gz", "v4.tar.gz", "v5.tar.gz"]);
    expect(linhas(banco)).toEqual([3, 4, 5]);
    expect(
      readFileSync(join(pasta, "v5.tar.gz")).equals(ultimos[4]?.bytes ?? Buffer.alloc(0)),
    ).toBe(true);
  });

  it("ao abrir o armazém: apaga parciais e cópias órfãs (sem linha); cópia registrada fica", async () => {
    const { banco, armazem, pasta } = montar();
    const epoca = hospedarERegistrar(banco, 1);
    await enviar(armazem, 1, epoca, pacote());
    writeFileSync(join(pasta, "v2.abc.tar.gz.parcial"), "meio");
    writeFileSync(join(pasta, "v9.tar.gz"), "órfã");
    writeFileSync(join(pasta, "leia-me.txt"), "outro arquivo");
    criarArmazem({ banco, pasta });
    expect(arquivos(pasta)).toEqual(["leia-me.txt", "v1.tar.gz"]);
  });

  it("teto padrão de 20 GiB e teto inválido recusado", () => {
    const { banco, pasta } = montar();
    expect(criarArmazem({ banco, pasta }).tetoBytes).toBe(20 * 1024 ** 3);
    expect(() => criarArmazem({ banco, pasta, tetoBytes: 0 })).toThrow(/teto/i);
  });

  it(
    "envio de 50 MB passa em fluxo: o disco acompanha o envio e a memória não cresce com o tamanho",
    { timeout: 30_000 },
    async () => {
      const { banco, armazem, pasta } = montar();
      const epoca = hospedarERegistrar(banco, 1);
      const pedaco = randomBytes(64 * 1024);
      const vezes = 800; // 50 MiB
      const hash = createHash("sha256");
      for (let i = 0; i < vezes; i++) hash.update(pedaco);
      const memoria = () => process.memoryUsage().arrayBuffers + process.memoryUsage().heapUsed;
      const antes = memoria();
      let pico = antes;
      // Bytes entregues ao cartório que ainda não chegaram ao disco: em fluxo, só o que está nos buffers.
      const noDisco = () => {
        const parcial = readdirSync(pasta).find((a) => a.endsWith(".parcial"));
        return parcial ? statSync(join(pasta, parcial)).size : 0;
      };
      let maiorAtraso = 0;
      const fluxo = Readable.from(
        (function* () {
          for (let i = 0; i < vezes; i++) {
            pico = Math.max(pico, memoria());
            maiorAtraso = Math.max(maiorAtraso, i * pedaco.length - noDisco());
            yield pedaco;
          }
        })(),
      );
      const r = await receberPacote(armazem, 1, 1, epoca, fluxo, {
        sha256: hash.digest("hex"),
        bytes: vezes * pedaco.length,
      });
      expect(r).toMatchObject({ ok: true, bytes: 50 * 1024 * 1024 });
      expect(maiorAtraso).toBeLessThan(8 * 1024 * 1024);
      expect(pico - antes).toBeLessThan(16 * 1024 * 1024);
    },
  );
});

describe("armazém: migração v4 → v5", () => {
  it("preserva versões e cópias dos PCs e cria a tabela vazia; cópia guardada não muda", () => {
    const caminho = join(pastaNova(), "cartorio.db");
    const v4 = abrirBanco(caminho, MIGRACOES.slice(0, 4));
    v4.exec(`INSERT INTO pcs (id, nome, criado_em) VALUES (1, 'Ana', 10);
      INSERT INTO versoes (numero, epoca, pc_id, manifesto_sha256, arquivos, bytes, criada_em)
        VALUES (1, 3, 1, '${"a".repeat(64)}', 2, 30, 40);
      INSERT INTO copias (pc_id, versao, informada_em) VALUES (1, 1, 50)`);
    v4.close();
    const banco = abrirBanco(caminho);
    fechar.push(() => banco.close());
    expect(banco.prepare("SELECT versao FROM esquema").all()).toEqual([{ versao: 5 }]);
    expect(banco.prepare("SELECT numero, epoca, pc_id FROM versoes").all()).toEqual([
      { numero: 1, epoca: 3, pc_id: 1 },
    ]);
    expect(banco.prepare("SELECT pc_id, versao FROM copias").all()).toEqual([
      { pc_id: 1, versao: 1 },
    ]);
    expect(linhas(banco)).toEqual([]);
    const inserir = banco.prepare(
      "INSERT INTO copias_nuvem (versao, sha256, bytes, guardada_em) VALUES (?, ?, ?, 0)",
    );
    expect(() => inserir.run(1, "XYZ", 1)).toThrow();
    expect(() => inserir.run(2, "a".repeat(64), 1)).toThrow(); // versão que não existe
    inserir.run(1, "a".repeat(64), 1);
    expect(() => banco.exec("UPDATE copias_nuvem SET bytes = 2")).toThrow(/não muda/);
  });
});

describe("rotas do pacote", () => {
  function montarApp(opcoes: { tetoBytes?: number } = {}) {
    const dados = pastaNova();
    const segredoAdmin = gerarSegredo();
    const banco = abrirBanco(join(dados, "cartorio.db"));
    const relogio = { agora: 1_000 };
    const app = criarCartorio({
      banco,
      segredoAdmin,
      logger: { level: "silent" },
      agora: () => relogio.agora,
      armazem: { pasta: join(dados, "mundo"), ...opcoes },
    });
    fechar.push(() => app.close());
    const token = usarConvite(banco, criarConvite(banco, "PC 1", 0, 60_000), 0) ?? "";
    const pc = pcDoToken(banco, token);
    if (!pc) throw new Error("PC de teste sem token.");
    return {
      app,
      banco,
      pasta: join(dados, "mundo"),
      auth: { authorization: `Bearer ${token}` },
      pc,
    };
  }
  const url = (n: number, epoca: number, p: Pacote, sha = p.sha256) =>
    `/versoes/${n}/pacote?epoca=${epoca}&sha256=${sha}&bytes=${p.tamanho}`;

  it("PUT: o teto de 4 KB do JSON não alcança o pacote; quem limita é o teto do armazém (413 acima dele)", async () => {
    // O bodyLimit do Fastify só vale para leitor que junta o corpo; o do pacote é fluxo, limitado pelo armazém.
    const { app, banco, auth, pc } = montarApp({ tetoBytes: 64 * 1024 });
    const epoca = pegar(banco, pc.id, 1_000, PRAZO).epoca;
    const registrar = () =>
      registrarVersao(banco, pc.id, epoca, 1_000, {
        manifestoSha256: "e".repeat(64),
        arquivos: 1,
        bytes: 1,
      });
    const headers = { ...auth, "content-type": "application/octet-stream" };
    registrar();
    const cabe = pacote(64 * 1024);
    const r = await app.inject({
      method: "PUT",
      url: url(1, epoca, cabe),
      headers,
      payload: cabe.bytes,
    });
    expect(r.statusCode).toBe(201);
    registrar();
    const passa = pacote(64 * 1024 + 1);
    const grande = await app.inject({
      method: "PUT",
      url: url(2, epoca, passa),
      headers,
      payload: passa.bytes,
    });
    expect(grande.statusCode).toBe(413);
    expect(grande.json()).toMatchObject({ motivo: "grande_demais" });
  });

  it("PUT guarda, GET devolve os mesmos bytes com o sha256 no cabeçalho; sem token ou sem cópia, recusa", async () => {
    const { app, banco, auth, pc } = montarApp();
    const epoca = pegar(banco, pc.id, 1_000, PRAZO).epoca;
    registrarVersao(banco, pc.id, epoca, 1_000, {
      manifestoSha256: "e".repeat(64),
      arquivos: 1,
      bytes: 1,
    });
    const p = pacote();
    const octeto = { "content-type": "application/octet-stream" };
    const semToken = await app.inject({
      method: "PUT",
      url: url(1, epoca, p),
      headers: octeto,
      payload: p.bytes,
    });
    expect(semToken.statusCode).toBe(401);
    expect((await app.inject({ method: "GET", url: "/versoes/1/pacote" })).statusCode).toBe(401);
    expect(
      (await app.inject({ method: "GET", url: "/versoes/1/pacote", headers: auth })).statusCode,
    ).toBe(404);

    const errado = await app.inject({
      method: "PUT",
      url: url(1, epoca, p, "0".repeat(64)),
      headers: { ...auth, ...octeto },
      payload: p.bytes,
    });
    expect(errado.statusCode).toBe(422);
    const velha = await app.inject({
      method: "PUT",
      url: url(1, epoca + 1, p),
      headers: { ...auth, ...octeto },
      payload: p.bytes,
    });
    expect(velha.statusCode).toBe(409);
    expect(velha.json()).toMatchObject({ motivo: "epoca_velha" });

    const ok = await app.inject({
      method: "PUT",
      url: url(1, epoca, p),
      headers: { ...auth, ...octeto },
      payload: p.bytes,
    });
    expect(ok.statusCode).toBe(201);
    expect(ok.json()).toEqual({ versao: 1, sha256: p.sha256, bytes: p.tamanho });

    const baixado = await app.inject({ method: "GET", url: "/versoes/1/pacote", headers: auth });
    expect(baixado.statusCode).toBe(200);
    expect(baixado.headers["x-sabre-sha256"]).toBe(p.sha256);
    expect(baixado.rawPayload.equals(p.bytes)).toBe(true);
  });

  it(
    "corpo que não é application/octet-stream → 415 antes de ler (a memória não cresce)",
    { timeout: 15_000 },
    async () => {
      const { app, auth, pasta } = montarApp();
      const grande = Buffer.alloc(50 * 1024 * 1024, 0x61);
      const memoria = () => process.memoryUsage().arrayBuffers + process.memoryUsage().heapUsed;
      for (const tipo of ["text/plain", "application/json", undefined]) {
        const antes = memoria();
        let pico = antes;
        const medir = setInterval(() => (pico = Math.max(pico, memoria())), 1);
        const r = await app.inject({
          method: "PUT",
          url: `/versoes/1/pacote?epoca=1&sha256=${"a".repeat(64)}&bytes=${grande.length}`,
          headers: tipo ? { ...auth, "content-type": tipo } : auth,
          payload: Readable.from(
            (function* () {
              for (let i = 0; i < 800; i++) yield grande.subarray(0, 64 * 1024);
            })(),
          ),
        });
        clearInterval(medir);
        pico = Math.max(pico, memoria());
        expect(r.statusCode, String(tipo)).toBe(415);
        expect(r.json().erro).toMatch(/pacote/);
        expect(pico - antes, String(tipo)).toBeLessThan(16 * 1024 * 1024);
      }
      expect(arquivos(pasta)).toEqual([]);
    },
  );

  it("cópia registrada cujo arquivo sumiu → 404 com mensagem, não 500", async () => {
    const { app, banco, auth, pasta, pc } = montarApp();
    const epoca = pegar(banco, pc.id, 1_000, PRAZO).epoca;
    registrarVersao(banco, pc.id, epoca, 1_000, {
      manifestoSha256: "e".repeat(64),
      arquivos: 1,
      bytes: 1,
    });
    const p = pacote();
    const headers = { ...auth, "content-type": "application/octet-stream" };
    expect(
      (await app.inject({ method: "PUT", url: url(1, epoca, p), headers, payload: p.bytes }))
        .statusCode,
    ).toBe(201);
    rmSync(join(pasta, "v1.tar.gz"));
    const r = await app.inject({ method: "GET", url: "/versoes/1/pacote", headers: auth });
    expect(r.statusCode).toBe(404);
    expect(r.json().erro).toMatch(/nuvem/);
  });

  it("parâmetros inválidos → 400 sem gravar", async () => {
    const { app, auth, pasta } = montarApp();
    const r = await app.inject({
      method: "PUT",
      url: "/versoes/1/pacote?epoca=1&sha256=xyz&bytes=10",
      headers: { ...auth, "content-type": "application/octet-stream" },
      payload: Buffer.alloc(10),
    });
    expect(r.statusCode).toBe(400);
    expect(arquivos(pasta)).toEqual([]);
  });

  it(
    "conexão HTTP cortada no meio do envio: cópia anterior intacta e nenhum parcial sobra",
    { timeout: 15_000 },
    async () => {
      const { app, banco, auth, pasta, pc } = montarApp();
      const epoca = pegar(banco, pc.id, 1_000, PRAZO).epoca;
      const reg = () =>
        registrarVersao(banco, pc.id, epoca, 1_000, {
          manifestoSha256: "f".repeat(64),
          arquivos: 1,
          bytes: 1,
        });
      reg();
      const v1 = pacote();
      const octeto = { ...auth, "content-type": "application/octet-stream" };
      expect(
        (
          await app.inject({
            method: "PUT",
            url: url(1, epoca, v1),
            headers: octeto,
            payload: v1.bytes,
          })
        ).statusCode,
      ).toBe(201);
      reg();
      await app.listen({ host: "127.0.0.1", port: 0 });
      const { port } = app.server.address() as AddressInfo;
      const v2 = pacote(1024 * 1024);

      await new Promise<void>((pronto) => {
        const req = request({
          host: "127.0.0.1",
          port,
          method: "PUT",
          path: url(2, epoca, v2),
          headers: octeto,
        });
        req.on("error", () => pronto());
        req.write(v2.bytes.subarray(0, 256 * 1024), () => setTimeout(() => req.destroy(), 50));
      });

      // O servidor segue de pé: um envio inteiro depois do corte é aceito.
      const v2b = pacote();
      const depois = await app.inject({
        method: "PUT",
        url: url(2, epoca, v2b),
        headers: octeto,
        payload: v2b.bytes,
      });
      expect(depois.statusCode).toBe(201);
      const limite = Date.now() + 5_000;
      while (arquivos(pasta).some((a) => a.endsWith(".parcial")) && Date.now() < limite) {
        await new Promise((r) => setTimeout(r, 20));
      }
      expect(arquivos(pasta)).toEqual(["v1.tar.gz", "v2.tar.gz"]);
      expect(readFileSync(join(pasta, "v1.tar.gz")).equals(v1.bytes)).toBe(true);
      expect(readFileSync(join(pasta, "v2.tar.gz")).equals(v2b.bytes)).toBe(true);
    },
  );
});
