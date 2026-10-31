import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = resolve(import.meta.dirname, "../../infra/vps/instalar-velocity.sh");
const VERSAO = "3.4.0-SNAPSHOT";

let estado: string;
let api: string;
beforeEach(() => {
  estado = mkdtempSync(join(tmpdir(), "sabre-vel-"));
  api = join(estado, "api");
});
afterEach(() => {
  rmSync(estado, { recursive: true, force: true });
});

// API falsa do PaperMC em arquivos: o curl lê file:// (só na simulação).
function apiFalsa(opcoes: { sha?: string; url?: string } = {}) {
  const jar = join(estado, "velocity-falso.jar");
  const conteudo = "jar de mentira, so para o teste";
  writeFileSync(jar, conteudo);
  const sha = opcoes.sha ?? createHash("sha256").update(conteudo).digest("hex");
  const pasta = join(api, "projects/velocity/versions", VERSAO, "builds");
  mkdirSync(pasta, { recursive: true });
  writeFileSync(
    join(pasta, "latest"),
    JSON.stringify({
      id: 1,
      downloads: {
        "server:default": {
          name: "velocity.jar",
          url: opcoes.url ?? `file://${jar}`,
          checksums: { sha256: sha },
        },
      },
    }),
  );
}

function rodar(extra: Record<string, string> = {}) {
  const r = spawnSync("bash", [SCRIPT], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      SABRE_SIMULAR: "1",
      SABRE_ESTADO: join(estado, "estado"),
      SABRE_API_PAPERMC: `file://${api}`,
      ...extra,
    },
  });
  const comandos = r.stdout
    .split("\n")
    .filter((l) => l.startsWith("SIMULADO: "))
    .map((l) => l.slice("SIMULADO: ".length));
  return { ...r, comandos };
}

