import { describe, expect, it } from "vitest";
import { lerConvite } from "@sabrehosting/nucleo/rede/convite";
import { gerarChavesDoPc } from "@sabrehosting/nucleo/rede/wireguard";
import { criarEntradaNoGrupo } from "./entrada-no-grupo.js";

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

function montar(
  resposta: () => Response,
  falha: { aplicarNaVez?: number; desinstalar?: boolean } = {},
) {
  const passos: string[] = [];
  const configs: string[] = [];
  let instalacoes = 0;
  const entrar = criarEntradaNoGrupo({
    pastaRede: "x",
    aplicar: async (cfg) => {
      instalacoes++;
      if (falha.aplicarNaVez === instalacoes) throw new Error("instalar falhou");
      passos.push("instalar");
      configs.push(cfg);
    },
    execElevado: async (_e, args) => {
      passos.push(String(args[0]));
      if (falha.desinstalar) throw new Error("desinstalar falhou");
      return "";
    },
    fetchFn: (async () => (passos.push("usar"), resposta())) as typeof fetch,
  });
  return { entrar, passos, configs };
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
  it("instala a provisória, usa o convite, guarda o token ANTES de trocar, instala a definitiva", async () => {
    const { entrar, passos, configs } = montar(OK);
    const guardados: string[] = [];
    const guardar = async (t: string) => {
      passos.push("guardar");
      guardados.push(t);
    };
    expect(await entrar(convite, proprias, guardar)).toEqual({ token: "tk" });
    expect(passos).toEqual(["instalar", "usar", "guardar", "/uninstalltunnelservice", "instalar"]);
    expect(guardados).toEqual(["tk"]);
    expect(configs[0]).toContain(prov.privada);
    expect(configs[1]).toContain(proprias.privada);
    expect(configs[1]).not.toContain(prov.privada);
  });

  it("cartório recusa (convite usado): desinstala a provisória, devolve o erro original e nunca instala a chave própria", async () => {
    const { entrar, passos, configs } = montar(RECUSA);
    const guardados: string[] = [];
    await expect(
      entrar(convite, proprias, async (t) => void guardados.push(t)),
    ).rejects.toMatchObject({ tipo: "acesso" });
    expect(passos).toEqual(["instalar", "usar", "/uninstalltunnelservice"]);
    expect(configs.join()).not.toContain(proprias.privada);
    expect(guardados).toEqual([]);
  });

  it("cartório recusa e a desinstalação também falha: o erro que sobe continua o do cartório", async () => {
    const { entrar } = montar(RECUSA, { desinstalar: true });
    await expect(entrar(convite, proprias, async () => {})).rejects.toMatchObject({
      tipo: "acesso",
    });
  });

  it("falha ao instalar a provisória: nada é usado nem guardado", async () => {
    const { entrar, passos } = montar(OK, { aplicarNaVez: 1 });
    const guardados: string[] = [];
    await expect(entrar(convite, proprias, async (t) => void guardados.push(t))).rejects.toThrow(
      "instalar falhou",
    );
    expect(passos).not.toContain("usar");
    expect(guardados).toEqual([]);
  });

  it.each([
    ["desinstalar a provisória", { desinstalar: true }],
    ["instalar a definitiva", { aplicarNaVez: 2 }],
  ])(
    "falha ao %s depois do convite gasto: token já está no cofre e o erro manda pedir convite novo",
    async (_n, falha) => {
      const { entrar } = montar(OK, falha);
      const guardados: string[] = [];
      const erro = await entrar(convite, proprias, async (t) => void guardados.push(t)).catch(
        (e: unknown) => e,
      );
      expect(erro).toMatchObject({ conviteGasto: true });
      expect((erro as Error).message).toContain("convite novo");
      expect((erro as Error).message).not.toContain("tk");
      expect(guardados).toEqual(["tk"]);
    },
  );

  it("cofre falha ao guardar o token: nada elevado acontece depois e o erro manda pedir convite novo", async () => {
    const { entrar, passos } = montar(OK);
    const erro = await entrar(convite, proprias, async () => {
      throw new Error("sem cofre");
    }).catch((e: unknown) => e);
    expect(erro).toMatchObject({ conviteGasto: true });
    expect(passos).toEqual(["instalar", "usar"]);
  });
});
