import { type ChildProcess, spawn } from "node:child_process";
import { EventEmitter } from "node:events";
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PassThrough } from "node:stream";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ConfigPc } from "./config-pc.js";
import { depsReais, pastaModsDaInstancia, type ExtrasDepsReais } from "./deps-reais.js";

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

/** Configuração do PC como o app a monta (config gravada + cofre): nenhuma variável de ambiente. */
const env = (): ConfigPc => ({
  urlCartorio: "https://cartorio.exemplo.net",
  token: "tk-teste",
  grupo: "Amigos",
  enderecoGravado: "mundo.exemplo.net:25565",
  pastaServidor: pasta,
  java: "java-falso",
  neoforge: NEO,
});
const semPasta = (): ConfigPc => ({ ...env(), pastaServidor: undefined });

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
    const d = depsReais({ pastaServidor: pasta, java: "j", neoforge: NEO }, () => {}, { spawnFn });
    await expect(d.lerTrava()).rejects.toMatchObject({ tipo: "acesso" });
    await expect(d.hospedar(() => {})).rejects.toThrow();
    expect(spawnFn).not.toHaveBeenCalled();
  });

  it("sem pasta/Java configurados: recusa em pt-BR", async () => {
    const c = cartorio(false);
    const d = depsReais(semPasta(), () => {}, { fetchFn: c.fetchFn });
    await expect(d.hospedar(() => {})).rejects.toThrow("não está configurado");
    expect(c.rotas).not.toContain("/trava/pegar");
  });
});

