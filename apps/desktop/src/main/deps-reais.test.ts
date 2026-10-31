import { type ChildProcess, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { depsReais, type ExtrasDepsReais } from "./deps-reais.js";

const NEO = "21.1.172";
let pasta: string;

beforeEach(() => {
  pasta = mkdtempSync(join(tmpdir(), "sabre-deps-"));
  writeFileSync(join(pasta, "eula.txt"), "eula=true\n");
  const dir = join(pasta, "libraries/net/neoforged/neoforge", NEO);
  mkdirSync(dir, { recursive: true });
  for (const a of ["unix_args.txt", "win_args.txt"]) writeFileSync(join(dir, a), "# args\n");
});
afterEach(() => rmSync(pasta, { recursive: true, force: true }));

const env = () => ({
  SABRE_CARTORIO_URL: "https://cartorio.exemplo.net",
  SABRE_CARTORIO_TOKEN: "token-de-teste",
  SABRE_PASTA_SERVIDOR: pasta,
  SABRE_JAVA: "java-falso",
  SABRE_NEOFORGE: NEO,
  SABRE_ENDERECO: "mundo.exemplo.net",
});

function filho(): ChildProcess {
  const f = new EventEmitter() as EventEmitter & Record<string, unknown>;
  f["stdin"] = new PassThrough();
  f["stdout"] = new PassThrough();
  f["stderr"] = new PassThrough();
  f["pid"] = 1;
  f["kill"] = () => f.emit("close", null);
  return f as unknown as ChildProcess;
}

/** Cartório falso por HTTP: anota cada rota chamada e recusa o `pegar` quando `ocupada`. */
function cartorio(ocupada: boolean) {
  const rotas: string[] = [];
  const fetchFn = vi.fn(async (url: string | URL | Request) => {
    const rota = new URL(String(url)).pathname;
    rotas.push(rota);
    const corpo =
      rota === "/trava/pegar" && ocupada
        ? { ok: false, erro: "ocupada", motivo: "ocupada", donoPcId: 2, epoca: 3, expiraEm: 1 }
        : { ok: true, epoca: 4, expiraEm: Date.now() + 60_000, renovarMs: 20_000 };
    return new Response(JSON.stringify(corpo), {
      status: rota === "/trava/pegar" && ocupada ? 409 : 200,
    });
  });
  return { rotas, fetchFn: fetchFn as unknown as typeof fetch };
}

describe("ligação real do Hospedar", () => {
  it("pega a trava no cartório ANTES de iniciar o processo do servidor", async () => {
    const c = cartorio(false);
    const spawnFn = vi.fn<NonNullable<ExtrasDepsReais["spawnFn"]>>(() => {
      expect(c.rotas).toContain("/trava/pegar");
      return filho();
    });
    const d = depsReais(env(), () => {}, { fetchFn: c.fetchFn, spawnFn, plataforma: "linux" });
    const { servidor } = await d.hospedar(() => {});
    expect(spawnFn).toHaveBeenCalledOnce();
    void servidor.pararServidor().catch(() => {}); // filho falso: sem `stop` real; o afterEach apaga a pasta
  });

  it("trava ocupada: recusa e nunca inicia o processo do servidor", async () => {
    const c = cartorio(true);
    const spawnFn = vi.fn<NonNullable<ExtrasDepsReais["spawnFn"]>>(() => filho());
    const d = depsReais(env(), () => {}, { fetchFn: c.fetchFn, spawnFn, plataforma: "linux" });
    await expect(d.hospedar(() => {})).rejects.toThrow();
    expect(spawnFn).not.toHaveBeenCalled();
  });

  it("sem cartório configurado: acesso negado e sem processo", async () => {
    const spawnFn = vi.fn<NonNullable<ExtrasDepsReais["spawnFn"]>>(() => filho());
    const d = depsReais(
      { SABRE_PASTA_SERVIDOR: pasta, SABRE_JAVA: "j", SABRE_NEOFORGE: NEO },
      () => {},
      { spawnFn },
    );
    await expect(d.lerTrava()).rejects.toMatchObject({ tipo: "acesso" });
    await expect(d.hospedar(() => {})).rejects.toThrow();
    expect(spawnFn).not.toHaveBeenCalled();
  });

  it("sem pasta/Java configurados: recusa em pt-BR", async () => {
    const c = cartorio(false);
    const d = depsReais({ ...env(), SABRE_PASTA_SERVIDOR: "" }, () => {}, { fetchFn: c.fetchFn });
    await expect(d.hospedar(() => {})).rejects.toThrow("não está configurado");
    expect(c.rotas).not.toContain("/trava/pegar");
  });
});

describe("quem sou eu e servidor órfão", () => {
  it("eu pergunta ao cartório (GET /eu)", async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({ id: 7, nome: "Este PC" })));
    const d = depsReais(env(), () => {}, { fetchFn: fetchFn as unknown as typeof fetch });
    await expect(d.eu()).resolves.toMatchObject({ id: 7 });
    expect(new URL(String(fetchFn.mock.calls[0]?.[0 as never])).pathname).toBe("/eu");
  });

  it("sem pasta configurada: não há onde ter servidor", async () => {
    const d = depsReais({ ...env(), SABRE_PASTA_SERVIDOR: "" }, () => {}, { plataforma: "darwin" });
    await expect(d.servidorOrfao()).resolves.toBe(false);
  });

  it("sistema sem como conferir: na dúvida, órfão", async () => {
    await expect(
      depsReais(env(), () => {}, { plataforma: "darwin" }).servidorOrfao(),
    ).resolves.toBe(true);
  });

  it.runIf(process.platform === "linux")(
    "Linux: processo vivo com a pasta do servidor como diretório atual é órfão",
    async () => {
      const d = depsReais(env(), () => {}, { plataforma: "linux" });
      await expect(d.servidorOrfao()).resolves.toBe(false);
      const vivo = spawn("sleep", ["30"], { cwd: pasta, stdio: "ignore" });
      try {
        await new Promise((ok) => vivo.once("spawn", ok));
        await expect(d.servidorOrfao()).resolves.toBe(true);
      } finally {
        vivo.kill();
      }
    },
  );

  describe("Windows: session.lock preso pelo Java", () => {
    const win = () => depsReais(env(), () => {}, { plataforma: "win32" });

    it("sem mundo ou com session.lock legível: sem órfão", async () => {
      await expect(win().servidorOrfao()).resolves.toBe(false);
      mkdirSync(join(pasta, "world"));
      writeFileSync(join(pasta, "world", "session.lock"), "x");
      await expect(win().servidorOrfao()).resolves.toBe(false);
    });

    it("session.lock que não se deixa ler: órfão", async () => {
      mkdirSync(join(pasta, "world", "session.lock"), { recursive: true }); // leitura falha, como na trava do Java
      await expect(win().servidorOrfao()).resolves.toBe(true);
    });

    it("segue o level-name do server.properties", async () => {
      writeFileSync(join(pasta, "server.properties"), "server-port=25565\nlevel-name=mundo\n");
      mkdirSync(join(pasta, "mundo", "session.lock"), { recursive: true });
      await expect(win().servidorOrfao()).resolves.toBe(true);
    });
  });
});
