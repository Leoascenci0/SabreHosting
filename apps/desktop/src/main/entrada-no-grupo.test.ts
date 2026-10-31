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

function montar(resposta: () => Response) {
  const passos: string[] = [];
  const configs: string[] = [];
  const entrar = criarEntradaNoGrupo({
    pastaRede: "x",
    aplicar: async (cfg) => (passos.push("instalar"), void configs.push(cfg)),
    execElevado: async (_e, args) => (passos.push(String(args[0])), ""),
    fetchFn: (async () => (passos.push("usar"), resposta())) as typeof fetch,
  });
  return { entrar, passos, configs };
}

describe("entrada no grupo (passo elevado)", () => {
  it("instala a provisória, usa o convite, troca pela definitiva com a chave própria", async () => {
    const { entrar, passos, configs } = montar(
      () =>
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
        ),
    );
    expect(await entrar(convite, proprias)).toEqual({ token: "tk" });
    expect(passos).toEqual(["instalar", "usar", "/uninstalltunnelservice", "instalar"]);
    expect(configs[0]).toContain(prov.privada);
    expect(configs[1]).toContain(proprias.privada);
    expect(configs[1]).not.toContain(prov.privada);
  });

  it("cartório recusa (convite usado): a chave própria nunca é instalada", async () => {
    const { entrar, passos, configs } = montar(
      () => new Response(JSON.stringify({ erro: "x" }), { status: 401 }),
    );
    await expect(entrar(convite, proprias)).rejects.toMatchObject({ tipo: "acesso" });
    expect(passos).toEqual(["instalar", "usar"]);
    expect(configs.join()).not.toContain(proprias.privada);
  });
});
