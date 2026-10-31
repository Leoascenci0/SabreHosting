import { spawnSync } from "node:child_process";
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = resolve(import.meta.dirname, "../../infra/vps/instalar.sh");
const SYSTEMD = resolve(import.meta.dirname, "../../infra/vps/systemd");
const unidade = (nome: string) => readFileSync(join(SYSTEMD, nome), "utf8");

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
    env: { PATH: process.env.PATH, SABRE_SIMULAR: "1", SABRE_FALSO_UID: "0", SABRE_ESTADO: estado, ...extra },
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

  it("libera exatamente 22/tcp, 25565/tcp e 51820/udp na internet; o cartório só em wg0", () => {
    for (const cmds of [rodar().comandos, rodar().comandos]) {
      const abertas = cmds.filter((c) => /^ufw (allow|limit)\b/.test(c)).sort();
      expect(abertas).toEqual([
        "ufw allow 22/tcp",
        "ufw allow 25565/tcp",
        "ufw allow 51820/udp",
        "ufw allow in on wg0 from 10.66.0.0/24 to 10.66.0.1 port 7710 proto tcp",
      ]);
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

  it("unidades systemd são instaladas; só o socket do ajudante é ligado", () => {
    const c = rodar().comandos;
    expect(c.some((x) => /sabre-cartorio\.service/.test(x))).toBe(true);
    expect(c.some((x) => /sabre-proxy\.service/.test(x))).toBe(true);
    const ligados = c.filter((x) => /systemctl (enable|start)\b.*sabre-/.test(x));
    expect(ligados).toEqual(["systemctl enable --now sabre-ajudante-entrada.socket"]);
  });

  it("segredo do cartório: criado pelo instalador na 1ª vez, mantido na 2ª, nunca impresso", () => {
    const um = rodar();
    const dois = rodar();
    const gerou = (cmds: string[]) =>
      cmds.some((c) => /gerar-segredo\.sh \/etc\/sabre\/cartorio\.env/.test(c));
    expect(gerou(um.comandos)).toBe(true);
    expect(gerou(dois.comandos)).toBe(false);
    expect(um.stdout + um.stderr).not.toMatch(/SEGREDO_ADMIN=[0-9a-f]{8}/);
  });

  it("unidade do cartório lê o segredo de /etc/sabre/cartorio.env", () => {
    const u = readFileSync(
      resolve(import.meta.dirname, "../../infra/vps/systemd/sabre-cartorio.service"),
      "utf8",
    );
    expect(u).toMatch(/^EnvironmentFile=\/etc\/sabre\/cartorio\.env$/m);
  });

  it("unidade do cartório segue blindada: sem sudo, sem ReadWritePaths novo (rede-1.5)", () => {
    const u = unidade("sabre-cartorio.service");
    expect(u).toMatch(/^User=sabre$/m);
    expect(u).toMatch(/^NoNewPrivileges=true$/m);
    expect(u).toMatch(/^ProtectSystem=strict$/m);
    expect(u.match(/^ReadWritePaths=.*$/gm)).toEqual(["ReadWritePaths=/var/lib/sabre"]);
    expect(u).not.toMatch(/sudo|AmbientCapabilities|CapabilityBoundingSet/);
  });

  it("socket do ajudante: /run/sabre/ajudante.sock, 0660 root:sabre, uma conexão por pedido", () => {
    const s = unidade("sabre-ajudante-entrada.socket");
    for (const linha of [
      "ListenStream=/run/sabre/ajudante.sock",
      "SocketUser=root",
      "SocketGroup=sabre",
      "SocketMode=0660",
      "Accept=yes",
    ])
      expect(s.split("\n")).toContain(linha);
  });

  it("serviço do ajudante: root blindado, só escreve no WireGuard e no registro, tempo-limite", () => {
    const u = unidade("sabre-ajudante-entrada@.service").split("\n");
    for (const linha of [
      "ExecStart=/opt/sabre/wg/ajudante-socket.sh",
      "StandardInput=socket",
      "StandardOutput=socket",
      "RuntimeMaxSec=10",
      "NoNewPrivileges=true",
      "ProtectSystem=strict",
      "ReadWritePaths=/etc/wireguard /var/lib/sabre-wg",
      "ProtectHome=true",
      "PrivateTmp=true",
      "CapabilityBoundingSet=CAP_NET_ADMIN",
      "UnsetEnvironment=SABRE_SIMULAR SABRE_ESTADO SABRE_ENDPOINT_HUB SABRE_CHAVE_PUB_HUB",
    ])
      expect(u).toContain(linha);
  });

  it.skipIf(spawnSync("systemd-analyze", ["--version"]).status !== 0)(
    "unidades do ajudante passam no systemd-analyze verify (chave desconhecida = falha)",
    () => {
      for (const nome of ["sabre-ajudante-entrada.socket", "sabre-ajudante-entrada@.service"]) {
        const r = spawnSync("systemd-analyze", ["verify", "--man=no", join(SYSTEMD, nome)], {
          encoding: "utf8",
        });
        // O ExecStart só existe na máquina da nuvem; o resto precisa sair limpo.
        const queixas = (r.stdout + r.stderr)
          .split("\n")
          .filter((l) => l && !/is not executable: No such file or directory/.test(l));
        expect(queixas, nome).toEqual([]);
      }
    },
  );

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

// Bloco gravado por "GRAVAR <modo> <destino>" na simulação: as linhas "|" seguintes.
function gravado(stdout: string, destino: RegExp) {
  const linhas = stdout.split("\n");
  const i = linhas.findIndex((l) => /^SIMULADO: GRAVAR \d+ /.test(l) && destino.test(l));
  if (i < 0) return undefined;
  const corpo: string[] = [];
  for (const l of linhas.slice(i + 1)) {
    if (!l.startsWith("SIMULADO:   | ")) break;
    corpo.push(l.slice("SIMULADO:   | ".length));
  }
  return { modo: (linhas[i] ?? "").split(" ")[2], texto: corpo.join("\n") + "\n" };
}

const BEFORE_UBUNTU = [
  "*filter",
  ":ufw-before-input - [0:0]",
  ":ufw-before-output - [0:0]",
  ":ufw-before-forward - [0:0]",
  ":ufw-not-local - [0:0]",
  "# End required lines",
  "",
  "# allow all on loopback",
  "-A ufw-before-input -i lo -j ACCEPT",
  "-A ufw-before-input -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT",
  "-A ufw-before-forward -m conntrack --ctstate RELATED,ESTABLISHED -j ACCEPT",
  "-A ufw-before-input -p icmp --icmp-type echo-request -j ACCEPT",
  "COMMIT",
  "",
].join("\n");

// Dá para carregar regras num namespace de rede isolado (root + unshare + iptables-restore)?
const podeIptables =
  spawnSync("unshare", ["-n", "iptables-restore", "--test"], { input: "*filter\nCOMMIT\n" })
    .status === 0;

describe("instalar.sh: ajudante da sala de entrada (rede-1.4)", () => {
  it("sem sudoers do convite: nada é gravado em /etc/sudoers.d e o antigo é apagado (rede-1.5)", () => {
    const { stdout, comandos } = rodar();
    expect(stdout).not.toMatch(/GRAVAR .*sudoers/);
    expect(comandos).toContain("rm -f /etc/sudoers.d/sabre-entrada");
    expect(readFileSync(SCRIPT, "utf8")).not.toMatch(/NOPASSWD|visudo/);
  });

  it("ajudante, porta do socket e fonte comum vão para /opt/sabre/wg, do root; registro em pasta só do root", () => {
    const c = rodar().comandos;
    expect(c).toContain(
      `install -m 755 -o root -g root ${resolve(import.meta.dirname, "../../infra/vps")}/wg/ajudante-socket.sh /opt/sabre/wg/ajudante-socket.sh`,
    );
    expect(c).toContain("install -d -m 755 -o root -g root /opt/sabre/wg");
    expect(
      c.some((x) =>
        /^install -m 755 -o root -g root \S+\/wg\/ajudante-entrada\.sh \/opt\/sabre\/wg\/ajudante-entrada\.sh$/.test(
          x,
        ),
      ),
    ).toBe(true);
    expect(
      c.some((x) =>
        /^install -m 644 -o root -g root \S+\/wg\/comum\.sh \/opt\/sabre\/wg\/comum\.sh$/.test(x),
      ),
    ).toBe(true);
    expect(c).toContain("install -d -m 700 -o root -g root /var/lib/sabre-wg");
  });

  it("2ª vez não regrava before.rules nem o ajudante, nem religa o socket", () => {
    rodar();
    const dois = rodar().comandos;
    expect(
      dois.some((x) => /sudoers|enable --now sabre-ajudante|ajudante-socket\.sh \/opt/.test(x)),
    ).toBe(false);
    expect(dois.some((x) => /GRAVAR .*(sudoers|before\.rules)/.test(x))).toBe(false);
    expect(dois.some((x) => /ajudante-entrada\.sh \/opt/.test(x))).toBe(false);
  });

  it("reinstalação com a unidade .socket mudada reinicia o socket (depois do daemon-reload); sem mudança, não", () => {
    const reinicia = (c: string[]) =>
      c.filter((x) => /systemctl restart sabre-ajudante-entrada/.test(x));
    expect(reinicia(rodar().comandos)).toEqual([]); // 1ª vez: enable --now basta
    expect(reinicia(rodar().comandos)).toEqual([]); // nada mudou
    // A unidade do socket mudou no repositório (na simulação, apagar a marca = arquivo diferente).
    rmSync(join(estado, "unidade-sabre-ajudante-entrada.socket"));
    const c = rodar().comandos;
    expect(reinicia(c)).toEqual(["systemctl restart sabre-ajudante-entrada.socket"]);
    expect(c.indexOf("systemctl restart sabre-ajudante-entrada.socket")).toBeGreaterThan(
      c.indexOf("systemctl daemon-reload"),
    );
    // Só o @.service mudou: vale na próxima conexão, sem derrubar o socket.
    rmSync(join(estado, "unidade-sabre-ajudante-entrada@.service"));
    expect(reinicia(rodar().comandos)).toEqual([]);
  });

  it("endereço do hub vai para /etc/sabre/hub.env só quando informado; torto para o instalador", () => {
    expect(gravado(rodar().stdout, /hub\.env$/)).toBeUndefined();
    const g = gravado(
      rodar({ SABRE_ENDPOINT_HUB: "hub.exemplo.org:51820" }).stdout,
      /\/etc\/sabre\/hub\.env$/,
    );
    expect(g).toEqual({ modo: "644", texto: "SABRE_ENDPOINT_HUB=hub.exemplo.org:51820\n" });
    const torto = rodar({ SABRE_ENDPOINT_HUB: "x;rm -rf /:1" });
    expect(torto.status).not.toBe(0);
  });

  describe("firewall da sala de entrada", () => {
    const comBefore = (conteudo: string, extra: Record<string, string> = {}) => {
      const arq = join(estado, "before-ubuntu.rules");
      writeFileSync(arq, conteudo);
      const r = rodar({ SABRE_UFW_BEFORE_FALSO: arq, ...extra });
      return { r, g: gravado(r.stdout, /before-ubuntu\.rules$/) };
    };
    const regrasSala = (texto: string) =>
      texto.split("\n").filter((l) => l.startsWith("-A") && l.includes("iprange"));

    it("a sala só alcança 10.66.0.1:7710/tcp e não tem repasse de nem para outro PC", () => {
      const { g } = comBefore(BEFORE_UBUNTU);
      expect(g?.modo).toBe("640");
      expect(regrasSala(g?.texto ?? "")).toEqual([
        "-A ufw-before-input -i wg0 -p tcp -m iprange --src-range 10.66.0.200-10.66.0.254 -d 10.66.0.1 -m tcp --dport 7710 -j ACCEPT",
        "-A ufw-before-input -m iprange --src-range 10.66.0.200-10.66.0.254 -j DROP",
        "-A ufw-before-forward -m iprange --src-range 10.66.0.200-10.66.0.254 -j DROP",
        "-A ufw-before-forward -m iprange --dst-range 10.66.0.200-10.66.0.254 -j DROP",
      ]);
    });

    it("as regras da sala vêm antes de qualquer ACCEPT do ufw (inclusive conexão já aberta e ping)", () => {
      const { g } = comBefore(BEFORE_UBUNTU);
      const l = (g?.texto ?? "").split("\n");
      const fimSala = l.findIndex((x) => x.startsWith("# sabre-sala-de-entrada: fim"));
      const primeiroAcceptUfw = l.findIndex(
        (x) => x.startsWith("-A") && !x.includes("iprange") && x.endsWith("ACCEPT"),
      );
      expect(l.indexOf("# End required lines")).toBeLessThan(fimSala);
      expect(fimSala).toBeLessThan(primeiroAcceptUfw);
      // O resto do arquivo do ufw continua igual.
      expect(l.filter((x) => !x.includes("iprange") && !x.startsWith("# sabre-sala"))).toEqual(
        BEFORE_UBUNTU.split("\n"),
      );
    });

    it("bloco antigo é trocado, nunca duplicado", () => {
      const velho = BEFORE_UBUNTU.replace(
        "# End required lines\n",
        "# End required lines\n# sabre-sala-de-entrada: início (gravado pelo instalar.sh)\n-A ufw-before-input -j ACCEPT\n# sabre-sala-de-entrada: fim\n",
      );
      const { g } = comBefore(velho, { SABRE_CHECAR_REAL: "1" });
      expect((g?.texto ?? "").match(/sabre-sala-de-entrada: início/g)).toHaveLength(1);
      expect(regrasSala(g?.texto ?? "")).toHaveLength(4);
      expect(g?.texto ?? "").not.toContain("-A ufw-before-input -j ACCEPT\n");
    });

    it("arquivo do ufw desconhecido (sem '# End required lines'): para sem gravar", () => {
      const { r, g } = comBefore("*filter\nCOMMIT\n");
      expect(r.status).not.toBe(0);
      expect(r.stderr).toMatch(/End required lines/);
      expect(g).toBeUndefined();
    });

    it.skipIf(!podeIptables)(
      "o iptables aceita as regras (carregadas num namespace de rede isolado)",
      () => {
        const { g } = comBefore(BEFORE_UBUNTU);
        const r = spawnSync(
          "unshare",
          ["-n", "sh", "-c", "iptables-restore && iptables -S ufw-before-forward"],
          {
            input: g?.texto ?? "",
            encoding: "utf8",
          },
        );
        expect(r.status, r.stderr).toBe(0);
        expect(r.stdout).toContain(
          "-A ufw-before-forward -m iprange --src-range 10.66.0.200-10.66.0.254 -j DROP",
        );
        expect(r.stdout).toContain(
          "-A ufw-before-forward -m iprange --dst-range 10.66.0.200-10.66.0.254 -j DROP",
        );
      },
    );

    it("nenhuma porta nova na internet: o cartório só é liberado em wg0, no IP do hub", () => {
      const c = rodar().comandos;
      expect(c.filter((x) => /^ufw .*7710/.test(x))).toEqual([
        "ufw allow in on wg0 from 10.66.0.0/24 to 10.66.0.1 port 7710 proto tcp",
      ]);
    });
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

describe("infra/vps/gerar-segredo.sh", () => {
  const GERAR = resolve(import.meta.dirname, "../../infra/vps/gerar-segredo.sh");
  const gerar = (arq: string) => spawnSync("bash", [GERAR, arq], { encoding: "utf8" });

  it("cria o arquivo 0600 com 64 hex, não imprime o segredo e a 2ª execução não troca", () => {
    const arq = join(estado, "cartorio.env");
    const a = gerar(arq);
    expect(a.status).toBe(0);
    expect(statSync(arq).mode & 0o777).toBe(0o600);
    const conteudo = readFileSync(arq, "utf8");
    const m = conteudo.match(/^SABRE_CARTORIO_SEGREDO_ADMIN=([0-9a-f]{64})\n$/);
    const segredo = m?.[1] ?? "";
    expect(segredo).toHaveLength(64);
    expect(a.stdout + a.stderr).not.toContain(segredo);
    const b = gerar(arq);
    expect(b.status).toBe(0);
    expect(readFileSync(arq, "utf8")).toBe(conteudo);
    expect(b.stdout + b.stderr).not.toContain(segredo);
  });

  it("openssl que falha: sai com erro e não deixa arquivo", () => {
    const falso = join(estado, "bin");
    mkdirSync(falso);
    writeFileSync(join(falso, "openssl"), "#!/bin/sh\nexit 1\n");
    chmodSync(join(falso, "openssl"), 0o755);
    const arq = join(estado, "cartorio.env");
    const r = spawnSync("bash", [GERAR, arq], {
      encoding: "utf8",
      env: { PATH: `${falso}:${process.env.PATH}` },
    });
    expect(r.status).not.toBe(0);
    expect(existsSync(arq)).toBe(false);
  });

  it("arquivo com segredo inválido é refeito", () => {
    const arq = join(estado, "cartorio.env");
    writeFileSync(arq, "SABRE_CARTORIO_SEGREDO_ADMIN=\n", { mode: 0o600 });
    expect(gerar(arq).status).toBe(0);
    expect(readFileSync(arq, "utf8")).toMatch(/^SABRE_CARTORIO_SEGREDO_ADMIN=[0-9a-f]{64}\n$/);
  });

  it("arquivo bom com permissão frouxa volta a 0600 sem trocar o segredo", () => {
    const arq = join(estado, "cartorio.env");
    gerar(arq);
    const antes = readFileSync(arq, "utf8");
    chmodSync(arq, 0o644);
    expect(gerar(arq).status).toBe(0);
    expect(statSync(arq).mode & 0o777).toBe(0o600);
    expect(readFileSync(arq, "utf8")).toBe(antes);
  });
});
