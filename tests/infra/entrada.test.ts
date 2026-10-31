import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const AJUDANTE = resolve(import.meta.dirname, "../../infra/vps/wg/ajudante-entrada.sh");
const ADICIONAR_PC = resolve(import.meta.dirname, "../../infra/vps/wg/adicionar-pc.sh");
const HUB_PUB = Buffer.alloc(32, 7).toString("base64");

let estado: string;
beforeEach(() => {
  estado = mkdtempSync(join(tmpdir(), "sabre-entrada-"));
});
afterEach(() => {
  rmSync(estado, { recursive: true, force: true });
});

const chaveNova = () => randomBytes(32).toString("base64");

function rodar(args: string[], extra: Record<string, string> = {}, script = AJUDANTE) {
  const r = spawnSync("bash", [script, ...args], {
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
  const json = linhaJson ? (JSON.parse(linhaJson) as Record<string, string>) : undefined;
  const comandos = r.stdout
    .split("\n")
    .filter((l) => l.startsWith("SIMULADO: "))
    .map((l) => l.slice("SIMULADO: ".length));
  return { ...r, json, comandos };
}

const ler = (f: string) =>
  existsSync(join(estado, f)) ? readFileSync(join(estado, f), "utf8") : "<sem arquivo>";
const fotografia = () => ({ conf: ler("wg0.conf"), registro: ler("pcs.tsv") });
const linhas = () =>
  ler("pcs.tsv")
    .trim()
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split("\t"));
const ultimoOcteto = (ip: string) => Number(ip.split(".")[3]);

/** Provisório pronto: devolve o IP e a chave provisória. */
function provisorio() {
  const k = chaveNova();
  const r = rodar(["entrada-adicionar", k]);
  expect(r.status, r.stderr).toBe(0);
  return { ip: r.json?.ip ?? "", chave: k };
}

describe("ajudante-entrada.sh: entrada-adicionar", () => {
  it("dá IP da sala de entrada (200–254), nunca da faixa dos PCs (2–199)", () => {
    const ips = [provisorio().ip, provisorio().ip, provisorio().ip];
    expect(ips).toEqual(["10.66.0.200", "10.66.0.201", "10.66.0.202"]);
    for (const ip of ips) expect(ultimoOcteto(ip)).toBeGreaterThanOrEqual(200);
  });

  it("grava o peer com estado `entrada` no registro e no wg0.conf (/32)", () => {
    const { ip, chave } = provisorio();
    expect(linhas()).toEqual([["entrada", ip, chave, "entrada"]]);
    expect(ler("wg0.conf")).toContain(
      `# sabre-entrada: ${ip}\n[Peer]\nPublicKey = ${chave}\nAllowedIPs = ${ip}/32\n`,
    );
    expect(statSync(join(estado, "pcs.tsv")).mode & 0o777).toBe(0o600);
  });

  it("é idempotente pela chave: mesma chave = mesmo IP, sem linha nova", () => {
    const { ip, chave } = provisorio();
    const de_novo = rodar(["entrada-adicionar", chave]);
    expect(de_novo.status).toBe(0);
    expect(de_novo.json).toEqual({ ip });
    expect(linhas()).toHaveLength(1);
  });

  it("sala cheia (55 provisórios) = código 1, sem mudar nada", () => {
    const cheia = Array.from(
      { length: 55 },
      (_, i) => `entrada\t10.66.0.${200 + i}\t${chaveNova()}\tentrada`,
    );
    writeFileSync(join(estado, "pcs.tsv"), cheia.join("\n") + "\n", { mode: 0o600 });
    const antes = ler("pcs.tsv");
    const r = rodar(["entrada-adicionar", chaveNova()]);
    expect(r.status).toBe(1);
    expect(r.stderr).toMatch(/ERRO: .*sala de entrada/);
    expect(ler("pcs.tsv")).toBe(antes);
  });

  it("chave de um PC definitivo não vira provisória", () => {
    const k = chaveNova();
    expect(rodar(["adicionar", "pc-eliel", k], {}, ADICIONAR_PC).status).toBe(0);
    const antes = fotografia();
    expect(rodar(["entrada-adicionar", k]).status).toBe(1);
    expect(fotografia()).toEqual(antes);
  });

  it("o IP de um provisório removido volta para a sala (55 vagas não acabam)", () => {
    const a = provisorio();
    expect(rodar(["entrada-remover", a.ip]).status).toBe(0);
    expect(provisorio().ip).toBe(a.ip);
  });
});

describe("ajudante-entrada.sh: entrada-trocar", () => {
  it("aloca IP definitivo (2–199), devolve o pacote do adicionar-pc e MANTÉM o provisório", () => {
    const p = provisorio();
    const def = chaveNova();
    const r = rodar(["entrada-trocar", p.ip, "pc-joao", def]);
    expect(r.status, r.stderr).toBe(0);
    expect(r.json).toEqual({
      ip_pc: "10.66.0.2",
      chave_publica_hub: HUB_PUB,
      endpoint: "hub.exemplo.org:51820",
      allowed_ips: "10.66.0.0/24",
    });
    expect(r.comandos).toContain(`wg set wg0 peer ${def} allowed-ips 10.66.0.2/32`);
    expect(r.comandos.some((c) => c.includes("remove"))).toBe(false);
    expect(linhas()).toEqual([
      ["entrada", p.ip, p.chave, "entrada"],
      ["pc-joao", "10.66.0.2", def, "ativo"],
    ]);
    expect(ler("wg0.conf")).toContain(`# sabre-entrada: ${p.ip}`);
    expect(ler("wg0.conf")).toContain("# sabre-pc: pc-joao\n[Peer]");
  });

  it("repetir com a mesma chave definitiva devolve o mesmo IP (usar em duas fases)", () => {
    const p = provisorio();
    const def = chaveNova();
    const um = rodar(["entrada-trocar", p.ip, "pc-joao", def]);
    const dois = rodar(["entrada-trocar", p.ip, "pc-joao", def]);
    expect(dois.status).toBe(0);
    expect(dois.json).toEqual(um.json);
    expect(linhas()).toHaveLength(2);
  });

  it("segue a numeração dos PCs já cadastrados pelo adicionar-pc.sh", () => {
    rodar(["adicionar", "pc-eliel", chaveNova()], {}, ADICIONAR_PC);
    const p = provisorio();
    expect(rodar(["entrada-trocar", p.ip, "pc-joao", chaveNova()]).json?.ip_pc).toBe("10.66.0.3");
  });

  it("exige o provisório em estado `entrada` (IP livre, removido ou de PC definitivo = 1, nada muda)", () => {
    const p = provisorio();
    rodar(["entrada-remover", p.ip]);
    const antes = fotografia();
    expect(rodar(["entrada-trocar", p.ip, "pc-joao", chaveNova()]).status).toBe(1);
    expect(rodar(["entrada-trocar", "10.66.0.230", "pc-joao", chaveNova()]).status).toBe(1);
    expect(fotografia()).toEqual(antes);
  });

  it("recusa a chave provisória como definitiva (a privada dela viajou no convite)", () => {
    const p = provisorio();
    const antes = fotografia();
    const r = rodar(["entrada-trocar", p.ip, "pc-joao", p.chave]);
    expect(r.status).toBe(1);
    expect(fotografia()).toEqual(antes);
  });

  it("nome já usado por outro PC com outra chave = 1, nada muda", () => {
    rodar(["adicionar", "pc-joao", chaveNova()], {}, ADICIONAR_PC);
    const p = provisorio();
    const antes = fotografia();
    expect(rodar(["entrada-trocar", p.ip, "pc-joao", chaveNova()]).status).toBe(1);
    expect(fotografia()).toEqual(antes);
  });

  it("sem endpoint do hub = 1, nada muda", () => {
    const p = provisorio();
    const antes = fotografia();
    expect(
      rodar(["entrada-trocar", p.ip, "pc-joao", chaveNova()], { SABRE_ENDPOINT_HUB: "" }).status,
    ).toBe(1);
    expect(fotografia()).toEqual(antes);
  });
});

describe("ajudante-entrada.sh: entrada-remover", () => {
  it("tira o peer provisório do wg0, do wg0.conf e do registro", () => {
    const p = provisorio();
    const r = rodar(["entrada-remover", p.ip]);
    expect(r.status).toBe(0);
    expect(r.comandos).toContain(`wg set wg0 peer ${p.chave} remove`);
    expect(ler("wg0.conf")).not.toContain("[Peer]");
    expect(linhas()).toEqual([]);
  });

  it("depois da troca, tira só o provisório: o definitivo fica", () => {
    const p = provisorio();
    const def = chaveNova();
    rodar(["entrada-trocar", p.ip, "pc-joao", def]);
    expect(rodar(["entrada-remover", p.ip]).status).toBe(0);
    expect(linhas()).toEqual([["pc-joao", "10.66.0.2", def, "ativo"]]);
    expect(ler("wg0.conf")).toContain(`PublicKey = ${def}`);
    expect(ler("wg0.conf")).not.toContain(p.chave);
  });

  it("sem peer = código 0 e nada muda (idempotente)", () => {
    const p = provisorio();
    rodar(["entrada-remover", p.ip]);
    const antes = fotografia();
    const r = rodar(["entrada-remover", p.ip]);
    expect(r.status).toBe(0);
    expect(r.comandos).toEqual([]);
    expect(fotografia()).toEqual(antes);
  });

  it("só aceita 200–254: IP de PC definitivo = 1 e o PC continua", () => {
    const k = chaveNova();
    rodar(["adicionar", "pc-eliel", k], {}, ADICIONAR_PC);
    const antes = fotografia();
    const r = rodar(["entrada-remover", "10.66.0.2"]);
    expect(r.status).toBe(1);
    expect(r.comandos).toEqual([]);
    expect(fotografia()).toEqual(antes);
  });

  it("IP 200–254 que não está em estado `entrada` (registro antigo) = 1, nada muda", () => {
    const k = chaveNova();
    provisorio();
    writeFileSync(join(estado, "pcs.tsv"), `pc-velho\t10.66.0.210\t${k}\tativo\n`, { mode: 0o600 });
    const antes = fotografia();
    expect(rodar(["entrada-remover", "10.66.0.210"]).status).toBe(1);
    expect(fotografia()).toEqual(antes);
  });
});

describe("ajudante-entrada.sh: recusa o que está fora do contrato", () => {
  it("comando fora da lista ou contagem errada de argumentos = 2, sem criar arquivo", () => {
    const k = chaveNova();
    for (const args of [
      [],
      ["adicionar", "pc-x", k],
      ["remover", "pc-x"],
      ["entrada-adicionar"],
      ["entrada-adicionar", k, "extra"],
      ["entrada-trocar", "10.66.0.200", "pc-x"],
      ["entrada-remover"],
      ["entrada-remover", "10.66.0.200", "extra"],
      ["--help"],
    ]) {
      const r = rodar(args);
      expect(r.status, args.join(" ")).toBe(2);
      expect(r.comandos, args.join(" ")).toEqual([]);
    }
    expect(existsSync(join(estado, "pcs.tsv"))).toBe(false);
    expect(existsSync(join(estado, "pcs.tsv.lock"))).toBe(false);
  });

  it("argumento torto = 1, antes do lock e sem mudar nada", () => {
    const p = provisorio();
    const antes = fotografia();
    const k = chaveNova();
    for (const args of [
      ["entrada-adicionar", "nao-e-chave"],
      ["entrada-adicionar", k.slice(0, 43) + "B"],
      ["entrada-adicionar", `${k}\n`],
      ["entrada-remover", "10.66.0.199"],
      ["entrada-remover", "10.66.0.255"],
      ["entrada-remover", "10.66.0.0200"],
      ["entrada-remover", "10.66.1.200"],
      ["entrada-remover", "10.66.0.200/32"],
      ["entrada-remover", "../../etc/passwd"],
      ["entrada-trocar", "10.66.0.199", "pc-x", k],
      ["entrada-trocar", p.ip, "PC X", k],
      ["entrada-trocar", p.ip, "-pc", k],
      ["entrada-trocar", p.ip, "pc-x", "torta"],
    ]) {
      const r = rodar(args);
      expect(r.status, JSON.stringify(args)).toBe(1);
      expect(r.stderr, JSON.stringify(args)).toMatch(/^ERRO: /);
      expect(r.comandos, JSON.stringify(args)).toEqual([]);
    }
    expect(fotografia()).toEqual(antes);
  });

  it("não usa simulação nem caminhos de fora quando chamado pelo sudo (variáveis de simulação ignoradas)", () => {
    const src = readFileSync(AJUDANTE, "utf8");
    expect(src).toMatch(/SUDO_USER/);
    expect(src).toMatch(/unset .*SABRE_SIMULAR/);
  });
});

describe("adicionar-pc.sh convive com a sala de entrada", () => {
  it("não aceita chave de um provisório", () => {
    const p = provisorio();
    const antes = fotografia();
    expect(rodar(["adicionar", "pc-x", p.chave], {}, ADICIONAR_PC).status).toBe(1);
    expect(fotografia()).toEqual(antes);
  });

  it("remover um PC não mexe nos provisórios", () => {
    rodar(["adicionar", "pc-eliel", chaveNova()], {}, ADICIONAR_PC);
    const p = provisorio();
    rodar(["remover", "pc-eliel"], {}, ADICIONAR_PC);
    expect(ler("wg0.conf")).toContain(`# sabre-entrada: ${p.ip}`);
    expect(linhas().some((l) => l[3] === "entrada")).toBe(true);
  });
});