describe("quem sou eu e servidor órfão", () => {
  it("eu pergunta ao cartório (GET /eu)", async () => {
    const fetchFn = vi.fn(
      async () => new Response(JSON.stringify({ id: 7, nome: "Este PC", dono: false })),
    );
    const d = depsReais(env(), () => {}, { fetchFn: fetchFn as unknown as typeof fetch });
    await expect(d.eu()).resolves.toMatchObject({ id: 7 });
    expect(new URL(String(fetchFn.mock.calls[0]?.[0 as never])).pathname).toBe("/eu");
  });

  it("sem pasta configurada: não dá para conferir, na dúvida órfão", async () => {
    const d = depsReais(semPasta(), () => {}, { plataforma: "linux" });
    await expect(d.servidorOrfao()).resolves.toBe(true);
  });

  describe("Linux com /proc de mentira", () => {
    const linux = (raizProc: string) =>
      depsReais(env(), () => {}, { plataforma: "linux", raizProc });

    it("cwd em outra pasta: sem órfão; cwd na pasta do servidor: órfão", async () => {
      const proc = mkdtempSync(join(tmpdir(), "sabre-proc-"));
      try {
        mkdirSync(join(proc, "4242"));
        symlinkSync(tmpdir(), join(proc, "4242", "cwd"));
        await expect(linux(proc).servidorOrfao()).resolves.toBe(false);
        mkdirSync(join(proc, "4343"));
        symlinkSync(realpathSync(pasta), join(proc, "4343", "cwd"));
        await expect(linux(proc).servidorOrfao()).resolves.toBe(true);
      } finally {
        rmSync(proc, { recursive: true, force: true });
      }
    });

    it("processo que sumiu no meio (sem cwd) é ignorado", async () => {
      const proc = mkdtempSync(join(tmpdir(), "sabre-proc-"));
      try {
        mkdirSync(join(proc, "4242"));
        await expect(linux(proc).servidorOrfao()).resolves.toBe(false);
      } finally {
        rmSync(proc, { recursive: true, force: true });
      }
    });

    it("processo que não deixa ler o cwd conta como órfão", async () => {
      const proc = mkdtempSync(join(tmpdir(), "sabre-proc-"));
      try {
        mkdirSync(join(proc, "4242"));
        writeFileSync(join(proc, "4242", "cwd"), "x"); // readlink falha (não é ENOENT), como num EACCES
        await expect(linux(proc).servidorOrfao()).resolves.toBe(true);
      } finally {
        rmSync(proc, { recursive: true, force: true });
      }
    });
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

describe("sem SABRE_ENDERECO/SABRE_CARTORIO_TOKEN no ambiente (app-1.3c-i)", () => {
  const SEGREDOS = [
    "SABRE_CARTORIO_URL",
    "SABRE_CARTORIO_TOKEN",
    "SABRE_ENDERECO",
    "SABRE_PASTA_SERVIDOR",
  ];
  beforeEach(() => {
    for (const k of SEGREDOS) vi.stubEnv(k, "do-ambiente-nao-pode-valer");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("o cartório é chamado no endereço e com o token da config (nunca os do ambiente)", async () => {
    const chamadas: Array<{ url: string; auth: string | null }> = [];
    const fetchFn = (async (url: string, init?: RequestInit) => {
      chamadas.push({ url, auth: new Headers(init?.headers).get("authorization") });
      return new Response(JSON.stringify({ id: 7, nome: "Este PC", dono: false }));
    }) as unknown as typeof fetch;
    const d = depsReais(env(), () => {}, { fetchFn });
    await d.eu();
    expect(chamadas[0]?.url).toBe("https://cartorio.exemplo.net/eu");
    expect(chamadas[0]?.auth).toContain("tk-teste");
    expect(JSON.stringify(chamadas)).not.toContain("do-ambiente");
  });

  it("sem config do grupo, o ambiente não vale: sem cartório e sem endereço", async () => {
    const d = depsReais({}, () => {});
    await expect(d.eu()).rejects.toMatchObject({ tipo: "acesso" });
    expect(d.endereco).toBe("");
  });

  it("o servidor sobe na pasta da config (base\\servidor), não na do ambiente", async () => {
    const c = cartorio(false);
    const spawnFn = vi.fn<NonNullable<ExtrasDepsReais["spawnFn"]>>((_c, _a, op) => {
      expect(op.cwd).toBe(pasta);
      return filho();
    });
    const d = depsReais(env(), () => {}, { fetchFn: c.fetchFn, spawnFn, plataforma: "linux" });
    const { servidor } = await d.hospedar(() => {});
    void servidor.pararServidor().catch(() => {});
    expect(spawnFn).toHaveBeenCalledOnce();
  });
});

describe("endereço do Jogar vem do cartório (GET /grupo)", () => {
  const resposta = (endereco: string) =>
    (async () =>
      new Response(
        JSON.stringify({ nome: "Amigos", endereco_jogar: endereco }),
      )) as unknown as typeof fetch;

  it("começa pelo gravado e passa a valer o do cartório depois de atualizar", async () => {
    const d = depsReais(env(), () => {}, { fetchFn: resposta("novo.exemplo.org:25565") });
    expect(d.endereco).toBe("mundo.exemplo.net:25565");
    await d.atualizarEndereco?.();
    expect(d.endereco).toBe("novo.exemplo.org:25565");
  });

  it("cartório fora do ar: segue com o último endereço e não lança", async () => {
    const falha = (async () =>
      Promise.reject(new TypeError("fetch failed"))) as unknown as typeof fetch;
    const d = depsReais(env(), () => {}, { fetchFn: falha });
    await expect(d.atualizarEndereco?.()).resolves.toBeUndefined();
    expect(d.endereco).toBe("mundo.exemplo.net:25565");
  });
});

describe("abrirJogo ligado ao Prism", () => {
  let prism: string;
  beforeEach(() => void (prism = mkdtempSync(join(tmpdir(), "sabre-prism-"))));
  afterEach(() => rmSync(prism, { recursive: true, force: true }));

  const achado =
    (extra: Record<string, unknown> = {}) =>
    async () =>
      ({
        instalado: true,
        antigo: false,
        pasta: join(prism, "app"),
        pastaInstancias: join(prism, "instances"),
        versao: "8.4",
        avisos: [],
        ...extra,
      }) as never;
  const marcar = (id: string) => {
    const dir = join(prism, "instances", id, "SabreHosting");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, ".sabrehosting.json"), JSON.stringify({ app: "SabreHosting" }));
  };

  it("abre a instância do grupo (id e marcador da MESMA instância) no endereço pedido", async () => {
    marcar("SabreHosting — Amigos");
    const execPrism = vi.fn(async () => "");
    const d = depsReais(env(), () => {}, { detectarPrism: achado(), execPrism });
    await expect(d.abrirJogo?.("jogar.exemplo.org:25565")).resolves.toEqual({ ok: true });
    expect(execPrism).toHaveBeenCalledWith(join(prism, "app", "prismlauncher.exe"), [
      "--launch",
      "SabreHosting — Amigos",
      "--server",
      "jogar.exemplo.org:25565",
    ]);
  });

  it("instância do grupo ainda não criada: recusa e não chama o Prism", async () => {
    marcar("Outra instância do amigo");
    const execPrism = vi.fn(async () => "");
    const d = depsReais(env(), () => {}, { detectarPrism: achado(), execPrism });
    const r = await d.abrirJogo?.("jogar.exemplo.org:25565");
    expect(r).toMatchObject({ ok: false });
    expect(execPrism).not.toHaveBeenCalled();
  });

  it("Prism ausente ou antigo: mensagem em pt-BR, sem caminho", async () => {
    const execPrism = vi.fn(async () => "");
    const ausente = depsReais(env(), () => {}, {
      detectarPrism: async () => ({
        instalado: false,
        linkDownload: "https://prismlauncher.org/download",
      }),
      execPrism,
    });
    const r1 = await ausente.abrirJogo?.("a.b:1");
    expect(r1).toMatchObject({ ok: false });
    expect(JSON.stringify(r1)).toContain("prismlauncher.org");
    const antigo = depsReais(env(), () => {}, {
      detectarPrism: achado({ antigo: true, mensagem: "O Prism 7.0 é antigo demais." }),
      execPrism,
    });
    expect(await antigo.abrirJogo?.("a.b:1")).toEqual({
      ok: false,
      mensagem: "O Prism 7.0 é antigo demais.",
    });
    expect(execPrism).not.toHaveBeenCalled();
  });

  it("detecção que quebra não derruba o Jogar", async () => {
    const d = depsReais(env(), () => {}, {
      detectarPrism: async () => Promise.reject(new Error("C:\\segredo")),
    });
    const r = await d.abrirJogo?.("a.b:1");
    expect(r).toMatchObject({ ok: false });
    expect(JSON.stringify(r)).not.toContain("segredo");
  });

  it("sem grupo na config: não abre nada", async () => {
    const execPrism = vi.fn(async () => "");
    const d = depsReais({}, () => {}, { detectarPrism: achado(), execPrism });
    expect(await d.abrirJogo?.("a.b:1")).toMatchObject({ ok: false });
    expect(execPrism).not.toHaveBeenCalled();
  });
});

describe("pastaModsDaInstancia (lancmel-2.1 liga na instância do grupo)", () => {
  let prism: string;
  beforeEach(() => void (prism = mkdtempSync(join(tmpdir(), "sabre-prism-"))));
  afterEach(() => rmSync(prism, { recursive: true, force: true }));
  const detectar = async () =>
    ({
      instalado: true,
      antigo: false,
      pasta: prism,
      pastaInstancias: join(prism, "instances"),
      versao: null,
      avisos: [],
    }) as never;
  const instancia = (sub?: string, marcador = true) => {
    const inst = join(prism, "instances", "SabreHosting — Amigos");
    if (marcador) {
      mkdirSync(join(inst, "SabreHosting"), { recursive: true });
      writeFileSync(
        join(inst, "SabreHosting", ".sabrehosting.json"),
        JSON.stringify({ app: "SabreHosting" }),
      );
    }
    if (sub) mkdirSync(join(inst, sub, "mods"), { recursive: true });
    return join(inst, sub ?? "", "mods");
  };

  it("acha minecraft\\mods ou .minecraft\\mods da instância do grupo", async () => {
    const mods = instancia("minecraft");
    expect(await pastaModsDaInstancia("Amigos", detectar)).toBe(mods);
  });

  it("instância sem marcador, sem pasta mods ou sem grupo: undefined (e nada é criado)", async () => {
    instancia("minecraft", false);
    expect(await pastaModsDaInstancia("Amigos", detectar)).toBeUndefined();
    expect(await pastaModsDaInstancia(undefined, detectar)).toBeUndefined();
    rmSync(join(prism, "instances"), { recursive: true });
    instancia(undefined, true);
    expect(await pastaModsDaInstancia("Amigos", detectar)).toBeUndefined();
  });
});
