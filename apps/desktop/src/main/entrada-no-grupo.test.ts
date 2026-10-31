import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lerConvite } from "@sabrehosting/nucleo/rede/convite";
import { gerarChavesDoPc } from "@sabrehosting/nucleo/rede/wireguard";
import { criarEntradaNoGrupo, scriptElevado } from "./entrada-no-grupo.js";

const prov = gerarChavesDoPc();
const hub = gerarChavesDoPc();
const proprias = gerarChavesDoPc();
const json = {
  g: "Grupo",
  h: "nuvem.exemplo.org:51820",
  k: hub.publica,
  i: "10.66.0.201",
  p: prov.privada,
  c: "cod",
  a: 7710,
  e: 4_000_000_000,
};
const r = lerConvite(
  `sabre://convite/1.${Buffer.from(JSON.stringify(json)).toString("base64url")}`,
  1,
);
if (!r.ok) throw new Error("fixture");
const convite = r.convite;

let pasta: string;
beforeEach(() => void (pasta = mkdtempSync(join(tmpdir(), "sabre-rede-"))));
afterEach(() => rmSync(pasta, { recursive: true, force: true }));
const lerSe = (n: string): string | undefined =>
  existsSync(join(pasta, n)) ? readFileSync(join(pasta, n), "utf8") : undefined;
const espera = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Faz o papel do script elevado: o que ele faria no Windows, só com arquivos (a prova real é [P]). */
function montar(
  resposta: () => Response,
  falha: { instalarProvisoria?: boolean; instalarDefinitiva?: boolean; uac?: boolean } = {},
) {
  const passos: string[] = [];
  const configs: string[] = [];
  const chamadas: Array<{ exe: string; args: readonly string[] }> = [];
  const entrar = criarEntradaNoGrupo({
    pastaRede: pasta,
    plataforma: "win32",
    usuario: "teste",
    exec: async () => "",
    passoMs: 5,
    prazoMs: 2000,
    execElevado: async (exe, args) => {
      chamadas.push({ exe, args });
      if (falha.uac) throw new Error("UAC negado");
      if (falha.instalarProvisoria) throw new Error("instalar falhou");
      configs.push(lerSe("sabre.conf") ?? "");
      passos.push("instalar");
      rmSync(join(pasta, "sabre.conf"));
      writeFileSync(join(pasta, "instalada.flag"), "");
      for (let i = 0; i < 400; i++) {
        if (existsSync(join(pasta, "troca.go"))) {
          passos.push("desinstalar");
          if (falha.instalarDefinitiva) throw new Error("instalar definitiva falhou");
          configs.push(lerSe("sabre.conf") ?? "");
          passos.push("instalar");
          return "";
        }
        if (existsSync(join(pasta, "cancelar.flag"))) {
          passos.push("desinstalar");
          throw new Error("saiu com 2");
        }
        await espera(5);
      }
      throw new Error("sem sinal");
    },
    fetchFn: (async () => (passos.push("usar"), resposta())) as typeof fetch,
  });
  return { entrar, passos, configs, chamadas };
}

