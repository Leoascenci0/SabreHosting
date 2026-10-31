import { mkdtemp, readFile, readdir, rm, stat } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ExecArquivo } from "../launcher/prism.js";
import {
  aplicarNoWindows,
  criarExecutorElevado,
  derivarChavePublica,
  gerarChavesDoPc,
  montarConfigDoPc,
  testarLigacao,
  validarPacote,
  type PacoteDeLigacao,
} from "./wireguard.js";

const HUB_PUB = Buffer.alloc(32, 7).toString("base64");
const pacote: PacoteDeLigacao = {
  ip_pc: "10.66.0.2",
  chave_publica_hub: HUB_PUB,
  endpoint: "hub.exemplo.org:51820",
  allowed_ips: "10.66.0.0/24",
};

describe("gerarChavesDoPc / derivarChavePublica", () => {
  it("bate com o vetor da RFC 7748 (Alice): mesma chave pública do X25519 padrão", () => {
    const privada = Buffer.from(
      "77076d0a7318a57d3c16c17251b26645df4c2f87ebc0992ab177fba51db92c2a",
      "hex",
    ).toString("base64");
    const esperada = Buffer.from(
      "8520f0098930a754748b7ddcb43ef75a0dbf3a0d26381af4eba4a98eaa9b4e6a",
      "hex",
    ).toString("base64");
    expect(derivarChavePublica(privada)).toBe(esperada);
  });

  it("gera par de 32 bytes em base64, com o ajuste (clamp) do `wg genkey`, e a pública confere", () => {
    const { privada, publica } = gerarChavesDoPc();
    const bytes = Buffer.from(privada, "base64");
    expect(bytes).toHaveLength(32);
    expect((bytes[0] ?? 0) & 7).toBe(0);
    expect((bytes[31] ?? 0) & 0xc0).toBe(0x40);
    expect(Buffer.from(publica, "base64")).toHaveLength(32);
    expect(derivarChavePublica(privada)).toBe(publica);
  });

  it("duas gerações dão chaves diferentes", () => {
    expect(gerarChavesDoPc().privada).not.toBe(gerarChavesDoPc().privada);
  });

  it("chave privada inválida é recusada sem repetir o texto recebido", () => {
    const lixo = "SEGREDO-que-nao-e-chave";
    expect(() => derivarChavePublica(lixo)).toThrow(/inválida/);
    try {
      derivarChavePublica(lixo);
    } catch (e) {
      expect(String((e as Error).message)).not.toContain(lixo);
    }
  });
});

describe("validarPacote", () => {
  it("aceita o pacote do hub", () => {
    expect(validarPacote(pacote)).toEqual(pacote);
  });

  it("recusa qualquer campo fora do formato (incluindo injeção de linha na config)", () => {
    const ruins: Array<Partial<Record<keyof PacoteDeLigacao, unknown>>> = [
      { ip_pc: "10.66.0.1" }, // o hub
      { ip_pc: "10.66.0.255" },
      { ip_pc: "10.66.0.02" },
      { ip_pc: "192.168.0.5" },
      { ip_pc: "10.66.0.2\nPostUp = x" },
      { chave_publica_hub: "curta" },
      { chave_publica_hub: `${HUB_PUB}\nPostUp = x` },
      { endpoint: "hub.exemplo.org" },
      { endpoint: "hub:99999" },
      { endpoint: "hub.org:51820\nPostUp = calc" },
      { allowed_ips: "0.0.0.0/0" },
      { allowed_ips: "10.66.0.0/24, 0.0.0.0/0" },
      { allowed_ips: "10.66.0.0/16" },
    ];
    for (const ruim of ruins) {
      expect(() => validarPacote({ ...pacote, ...ruim }), JSON.stringify(ruim)).toThrow();
    }
    expect(() => validarPacote(null)).toThrow();
    expect(() => validarPacote("texto")).toThrow();
  });
});

describe("montarConfigDoPc", () => {
  const { privada } = gerarChavesDoPc();
  const cfg = montarConfigDoPc(pacote, privada);

  it("tem só o necessário: interface do PC e o hub como único peer", () => {
    expect(cfg).toContain(`PrivateKey = ${privada}`);
    expect(cfg).toContain("Address = 10.66.0.2/24");
    expect(cfg).toContain(`PublicKey = ${HUB_PUB}`);
    expect(cfg).toContain("Endpoint = hub.exemplo.org:51820");
    expect(cfg).toContain("AllowedIPs = 10.66.0.0/24");
    expect(cfg).toContain("PersistentKeepalive = 25");
    expect(cfg.match(/\[Peer\]/g)).toHaveLength(1);
    expect(cfg.match(/PrivateKey/g)).toHaveLength(1);
  });

  it("nunca sequestra a internet nem o DNS do amigo, nem roda comando", () => {
    expect(cfg).not.toContain("0.0.0.0/0");
    expect(cfg).not.toContain("::/0");
    expect(cfg).not.toMatch(/^DNS/m);
    expect(cfg).not.toMatch(/^(PostUp|PreUp|PostDown|PreDown)/m);
  });

  it("é pura: mesma entrada, mesma saída", () => {
    expect(montarConfigDoPc(pacote, privada)).toBe(cfg);
  });

  it("recusa pacote ruim e chave privada ruim sem citar a chave", () => {
    expect(() => montarConfigDoPc({ ...pacote, allowed_ips: "0.0.0.0/0" }, privada)).toThrow();
    const ruim = "chave-privada-errada";
    expect(() => montarConfigDoPc(pacote, ruim)).toThrow(/inválida/);
    try {
      montarConfigDoPc(pacote, ruim);
    } catch (e) {
      expect(String((e as Error).message)).not.toContain(ruim);
    }
  });
});

