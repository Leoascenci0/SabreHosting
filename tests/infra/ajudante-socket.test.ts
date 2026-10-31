import { spawn, spawnSync } from "node:child_process";
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const WRAPPER = resolve(import.meta.dirname, "../../infra/vps/wg/ajudante-socket.sh");
const HUB_PUB = Buffer.alloc(32, 7).toString("base64");

let estado: string;
beforeEach(() => {
  estado = mkdtempSync(join(tmpdir(), "sabre-socket-"));
});
afterEach(() => {
  rmSync(estado, { recursive: true, force: true });
});

const chaveNova = () => randomBytes(32).toString("base64");

/** O systemd liga a conexão no stdin/stdout do wrapper; aqui o pedido vai direto no stdin. */
function pedir(linha: string, extra: Record<string, string> = {}, wrapper = WRAPPER) {
  const r = spawnSync("bash", [wrapper], {
    input: linha,
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
  const saida = r.stdout.split("\n").filter(Boolean);
  return { ...r, saida, json: JSON.parse(saida[0] ?? "null") as Record<string, unknown> | null };
}
const json = (comando: string, args: unknown[]) => `${JSON.stringify({ comando, args })}\n`;

const ler = (f: string) =>
  existsSync(join(estado, f)) ? readFileSync(join(estado, f), "utf8") : "<sem arquivo>";
const fotografia = () => ({ conf: ler("wg0.conf"), registro: ler("pcs.tsv") });

describe("ajudante-socket.sh: pedido de uma linha JSON", () => {
  it("adicionar → trocar → remover devolvem uma linha JSON cada", () => {
    const prov = chaveNova();
    const a = pedir(json("entrada-adicionar", [prov]));
    expect(a.status, a.stderr).toBe(0);
    expect(a.saida).toEqual(['{"ip":"10.66.0.200"}']);

    const def = chaveNova();
    const t = pedir(json("entrada-trocar", ["10.66.0.200", "pc-da-ana", def]));
    expect(t.saida).toHaveLength(1);
    expect(t.json).toEqual({
      ip_pc: "10.66.0.2",
      chave_publica_hub: HUB_PUB,
      endpoint: "hub.exemplo.org:51820",
      allowed_ips: "10.66.0.0/24",
    });

    const r = pedir(json("entrada-remover", ["10.66.0.200"]));
    expect(r.saida).toEqual(['{"ok":true}']);
    expect(ler("pcs.tsv")).not.toMatch(/\tentrada\n/);
    // Sem peer: também ok (o ajudante não faz nada).
    expect(pedir(json("entrada-remover", ["10.66.0.201"])).saida).toEqual(['{"ok":true}']);
  });

  it("ajudante recusou → código 1 com a linha ERRO do ajudante, nada muda", () => {
    const antes = fotografia();
    const r = pedir(json("entrada-adicionar", ["chave-torta"]));
    expect(r.saida).toHaveLength(1);
    expect(r.json?.["codigo"]).toBe(1);
    expect(String(r.json?.["erro"])).toMatch(/^ERRO: chave pública inválida/);
    expect(fotografia()).toEqual(antes);
  });

  it("pedido torto → código 2, o ajudante nem é chamado e nada muda", () => {
    const k = chaveNova();
    pedir(json("entrada-adicionar", [k]));
    const antes = fotografia();
    for (const linha of [
      "",
      "\n",
      "isso não é json\n",
      '{"comando":"entrada-adicionar","args":["' + k + '"]', // sem o fim
      '{"comando":"entrada-adicionar","args":["' + k + '"]}', // sem \n
      ' {"comando":"entrada-adicionar","args":["' + k + '"]}\n',
      '{"args":["' + k + '"],"comando":"entrada-adicionar"}\n',
      json("adicionar", ["pc", k]),
      json("entrada-listar", []),
      json("entrada-adicionar", []),
      json("entrada-adicionar", [k, k]),
      json("entrada-trocar", ["10.66.0.200", "pc"]),
      json("entrada-remover", ["10.66.0.200", "x"]),
      json("entrada-adicionar", [`${k} x`]),
      json("entrada-adicionar", [`${k}"`]),
      json("entrada-adicionar", ["$(id)"]),
      json("entrada-adicionar", ["a;b"]),
      json("entrada-adicionar", ["a\\b"]),
      json("entrada-adicionar", [1]),
      json("entrada-adicionar", [""]),
      json("entrada-trocar", ["10.66.0.200", "pc x", k]),
      json("entrada-trocar", ["10.66.0.200", "pc'x", k]),
      json("entrada-adicionar", ["a".repeat(65)]),
      `${json("entrada-adicionar", [k]).trim()}\n${json("entrada-remover", ["10.66.0.200"])}`,
      `${"x".repeat(5000)}\n`,
    ]) {
      const r = pedir(linha);
      expect(r.status, JSON.stringify(linha)).toBe(0);
      expect(r.saida, JSON.stringify(linha)).toEqual(['{"codigo":2,"erro":"pedido recusado"}']);
    }
    expect(fotografia()).toEqual(antes);
  });

  // Sem simulação, o ajudante iria à máquina de verdade: só roda onde não há WireGuard de verdade.
  it.skipIf(existsSync("/etc/wireguard/wg0.conf"))(
    "sob o systemd (INVOCATION_ID), limpa as variáveis de simulação e o resto do ambiente do chamador",
    () => {
      const espiao = join(estado, "bash-env.sh");
      // BASH_ENV roda em todo bash não interativo: anota qual script o carregou.
      const anotado = join(estado, "quem-leu-BASH_ENV");
      writeFileSync(espiao, `echo "$0" >> ${JSON.stringify(anotado)}\n`);
      const r = pedir(json("entrada-adicionar", [chaveNova()]), {
        INVOCATION_ID: "teste",
        BASH_ENV: espiao,
      });
      expect(r.json?.["codigo"]).toBe(1);
      // Não-root: "rode como administrador"; root sem WireGuard: "não achei /etc/wireguard/wg0.conf".
      expect(String(r.json?.["erro"])).toMatch(/administrador|não achei \/etc\/wireguard/);
      // Só o próprio wrapper (iniciado aqui com o BASH_ENV) leu; o ajudante, não. E nada da simulação foi gravado.
      expect(readFileSync(anotado, "utf8")).not.toMatch(/ajudante-entrada/);
      expect(readdirSync(estado).sort()).toEqual(["bash-env.sh", "quem-leu-BASH_ENV"]);
    },
  );

  it("erro com aspas e barra vira JSON válido", () => {
    pedir(json("entrada-adicionar", [chaveNova()]));
    const ja = chaveNova();
    expect(pedir(json("entrada-trocar", ["10.66.0.200", "pc-a", ja])).json).toHaveProperty("ip_pc");
    // O mesmo nome com outra chave: a mensagem do ajudante tem aspas simples ('pc-a').
    pedir(json("entrada-adicionar", [chaveNova()]));
    const r = pedir(json("entrada-trocar", ["10.66.0.201", "pc-a", chaveNova()]));
    expect(r.json?.["codigo"]).toBe(1);
    expect(String(r.json?.["erro"])).toMatch(/'pc-a' já existe/);
  });

  describe("com um ajudante falso ao lado do wrapper", () => {
    /** Cópia do wrapper numa pasta com um `ajudante-entrada.sh` falso, que anota cada chamada. */
    function comFalso(corpo: string) {
      const pastaFalsa = mkdtempSync(join(estado, "falso-"));
      const wrapper = join(pastaFalsa, "ajudante-socket.sh");
      copyFileSync(WRAPPER, wrapper);
      const chamadas = join(pastaFalsa, "chamadas");
      writeFileSync(
        join(pastaFalsa, "ajudante-entrada.sh"),
        `echo "$*" >> ${JSON.stringify(chamadas)}\n${corpo}\n`,
      );
      return {
        wrapper,
        chamadas: () => (existsSync(chamadas) ? readFileSync(chamadas, "utf8") : ""),
      };
    }

    it("erro sem linha 'ERRO:' (ex.: eco '+ wg set …') nunca volta; vira 'ERRO: falha interna do ajudante'", () => {
      const k = chaveNova();
      const f = comFalso(
        `echo "+ wg set wg0 peer ${k} allowed-ips 10.66.0.200/32" >&2\necho "outra linha" >&2\nexit 1`,
      );
      const r = pedir(json("entrada-adicionar", [k]), {}, f.wrapper);
      expect(f.chamadas()).toBe(`entrada-adicionar ${k}\n`);
      expect(r.saida).toEqual(['{"codigo":1,"erro":"ERRO: falha interna do ajudante"}']);
      expect(r.stdout).not.toContain("+ wg");
      // Com a linha ERRO no meio do eco, só ela volta.
      const g = comFalso(
        `echo "+ wg set wg0 peer x" >&2\necho "ERRO: chave repetida." >&2\nexit 1`,
      );
      expect(pedir(json("entrada-adicionar", [k]), {}, g.wrapper).saida).toEqual([
        '{"codigo":1,"erro":"ERRO: chave repetida."}',
      ]);
      // Linha que só contém 'ERRO:' no meio não conta.
      const h = comFalso(`echo "+ wg set x # ERRO: falso" >&2\nexit 1`);
      expect(pedir(json("entrada-adicionar", [k]), {}, h.wrapper).json?.["erro"]).toBe(
        "ERRO: falha interna do ajudante",
      );
    });

    it("linha gigante ou 2º pedido na mesma conexão → código 2 sem chamar o ajudante", () => {
      const f = comFalso('echo \'{"ip":"10.66.0.200"}\'');
      const k = chaveNova();
      const valido = json("entrada-adicionar", [k]);
      expect(pedir(valido, {}, f.wrapper).saida).toEqual(['{"ip":"10.66.0.200"}']); // o falso responde
      const chamadasAntes = f.chamadas();
      for (const linha of [
        `${"x".repeat(100_000)}\n`,
        `${valido.trim()}${" ".repeat(2000)}\n`,
        `${valido}${valido}`,
        `${valido}${json("entrada-remover", ["10.66.0.200"])}`,
        `${valido}x`,
      ]) {
        const r = pedir(linha, {}, f.wrapper);
        expect(r.status, linha.slice(0, 80)).toBe(0);
        expect(r.saida, linha.slice(0, 80)).toEqual(['{"codigo":2,"erro":"pedido recusado"}']);
      }
      expect(f.chamadas()).toBe(chamadasAntes);
    });
  });

  it("6 pedidos em paralelo (uma conexão cada) → 6 IPs distintos na sala de entrada", async () => {
    const pedirAssincrono = (linha: string) =>
      new Promise<string>((ok, falha) => {
        const p = spawn("bash", [WRAPPER], {
          env: {
            PATH: process.env.PATH,
            SABRE_SIMULAR: "1",
            SABRE_ESTADO: estado,
            SABRE_ENDPOINT_HUB: "hub.exemplo.org:51820",
            SABRE_CHAVE_PUB_HUB: HUB_PUB,
          },
        });
        let saida = "";
        p.stdout.setEncoding("utf8").on("data", (d: string) => (saida += d));
        p.on("error", falha);
        p.on("close", () => ok(saida.trim()));
        p.stdin.end(linha);
      });
    const respostas = await Promise.all(
      Array.from({ length: 6 }, () => pedirAssincrono(json("entrada-adicionar", [chaveNova()]))),
    );
    const ips = respostas.map((r) => (JSON.parse(r) as { ip?: string }).ip);
    expect(
      ips.every((ip) => /^10\.66\.0\.2\d\d$/.test(ip ?? "")),
      respostas.join(" | "),
    ).toBe(true);
    expect(new Set(ips).size).toBe(6);
    expect(ler("pcs.tsv").match(/\tentrada\n/g)).toHaveLength(6);
  });
});