const OK = () =>
  new Response(
    JSON.stringify({
      token: "tk",
      pacote: {
        ip_pc: "10.66.0.7",
        chave_publica_hub: hub.publica,
        endpoint: "nuvem.exemplo.org:51820",
        allowed_ips: "10.66.0.0/24",
      },
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );
const RECUSA = () => new Response(JSON.stringify({ erro: "x" }), { status: 401 });

describe("entrada no grupo (passo elevado)", () => {
  it("UM só pedido de administrador: instala a provisória, usa o convite, guarda o token ANTES de trocar, instala a definitiva", async () => {
    const { entrar, passos, configs, chamadas } = montar(OK);
    const guardados: string[] = [];
    const guardar = async (t: string) => {
      passos.push("guardar");
      guardados.push(t);
    };
    expect(await entrar(convite, proprias, guardar)).toEqual({ token: "tk" });
    expect(chamadas).toHaveLength(1); // regressão: eram 3 pedidos (3 UAC)
    expect(passos).toEqual(["instalar", "usar", "guardar", "desinstalar", "instalar"]);
    expect(guardados).toEqual(["tk"]);
    expect(configs[0]).toContain(prov.privada);
    expect(configs[1]).toContain(proprias.privada);
    expect(configs[1]).not.toContain(prov.privada);
    expect(readdirSync(pasta)).toEqual([]); // nenhuma chave em texto sobra na pasta
  });

  it("o comando elevado é texto fixo: sem caminho, sem chave, sem token", async () => {
    const { entrar, chamadas } = montar(OK);
    await entrar(convite, proprias, async () => {});
    const c = chamadas[0] as (typeof chamadas)[number];
    expect(c.exe).toBe("powershell.exe");
    expect(c.args.slice(0, 3)).toEqual(["-NoProfile", "-NonInteractive", "-EncodedCommand"]);
    const texto = Buffer.from(c.args[3] ?? "", "base64").toString("utf16le");
    expect(texto).toBe(scriptElevado({ pasta, espera: 150 }));
    for (const segredo of [pasta, prov.privada, proprias.privada, "tk"])
      expect(texto).not.toContain(segredo);
  });

  it("cartório recusa (convite usado): cancela, desinstala a provisória, devolve o erro original e nunca grava a chave própria", async () => {
    const { entrar, passos, configs, chamadas } = montar(RECUSA);
    const guardados: string[] = [];
    await expect(
      entrar(convite, proprias, async (t) => void guardados.push(t)),
    ).rejects.toMatchObject({ tipo: "acesso" });
    expect(chamadas).toHaveLength(1);
    expect(passos).toEqual(["instalar", "usar", "desinstalar"]);
    expect(configs.join()).not.toContain(proprias.privada);
    expect(guardados).toEqual([]);
    expect(readdirSync(pasta)).toEqual([]);
  });

  it("administrador negado (ou WireGuard ausente): nada é usado nem guardado e a mensagem manda checar a permissão", async () => {
    for (const falha of [{ uac: true }, { instalarProvisoria: true }]) {
      const { entrar, passos } = montar(OK, falha);
      const guardados: string[] = [];
      const erro = (await entrar(convite, proprias, async (t) => void guardados.push(t)).catch(
        (e: unknown) => e,
      )) as Error;
      expect(erro.message).toContain("permissão de administrador");
      expect(passos).not.toContain("usar");
      expect(guardados).toEqual([]);
      expect(readdirSync(pasta)).toEqual([]);
    }
  });

  it("falha ao instalar a definitiva depois do convite gasto: token já está no cofre e o erro manda pedir convite novo", async () => {
    const { entrar } = montar(OK, { instalarDefinitiva: true });
    const guardados: string[] = [];
    const erro = await entrar(convite, proprias, async (t) => void guardados.push(t)).catch(
      (e: unknown) => e,
    );
    expect(erro).toMatchObject({ conviteGasto: true });
    expect((erro as Error).message).toContain("convite novo");
    expect((erro as Error).message).not.toContain("tk");
    expect(guardados).toEqual(["tk"]);
  });

  it("cofre falha ao guardar o token: a definitiva nunca é gravada, o passo elevado é cancelado e o erro manda pedir convite novo", async () => {
    const { entrar, passos, configs } = montar(OK);
    const erro = await entrar(convite, proprias, async () => {
      throw new Error("sem cofre");
    }).catch((e: unknown) => e);
    expect(erro).toMatchObject({ conviteGasto: true });
    expect(passos).toEqual(["instalar", "usar", "desinstalar"]);
    expect(configs.join()).not.toContain(proprias.privada);
  });

  it("falha ao esperar a instalação: só termina depois de o script desinstalar a provisória (appmel-1.16)", async () => {
    const passos: string[] = [];
    const entrar = criarEntradaNoGrupo({
      pastaRede: pasta,
      plataforma: "win32",
      usuario: "teste",
      exec: async () => "",
      passoMs: 5,
      prazoMs: 40, // a instalação "nunca fica pronta": esperarPronta estoura
      execElevado: async () => {
        for (let i = 0; i < 400; i++) {
          if (existsSync(join(pasta, "cancelar.flag"))) {
            await espera(80); // o script leva um tempo para desinstalar o túnel
            passos.push("desinstalada");
            throw new Error("saiu com 2");
          }
          await espera(5);
        }
        throw new Error("sem sinal");
      },
      fetchFn: (async () => new Response("{}")) as typeof fetch,
    });
    await expect(entrar(convite, proprias, async () => {})).rejects.toThrow();
    expect(passos).toEqual(["desinstalada"]); // falhava: o erro saía antes da desinstalação
  });

  it("fora do Windows: recusa sem tocar em nada", async () => {
    const entrar = criarEntradaNoGrupo({ pastaRede: pasta, plataforma: "linux" });
    await expect(entrar(convite, proprias, async () => {})).rejects.toThrow(
      "só pode ser instalada",
    );
  });
});