describe("infra/vps/instalar-velocity.sh em simulação", () => {
  it("termina sem erro nas duas rodadas", () => {
    apiFalsa();
    expect(rodar().status).toBe(0);
    expect(rodar().status).toBe(0);
  });

  it("velocity.toml tem porta pública, conta Microsoft e modern forwarding", () => {
    apiFalsa();
    const { stdout } = rodar();
    expect(stdout).toMatch(/GRAVAR 640 \/var\/lib\/sabre\/velocity\/velocity\.toml/);
    for (const linha of [
      'bind = "0.0.0.0:25565"',
      "online-mode = true",
      'player-info-forwarding-mode = "modern"',
      "force-key-authentication = true",
      'forwarding-secret-file = "forwarding.secret"',
      "[servers]",
      'host = "10.66.0.2:25565"',
      'try = ["host"]',
    ]) {
      expect(stdout, linha).toContain(linha);
    }
  });

  it("o toml traz o servidor espera (limbo local) sem mudar host nem try", () => {
    apiFalsa();
    const { stdout } = rodar();
    expect(stdout).toContain('espera = "127.0.0.1:25566"');
    expect(stdout).toContain('host = "10.66.0.2:25565"');
    expect(stdout).toContain('try = ["host"]');
    expect(stdout).not.toMatch(/try = .*espera/);
  });

  it("o segredo nunca aparece no toml nem na saída", () => {
    apiFalsa();
    const { stdout, stderr } = rodar();
    expect(stdout).not.toMatch(/forwarding-secret\s*=/);
    expect(stdout + stderr).not.toMatch(/PRIVATE KEY/);
    const gerar = rodar().comandos; // 2ª vez
    expect(gerar.some((c) => /forwarding\.secret/.test(c))).toBe(false);
  });

  it("segredo: gerado uma vez, umask 077, dono sabre, modo 600, de /dev/urandom", () => {
    apiFalsa();
    const cmds = rodar().comandos;
    const gerar = cmds.find((c) => /urandom/.test(c)) ?? "";
    expect(gerar).toMatch(/umask 077/);
    expect(gerar).toContain("/var/lib/sabre/velocity/forwarding.secret");
    expect(gerar).toMatch(/head -c (4[89]|[5-9]\d)\b/); // 32+ bytes
    expect(cmds).toContain("chown sabre:sabre /var/lib/sabre/velocity/forwarding.secret");
    expect(cmds).toContain("chmod 600 /var/lib/sabre/velocity/forwarding.secret");
  });

  it("2ª rodada não regenera segredo, toml, whitelist nem baixa o jar", () => {
    apiFalsa();
    const um = rodar().comandos;
    const dois = rodar().comandos;
    for (const padrao of [
      /urandom/,
      /GRAVAR .*velocity\.toml/,
      /GRAVAR .*whitelist\.txt/,
      /velocity\.jar/,
      /baixar/i,
    ]) {
      expect(
        um.some((c) => padrao.test(c)),
        `1ª vez deveria ter ${padrao}`,
      ).toBe(true);
      expect(
        dois.some((c) => padrao.test(c)),
        `2ª vez não deveria ter ${padrao}`,
      ).toBe(false);
    }
  });

  it("confere o hash antes de instalar o jar", () => {
    apiFalsa();
    const c = rodar().comandos;
    const conferido = c.findIndex((x) => /hash conferido/.test(x));
    const instalar = c.findIndex((x) => /^install .*velocity\.jar/.test(x));
    expect(conferido).toBeGreaterThanOrEqual(0);
    expect(instalar).toBeGreaterThan(conferido);
    expect(c[instalar]).toMatch(/-o root/);
  });

  it("jar com hash errado é recusado e nada é instalado", () => {
    apiFalsa({ sha: "0".repeat(64) });
    const r = rodar();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/hash do jar não confere/);
    expect(r.comandos.some((c) => /velocity\.jar/.test(c) && /^install/.test(c))).toBe(false);
  });

  it("hash malformado na resposta da API é recusado", () => {
    apiFalsa({ sha: "abc" });
    const r = rodar();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/SHA-256/);
  });

  it("URL de download que não é https é recusada (fora do arquivo falso)", () => {
    apiFalsa({ url: "http://exemplo.invalido/velocity.jar" });
    const r = rodar();
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/https/);
  });

  it("a API falsa só vale em simulação: de verdade, sem root, recusa antes de tudo", () => {
    const r = spawnSync("bash", [SCRIPT], {
      encoding: "utf8",
      env: { PATH: process.env.PATH, SABRE_FALSO_UID: "1000", SABRE_API_PAPERMC: `file://${api}` },
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/sudo/);
    expect(r.stdout).not.toMatch(/^\+ /m);
  });

  it.each([
    "8.8.8.8:25565",
    "192.168.0.5:25565",
    "10.66.0.1:25565", // o próprio hub
    "10.66.1.5:25565",
    "10.66.0.256:25565",
    "10.66.0.2:0",
    "10.66.0.2:70000",
    "0.0.0.0:25565",
    "10.66.0.2",
    "meuhost.exemplo.com:25565",
    '10.66.0.2:25565"\n[evil]',
  ])("destino fora da rede privada é recusado: %s", (destino) => {
    apiFalsa();
    const r = rodar({ SABRE_DESTINO: destino });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/destino/);
    expect(r.stdout).not.toMatch(/GRAVAR/);
  });

  it("destino válido da rede privada entra no toml", () => {
    apiFalsa();
    expect(rodar({ SABRE_DESTINO: "10.66.0.7:25566" }).stdout).toContain(
      'host = "10.66.0.7:25566"',
    );
  });

  it("whitelist vem de arquivo, vazio e sem permissão para os outros", () => {
    apiFalsa();
    expect(rodar().stdout).toMatch(/GRAVAR 640 \/var\/lib\/sabre\/velocity\/whitelist\.txt/);
  });

  it("a unidade sabre-velocity é instalada mas nunca habilitada nem iniciada", () => {
    apiFalsa();
    const c = rodar().comandos;
    expect(c.some((x) => /sabre-velocity\.service/.test(x))).toBe(true);
    expect(c.some((x) => /systemctl (enable|start|restart)/.test(x))).toBe(false);
  });

  it("não carrega segredo nenhum no código e usa o usuário sabre sem privilégio", () => {
    const fonte = readFileSync(SCRIPT, "utf8");
    expect(fonte).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY/);
    expect(fonte).not.toMatch(/(senha|password|token|secret)\s*=\s*["'][^"'$]+["']/i);
    const unidade = readFileSync(
      resolve(import.meta.dirname, "../../infra/vps/systemd/sabre-velocity.service"),
      "utf8",
    );
    expect(unidade).toMatch(/^User=sabre$/m);
    expect(unidade).toMatch(/^NoNewPrivileges=true$/m);
  });
});
