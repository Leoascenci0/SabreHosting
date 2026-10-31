import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const SCRIPT = resolve(import.meta.dirname, "../../infra/vps/wg/adicionar-pc.sh");
const HUB_PUB = Buffer.alloc(32, 7).toString("base64");

let estado: string;
beforeEach(() => {
  estado = mkdtempSync(join(tmpdir(), "sabre-wg-"));
});
afterEach(() => {
  rmSync(estado, { recursive: true, force: true });
});

const chaveNova = () => randomBytes(32).toString("base64");

function rodar(args: string[], extra: Record<string, string> = {}) {
  const r = spawnSync("bash", [SCRIPT, ...args], {
    encoding: "utf8",
    env: {
      PATH: process.env.PATH,
      SABRE_SIMULAR: "1",
      SABRE_ESTADO: estado,
      SABRE_ENDPOINT_HUB: "hub.exemplo.org:51820",
      SABRE_CHAVE_PUB_HUB: HUB_PUB,
      ...extra,
    },
  });
  const linhaJson = r.stdout.split("\n").find((l) => l.startsWith("{"));
  const pacote = linhaJson ? (JSON.parse(linhaJson) as Record<string, string>) : undefined;
  const comandos = r.stdout
    .split("\n")
    .filter((l) => l.startsWith("SIMULADO: "))
    .map((l) => l.slice("SIMULADO: ".length));
  return { ...r, pacote, comandos };
}

const confHub = () => readFileSync(join(estado, "wg0.conf"), "utf8");
const registro = () => readFileSync(join(estado, "pcs.tsv"), "utf8");

