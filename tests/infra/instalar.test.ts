import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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
      /GRAVAR .*00-sabre\.conf/,
      /systemctl reload ssh/,
      /enable --now wg-quick/,
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

  it("SSH: testa a configuração (com desfazer) antes de recarregar", () => {
    const c = rodar().comandos;
    const gravar = c.findIndex((x) => /^GRAVAR .*00-sabre\.conf/.test(x));
    const teste = c.findIndex(
      (x) => x.includes("sshd -t") && x.includes("rm -f /etc/ssh/sshd_config.d/00-sabre.conf"),
    );
    const recarregar = c.indexOf("systemctl reload ssh");
    expect(gravar).toBeGreaterThanOrEqual(0);
    expect(teste).toBeGreaterThan(gravar);
    expect(recarregar).toBeGreaterThan(teste);
  });

  it("apt roda sem perguntas", () => {
    expect(readFileSync(SCRIPT, "utf8")).toContain("export DEBIAN_FRONTEND=noninteractive");
  });
});

// Testes com dpkg/node/systemctl falsos no PATH: a simulação roda só os testes reais (que apenas leem).
describe("checagens reais com ferramentas falsas", () => {
  function comFalsos(scripts: Record<string, string>) {
    const bin = join(estado, "bin");
    mkdirSync(bin);
    for (const [nome, corpo] of Object.entries(scripts)) {
      writeFileSync(join(bin, nome), `#!/bin/sh\n${corpo}\n`);
      chmodSync(join(bin, nome), 0o755);
    }
    return rodar({
      SABRE_CHECAR_REAL: "1",
      PATH: `${bin}:${process.env.PATH}`,
    });
  }
  const todosOk = { dpkg: "exit 0", node: "echo v22.11.0", systemctl: "exit 0" };

  it("tudo pronto: não instala pacote nem Node nem sobe o wg0", () => {
    const c = comFalsos(todosOk).comandos;
    expect(c.some((x) => /apt-get|nodesource/.test(x))).toBe(false);
    expect(c.some((x) => /enable --now wg-quick/.test(x))).toBe(false);
  });

  it("um pacote faltando no meio da lista refaz a instalação", () => {
    const c = comFalsos({ ...todosOk, dpkg: '[ "$2" = ufw ] && exit 1; exit 0' }).comandos;
    expect(c.some((x) => x.startsWith("apt-get install") && x.includes("ufw"))).toBe(true);
  });

  it("Node 18 já instalado ainda instala o 22 pelo NodeSource", () => {
    const c = comFalsos({ ...todosOk, node: "echo v18.19.1" }).comandos;
    expect(c.some((x) => x === "apt-get install -y --no-install-recommends nodejs")).toBe(true);
    expect(c.some((x) => /GRAVAR .*nodesource\.list/.test(x))).toBe(true);
  });

  it("wg0 habilitado mas parado sobe de novo", () => {
    const c = comFalsos({
      ...todosOk,
      systemctl: '[ "$1" = is-active ] && exit 3; exit 0',
    }).comandos;
    expect(c).toContain("systemctl enable --now wg-quick@wg0");
  });
});