describe("aplicarNoWindows", () => {
  let pasta: string;
  beforeEach(async () => {
    pasta = await mkdtemp(join(tmpdir(), "sabre-rede-"));
  });
  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  const { privada } = gerarChavesDoPc();
  const cfg = montarConfigDoPc(pacote, privada);

  function executores() {
    const comuns: Array<[string, readonly string[]]> = [];
    const elevados: Array<[string, readonly string[]]> = [];
    let arquivoDuranteInstalacao: string | null = null;
    const exec: ExecArquivo = async (a, args) => {
      comuns.push([a, args]);
      return "";
    };
    const execElevado: ExecArquivo = async (a, args) => {
      elevados.push([a, args]);
      arquivoDuranteInstalacao = await readFile(args[1] ?? "", "utf8");
      return "";
    };
    return { comuns, elevados, exec, execElevado, lerDurante: () => arquivoDuranteInstalacao };
  }

  const opcoes = (e: ReturnType<typeof executores>) => ({
    pasta: join(pasta, "rede"),
    exec: e.exec,
    execElevado: e.execElevado,
    plataforma: "win32",
    usuario: "Amigo",
  });

  it("protege a pasta, instala o túnel com argumentos fixos e apaga o .conf em texto", async () => {
    const e = executores();
    await aplicarNoWindows(cfg, opcoes(e));
    const alvo = join(pasta, "rede", "sabre.conf");
    expect(e.comuns).toEqual([
      [
        "icacls",
        [
          join(pasta, "rede"),
          "/inheritance:r",
          "/grant:r",
          "Amigo:(OI)(CI)F",
          "*S-1-5-18:(OI)(CI)F",
          "*S-1-5-32-544:(OI)(CI)F",
        ],
      ],
    ]);
    expect(e.elevados).toEqual([
      ["C:\\Program Files\\WireGuard\\wireguard.exe", ["/installtunnelservice", alvo]],
    ]);
    expect(e.lerDurante()).toBe(cfg); // o arquivo existia na hora da instalação…
    expect(await readdir(join(pasta, "rede"))).toEqual([]); // …e não sobra depois
  });

  it("a pasta e o arquivo nascem com permissão restrita (0700/0600 onde o sistema respeita)", async () => {
    const e = executores();
    let modo = 0;
    e.execElevado = async (_a, args) => {
      modo = (await stat(args[1] ?? "")).mode & 0o777;
      return "";
    };
    await aplicarNoWindows(cfg, opcoes(e));
    expect(modo).toBe(0o600);
    expect((await stat(join(pasta, "rede"))).mode & 0o777).toBe(0o700);
  });

  it("se não conseguir proteger a pasta, não grava a chave nem instala", async () => {
    const e = executores();
    e.exec = async () => {
      throw new Error("icacls falhou");
    };
    await expect(aplicarNoWindows(cfg, opcoes(e))).rejects.toThrow(/proteger/);
    expect(e.elevados).toEqual([]);
    expect(await readdir(join(pasta, "rede"))).toEqual([]);
  });

  it("se a instalação falhar (sem permissão de administrador), apaga o .conf e o erro não traz a chave", async () => {
    const e = executores();
    e.execElevado = async () => {
      throw new Error("Acesso negado");
    };
    const erro = (await aplicarNoWindows(cfg, opcoes(e)).catch((x: unknown) => x)) as Error;
    expect(erro).toBeInstanceOf(Error);
    expect(erro.message).toMatch(/administrador/);
    expect(erro.message).not.toContain(privada);
    expect(String(erro.cause)).not.toContain(privada);
    expect(await readdir(join(pasta, "rede"))).toEqual([]);
  });

  it("nunca escreve a chave privada em log", async () => {
    const espioes = [
      vi.spyOn(console, "log"),
      vi.spyOn(console, "error"),
      vi.spyOn(console, "warn"),
      vi.spyOn(console, "info"),
    ];
    const e = executores();
    await aplicarNoWindows(cfg, opcoes(e));
    gerarChavesDoPc();
    for (const espiao of espioes) expect(espiao).not.toHaveBeenCalled();
    vi.restoreAllMocks();
    expect(JSON.stringify([e.comuns, e.elevados])).not.toContain(privada);
  });

  it("fora do Windows recusa sem tocar em nada", async () => {
    const e = executores();
    await expect(aplicarNoWindows(cfg, { ...opcoes(e), plataforma: "linux" })).rejects.toThrow(
      /Windows/,
    );
    expect(e.comuns).toEqual([]);
  });

  it("recusa config com 0.0.0.0/0 mesmo se alguém montar o texto à mão", async () => {
    const e = executores();
    const adulterada = cfg.replace("10.66.0.0/24", "0.0.0.0/0");
    await expect(aplicarNoWindows(adulterada, opcoes(e))).rejects.toThrow(/config/i);
    expect(e.elevados).toEqual([]);
  });
});

