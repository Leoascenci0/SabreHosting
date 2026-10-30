import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = resolve(import.meta.dirname, "../../infra/vps/instalar.sh");

let estado: string;
beforeEach(() => {
  estado = mkdtempSync(join(tmpdir(), "sabre-sim-"));
});
afterEach(() => {
  rmSync(estado, { recursive: true, force: true });
});

function rodar(extra: Record<string, string> = {}) {
  const r = spawnSync("bash", [SCRIPT], {
    encoding: "utf8",
    env: { PATH: process.env.PATH, SABRE_SIMULAR: "1", SABRE_ESTADO: estado, ...extra },
  });
  const comandos = r.stdout
    .split("\n")
    .filter((l) => l.startsWith("SIMULADO: "))
    .map((l) => l.slice("SIMULADO: ".length));
  return { ...r, comandos };
}

describe("infra/vps/instalar.sh em simulação", () => {
  it("termina sem erro nas duas rodadas", () => {
    expect(rodar().status).toBe(0);
    expect(rodar().status).toBe(0);
  });

  it("1ª vez cria usuário, chave do hub e wg0; 2ª vez não recria nada disso", () => {
    const um = rodar().comandos;
    const dois = rodar().comandos;
    for (const padrao of [
      /useradd/,
      /wg genkey/,
      /GRAVAR .*wg0\.conf/,
      /nodesource/,
      /apt-get install/,
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

  it("libera exatamente 22/tcp, 25565/tcp e 51820/udp", () => {
    for (const cmds of [rodar().comandos, rodar().comandos]) {
      const abertas = cmds.filter((c) => /^ufw (allow|limit)\b/.test(c)).sort();
      expect(abertas).toEqual(["ufw allow 22/tcp", "ufw allow 25565/tcp", "ufw allow 51820/udp"]);
    }
  });

  it("nega entrada por padrão e libera o SSH antes de ligar o firewall", () => {
    const c = rodar().comandos;
    const negar = c.indexOf("ufw default deny incoming");
    const ssh = c.indexOf("ufw allow 22/tcp");
    const ligar = c.findIndex((x) => /^ufw --force enable/.test(x));
    expect(negar).toBeGreaterThanOrEqual(0);
    expect(ssh).toBeGreaterThan(-1);
    expect(ligar).toBeGreaterThan(ssh);
    expect(c.some((x) => /ufw (--force )?reset/.test(x))).toBe(false);
  });

  it("repasse de IP só entre wg0 e wg0", () => {
    const rotas = rodar().comandos.filter((c) => c.startsWith("ufw route"));
    expect(rotas).toEqual(["ufw route allow in on wg0 out on wg0"]);
  });

  it("SSH só com chave, sem root, em arquivo que vence o do cloud-init", () => {
    const { stdout } = rodar();
    expect(stdout).toMatch(/GRAVAR 644 \/etc\/ssh\/sshd_config\.d\/00-sabre\.conf/);
    expect(stdout).toMatch(/PasswordAuthentication no/);
    expect(stdout).toMatch(/PermitRootLogin no/);
    expect(stdout).toMatch(/KbdInteractiveAuthentication no/);
  });

  it("usuário sabre é de sistema, sem shell e sem sudo", () => {
    const u = rodar().comandos.find((c) => c.startsWith("useradd")) ?? "";
    expect(u).toContain("--system");
    expect(u).toContain("/usr/sbin/nologin");
    expect(u).not.toMatch(/sudo|-G/);
  });

  it("wg0 usa 10.66.0.1/24 e a chave privada nunca entra no arquivo", () => {
    const { stdout } = rodar();
    expect(stdout).toContain("Address = 10.66.0.1/24");
    expect(stdout).toContain("ListenPort = 51820");
    expect(stdout).not.toMatch(/PrivateKey\s*=/);
    expect(stdout).toMatch(/GRAVAR 600 \/etc\/wireguard\/wg0\.conf/);
    const chave = rodar().comandos; // 2ª vez: sem geração
    expect(chave.some((c) => /wg genkey/.test(c))).toBe(false);
  });

  it("chave do hub é gerada com umask 077", () => {
    const g = rodar().comandos.find((c) => /wg genkey/.test(c)) ?? "";
    expect(g).toMatch(/umask 077/);
  });

  it("unidades systemd são instaladas mas nunca habilitadas", () => {
    const c = rodar().comandos;
    expect(c.some((x) => /sabre-cartorio\.service/.test(x))).toBe(true);
    expect(c.some((x) => /sabre-proxy\.service/.test(x))).toBe(true);
    expect(c.some((x) => /systemctl (enable|start)\b.*sabre-/.test(x))).toBe(false);
  });

  it("o script não carrega segredo nenhum", () => {
    const fonte = readFileSync(SCRIPT, "utf8");
    expect(fonte).not.toMatch(/-----BEGIN [A-Z ]*PRIVATE KEY/);
    expect(fonte).not.toMatch(/(senha|password|token|secret)\s*=\s*["'][^"'$]+["']/i);
  });

  it("recusa sistema que não é Ubuntu 22.04/24.04", () => {
    const r = rodar({ SABRE_OS_RELEASE_FALSO: "ID=debian\nVERSION_ID=12" });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/Ubuntu 22\.04 ou 24\.04/);
  });

  it("sem simulação e sem root, recusa antes de mudar qualquer coisa", () => {
    const r = spawnSync("bash", [SCRIPT], {
      encoding: "utf8",
      env: { PATH: process.env.PATH, SABRE_FALSO_UID: "1000" },
    });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/sudo/);
    expect(r.stdout).not.toMatch(/^\+ /m);
  });
});