describe("infra/vps/wg/adicionar-pc.sh em simulação", () => {
  it("dois PCs recebem IPs diferentes, a partir de 10.66.0.2", () => {
    const a = rodar(["adicionar", "pc-eliel", chaveNova()]);
    const b = rodar(["adicionar", "pc-joao", chaveNova()]);
    expect(a.status).toBe(0);
    expect(b.status).toBe(0);
    expect(a.pacote?.ip_pc).toBe("10.66.0.2");
    expect(b.pacote?.ip_pc).toBe("10.66.0.3");
  });

  it("o pacote do PC tem AllowedIPs 10.66.0.0/24 (nunca 0.0.0.0/0) e só chave pública do hub", () => {
    const r = rodar(["adicionar", "pc-eliel", chaveNova()]);
    expect(r.pacote).toEqual({
      ip_pc: "10.66.0.2",
      chave_publica_hub: HUB_PUB,
      endpoint: "hub.exemplo.org:51820",
      allowed_ips: "10.66.0.0/24",
    });
    expect(r.stdout).not.toContain("0.0.0.0/0");
  });

  it("no hub, o [Peer] de cada PC usa sempre /32 e a chave pública informada", () => {
    const k1 = chaveNova();
    const k2 = chaveNova();
    rodar(["adicionar", "pc-eliel", k1]);
    rodar(["adicionar", "pc-joao", k2]);
    const conf = confHub();
    const allowed = conf.split("\n").filter((l) => l.startsWith("AllowedIPs"));
    expect(allowed).toEqual(["AllowedIPs = 10.66.0.2/32", "AllowedIPs = 10.66.0.3/32"]);
    expect(conf).toContain(`PublicKey = ${k1}`);
    expect(conf).toContain(`PublicKey = ${k2}`);
    expect(conf).not.toContain("PrivateKey");
  });

  it("chama o wg com argumentos fixos: peer, chave pública e allowed-ips /32", () => {
    const k = chaveNova();
    const r = rodar(["adicionar", "pc-eliel", k]);
    expect(r.comandos).toContain(`wg set wg0 peer ${k} allowed-ips 10.66.0.2/32`);
  });

  it("recusa chave pública inválida e não grava nada", () => {
    const ruins = [
      "",
      "curta",
      "A".repeat(44), // 44 caracteres mas sem o "=" final
      `${"A".repeat(42)}B=`, // último símbolo com bits sobrando: não é 32 bytes
      `${"A".repeat(42)}=\n=`, // quebra de linha escondida
      `${chaveNova()}\nAllowedIPs = 0.0.0.0/0`, // tentativa de injetar linha
      "!".repeat(43) + "=",
    ];
    for (const ruim of ruins) {
      const r = rodar(["adicionar", "pc-x", ruim]);
      expect(r.status, JSON.stringify(ruim)).not.toBe(0);
    }
    expect(() => statSync(join(estado, "pcs.tsv"))).toThrow();
  });

  it("recusa nome inválido e endpoint inválido", () => {
    for (const nome of ["", "PC Eliel", "../x", "a;b", "x".repeat(40), "-pc"]) {
      expect(rodar(["adicionar", nome, chaveNova()]).status, nome).not.toBe(0);
    }
    for (const endpoint of ["", "hub", "hub:99999", "hub.org:51820\nPostUp = x", "$(id):51820"]) {
      const r = rodar(["adicionar", "pc-x", chaveNova()], { SABRE_ENDPOINT_HUB: endpoint });
      expect(r.status, JSON.stringify(endpoint)).not.toBe(0);
    }
  });

  it("re-adicionar o mesmo PC é idempotente: mesmo IP, um só [Peer], registro intacto", () => {
    const k = chaveNova();
    const um = rodar(["adicionar", "pc-eliel", k]);
    const dois = rodar(["adicionar", "pc-eliel", k]);
    expect(dois.status).toBe(0);
    expect(dois.pacote).toEqual(um.pacote);
    expect(confHub().match(/\[Peer\]/g)).toHaveLength(1);
    expect(registro().trim().split("\n")).toHaveLength(1);
  });

  it("mesmo nome com outra chave, ou mesma chave com outro nome, é recusado", () => {
    const k = chaveNova();
    rodar(["adicionar", "pc-eliel", k]);
    expect(rodar(["adicionar", "pc-eliel", chaveNova()]).status).not.toBe(0);
    expect(rodar(["adicionar", "pc-joao", k]).status).not.toBe(0);
    expect(confHub().match(/\[Peer\]/g)).toHaveLength(1);
  });

  it("registro e wg0.conf ficam com permissão 600", () => {
    rodar(["adicionar", "pc-eliel", chaveNova()]);
    expect(statSync(join(estado, "pcs.tsv")).mode & 0o777).toBe(0o600);
    expect(statSync(join(estado, "wg0.conf")).mode & 0o777).toBe(0o600);
  });

  it("remover tira o peer e o IP nunca volta para outro PC", () => {
    const k = chaveNova();
    rodar(["adicionar", "pc-eliel", k]);
    const rem = rodar(["remover", "pc-eliel"]);
    expect(rem.status).toBe(0);
    expect(rem.comandos).toContain(`wg set wg0 peer ${k} remove`);
    expect(confHub()).not.toContain("[Peer]");
    const novo = rodar(["adicionar", "pc-joao", chaveNova()]);
    expect(novo.pacote?.ip_pc).toBe("10.66.0.3");
  });

  it("remover PC que não existe não é erro (idempotente)", () => {
    expect(rodar(["remover", "pc-fantasma"]).status).toBe(0);
  });

  it("acaba o espaço (198 PCs, 10.66.0.2–199) com erro claro, sem repetir IP nem invadir a sala de entrada", () => {
    const antigas = Array.from(
      { length: 197 },
      (_, i) => `pc-${i}\t10.66.0.${i + 2}\t${chaveNova()}\tativo`,
    );
    writeFileSync(join(estado, "pcs.tsv"), antigas.join("\n") + "\n", { mode: 0o600 });
    const ultimo = rodar(["adicionar", "pc-ultimo", chaveNova()]);
    expect(ultimo.pacote?.ip_pc).toBe("10.66.0.199");
    const r = rodar(["adicionar", "pc-extra", chaveNova()]);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toMatch(/endereço livre/);
    const ips = registro()
      .trim()
      .split("\n")
      .map((l) => l.split("\t")[1]);
    expect(new Set(ips).size).toBe(198);
  });

  it("usa o modo de simulação por padrão sem tocar em /etc (estado só em SABRE_ESTADO)", () => {
    const r = rodar(["adicionar", "pc-eliel", chaveNova()]);
    expect(r.stdout).toMatch(/SIMULADO: wg set/);
  });
});