describe("criarExecutorElevado", () => {
  it("usa execFile sem shell, comando fixo e passa o programa e os argumentos por ambiente", async () => {
    const chamadas: Array<{
      arquivo: string;
      args: readonly string[];
      opcoes: Record<string, unknown>;
    }> = [];
    const falso = ((
      arquivo: string,
      args: readonly string[],
      opcoes: Record<string, unknown>,
      cb: (e: Error | null, s: string) => void,
    ) => {
      chamadas.push({ arquivo, args, opcoes });
      cb(null, "");
    }) as unknown as Parameters<typeof criarExecutorElevado>[0];
    const exec = criarExecutorElevado(falso);
    await exec("C:\\Program Files\\WireGuard\\wireguard.exe", [
      "/installtunnelservice",
      "C:\\a b\\sabre.conf",
    ]);
    const c = chamadas[0] as (typeof chamadas)[number];
    expect(c.arquivo).toBe("powershell.exe");
    expect(c.opcoes.shell).toBe(false);
    expect(c.args).toEqual(expect.arrayContaining(["-NoProfile", "-NonInteractive", "-Command"]));
    const comando = c.args.at(-1) ?? "";
    expect(comando).toContain("-Verb RunAs");
    expect(comando).not.toContain("sabre.conf"); // o caminho nunca entra no texto do comando
    expect(comando).not.toContain("WireGuard");
    const env = c.opcoes.env as Record<string, string>;
    expect(env.SABRE_EXE).toBe("C:\\Program Files\\WireGuard\\wireguard.exe");
    expect(JSON.parse(env.SABRE_ARGS ?? "")).toEqual([
      "/installtunnelservice",
      "C:\\a b\\sabre.conf",
    ]);
  });

  it("erro do PowerShell (UAC negado) vira rejeição", async () => {
    const falso = ((
      _a: string,
      _b: readonly string[],
      _o: unknown,
      cb: (e: Error | null, s: string) => void,
    ) => cb(new Error("saiu com 1"), "")) as unknown as Parameters<typeof criarExecutorElevado>[0];
    await expect(criarExecutorElevado(falso)("x", [])).rejects.toThrow();
  });
});

describe("testarLigacao", () => {
  const saidaBoa = "Resposta de 10.66.0.1: bytes=32 tempo=40ms TTL=64";
  const saidaRuim = "Resposta de 192.168.0.1: Host de destino inacessível.";

  it("alcança o hub: ping com argumentos fixos e TTL na resposta", async () => {
    const chamadas: Array<[string, readonly string[]]> = [];
    const exec: ExecArquivo = async (a, args) => {
      chamadas.push([a, args]);
      return saidaBoa;
    };
    expect(await testarLigacao({ exec, pausaMs: 0 })).toEqual({ ok: true });
    expect(chamadas).toEqual([["ping", ["-n", "1", "-w", "3000", "10.66.0.1"]]]);
  });

  it("o Windows sai com 0 mesmo em 'host inacessível': sem TTL não vale", async () => {
    const exec: ExecArquivo = async () => saidaRuim;
    const r = await testarLigacao({ exec, pausaMs: 0, tentativas: 2 });
    expect(r.ok).toBe(false);
  });

  it("tenta de novo (o aperto de mão do túnel demora) e para no primeiro sucesso", async () => {
    let n = 0;
    const exec: ExecArquivo = async () => {
      n++;
      if (n < 3) throw new Error("tempo esgotado");
      return saidaBoa;
    };
    expect(await testarLigacao({ exec, pausaMs: 0 })).toEqual({ ok: true });
    expect(n).toBe(3);
  });

  it("ping que nunca responde: falha dentro do prazo, sem travar", async () => {
    const exec: ExecArquivo = () => new Promise<string>(() => undefined);
    const inicio = Date.now();
    const r = await testarLigacao({ exec, pausaMs: 0, tentativas: 1, prazoMs: 30 });
    expect(r.ok).toBe(false);
    expect(Date.now() - inicio).toBeLessThan(2000);
  });
});
