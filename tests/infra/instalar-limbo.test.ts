import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const RAIZ = resolve(import.meta.dirname, "../..");
const SCRIPT = join(RAIZ, "infra/vps/limbo/instalar-limbo.sh");
const CONTEUDO = "binario de mentira, so para o teste";

let estado: string;
let binario: string;
beforeEach(() => {
  estado = mkdtempSync(join(tmpdir(), "sabre-limbo-"));
  binario = join(estado, "limbo-falso");
  writeFileSync(binario, CONTEUDO);
});
afterEach(() => {
  rmSync(estado, { recursive: true, force: true });
});

const shaCerto = () => createHash("sha256").update(CONTEUDO).digest("hex");

function rodar(extra: Record<string, string> = {}) {
  const r = spawnSync("bash", [SCRIPT], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      SABRE_SIMULAR: "1",
      SABRE_ESTADO: join(estado, "estado"),
      SABRE_LIMBO_URL: `file://${binario}`,
      SABRE_LIMBO_SHA256: shaCerto(),
      ...extra,
    },
  });
  const comandos = r.stdout
    .split("\n")
    .filter((l) => l.startsWith("SIMULADO: "))
    .map((l) => l.slice("SIMULADO: ".length));
  return { ...r, comandos };
}

describe("infra/vps/limbo/instalar-limbo.sh em simulação", () => {
  it("termina sem erro nas duas rodadas", () => {
    expect(rodar().status).toBe(0);
    expect(rodar().status).toBe(0);
  });

  it("2ª rodada não baixa de novo nem regrava config nem unidade", () => {
    const um = rodar().comandos;
    const dois = rodar().comandos;
    for (const padrao of [/baixar/i, /GRAVAR .*server\.toml/, /sabre-limbo\.service/, /\/opt\/sabre\/limbo\/pico/]) {
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

  it("hash errado é recusado e nada é instalado", () => {
    const r = rodar({ SABRE_LIMBO_SHA256: "0".repeat(64) });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/hash do limbo não confere/);
    expect(r.comandos.some((c) => /^install .*picolimbo/.test(c))).toBe(false);
  });

  it("hash não fixado (vazio ou malformado) é recusado antes de baixar", () => {
    for (const sha of ["", "abc"]) {
      const r = rodar({ SABRE_LIMBO_SHA256: sha });
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/SHA-256/);
      expect(r.comandos.some((c) => /baixar/i.test(c))).toBe(false);
    }
  });

  it("o manifesto do repositório ainda não tem hash inventado: sem override, recusa", () => {
    const r = spawnSync("bash", [SCRIPT], {
      encoding: "utf8",
      env: { PATH: process.env.PATH, SABRE_SIMULAR: "1", SABRE_ESTADO: join(estado, "e2") },
    });
    const manifesto = readFileSync(join(RAIZ, "infra/vps/limbo/limbo-release.env"), "utf8");
    if (!/^LIMBO_SHA256_x86_64=[0-9a-f]{64}$/m.test(manifesto)) {
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/SHA-256/);
    }
  });

  it("confere o hash antes de instalar o binário", () => {
    const c = rodar().comandos;
    const conferido = c.findIndex((x) => /hash conferido/.test(x));
    const instalar = c.findIndex((x) => /^install .*picolimbo/.test(x));
    expect(conferido).toBeGreaterThanOrEqual(0);
    expect(instalar).toBeGreaterThan(conferido);
    expect(c[instalar]).toMatch(/-o root/);
  });

  it("URL que não é https é recusada (fora do arquivo falso)", () => {
    const r = rodar({ SABRE_LIMBO_URL: "http://exemplo.invalido/picolimbo" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/https/);
  });

  it("escuta só em 127.0.0.1, na porta interna, e a mensagem está em pt-BR", () => {
    const { stdout } = rodar();
    expect(stdout).toMatch(/GRAVAR 600 \/var\/lib\/sabre\/limbo\/server\.toml/);
    expect(stdout).toContain('bind = "127.0.0.1:25566"');
    expect(stdout).not.toMatch(/0\.0\.0\.0/);
    expect(stdout).toContain("Trocando de casa… volta já");
    expect(stdout).toContain('method = "MODERN"');
  });

  it("o segredo do Velocity nunca é impresso: a config leva só o marcador", () => {
    const { stdout, stderr } = rodar();
    expect(stdout).toContain("@SEGREDO@");
    expect(stdout + stderr).not.toMatch(/PRIVATE KEY/);
    const fonte = readFileSync(SCRIPT, "utf8");
    expect(fonte).not.toMatch(/echo[^\n]*\$\(?(cat|<)[^\n]*forwarding\.secret/);
  });

  it("a porta interna nunca vai para o firewall nem para o instalar.sh", () => {
    const { stdout, stderr } = rodar();
    expect(stdout + stderr).not.toMatch(/ufw/);
    const fonte = readFileSync(SCRIPT, "utf8");
    expect(fonte).not.toMatch(/^\s*(executar )?ufw /m);
    expect(readFileSync(join(RAIZ, "infra/vps/instalar.sh"), "utf8")).not.toContain("25566");
  });

  it("a unidade sabre-limbo é instalada mas nunca habilitada nem iniciada", () => {
    const c = rodar().comandos;
    expect(c.some((x) => /sabre-limbo\.service/.test(x))).toBe(true);
    expect(c.some((x) => /systemctl (enable|start|restart)/.test(x))).toBe(false);
  });

  it("a unidade roda como sabre, endurecida", () => {
    const u = readFileSync(join(RAIZ, "infra/vps/systemd/sabre-limbo.service"), "utf8");
    for (const linha of ["User=sabre", "NoNewPrivileges=true", "ProtectSystem=strict", "PrivateTmp=true"]) {
      expect(u).toMatch(new RegExp(`^${linha}$`, "m"));
    }
    expect(u).toMatch(/^RestrictAddressFamilies=AF_INET AF_INET6$/m);
  });

  it("sem root, recusa antes de tudo", () => {
    const r = spawnSync("bash", [SCRIPT], { encoding: "utf8", env: { PATH: process.env.PATH, SABRE_FALSO_UID: "1000" } });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/sudo/);
    expect(r.stdout).not.toMatch(/^\+ /m);
  });

  it("acrescenta o servidor espera ao velocity.toml que já existe", () => {
    const c = rodar().comandos;
    expect(c.some((x) => /espera/.test(x) && /velocity\.toml/.test(x))).toBe(true);
  });
});
