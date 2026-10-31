import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { criarCliente } from "../../packages/nucleo/src/cartorio/cliente.js";
import { Renovador } from "../../packages/nucleo/src/cartorio/renovador.js";
import { abrirBanco, criarConvite } from "../../services/cartorio/src/banco.js";
import { criarCartorio } from "../../services/cartorio/src/servidor.js";

const pastas: string[] = [];
const fechar: Array<() => unknown> = [];
afterEach(async () => {
  for (const f of fechar.splice(0)) await f();
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

/**
 * Integração de `/atualizacao` (nota do qa do #182): o cliente REAL do núcleo falando com o cartório REAL, sem rede
 * (o `fetch` entrega o pedido ao `inject`). Prova o contrato que o espalhador usa: pegar, renovar, soltar e a recusa.
 */
async function montar() {
  const pasta = mkdtempSync(join(tmpdir(), "sabre-atualizacao-cliente-"));
  pastas.push(pasta);
  const agora = 1_000_000;
  const app = criarCartorio({
    banco: abrirBanco(join(pasta, "cartorio.db")),
    logger: { level: "silent" },
    agora: () => agora,
  });
  fechar.push(() => app.close());
  const banco = abrirBanco(join(pasta, "cartorio.db"));
  fechar.push(() => banco.close());
  const clienteDe = async (nome: string) => {
    const convite = criarConvite(banco, nome, agora, 30 * 60_000);
    const r = await app.inject({ method: "POST", url: "/convites/usar", payload: { convite } });
    const { token } = r.json<{ token: string }>();
    return criarCliente({
      url: "http://127.0.0.1:8080",
      cofre: { guardar: async () => {}, ler: async () => token },
      tentativas: 1,
      fetchFn: (async (url: string, init: RequestInit) => {
        const resp = await app.inject({
          method: init.method as "GET" | "POST",
          url: new URL(url).pathname,
          headers: init.headers as Record<string, string>,
          ...(init.body ? { payload: String(init.body) } : {}),
        });
        return new Response(resp.body, { status: resp.statusCode });
      }) as typeof fetch,
    });
  };
  return { clienteDe };
}

describe("/atualizacao pelo cliente do núcleo (1.9a)", () => {
  it("pega, renova com a própria época e solta; época de outro momento é recusada", async () => {
    const { clienteDe } = await montar();
    const ana = await clienteDe("Ana");
    const pegou = await ana.pegarAtualizacao();
    expect(pegou.ok).toBe(true);
    if (!pegou.ok) return;
    expect((await ana.renovarAtualizacao(pegou.epoca)).ok).toBe(true);
    expect((await ana.renovarAtualizacao(pegou.epoca + 5)).ok).toBe(false);
    expect((await ana.soltarAtualizacao(pegou.epoca)).ok).toBe(true);
    expect((await ana.renovarAtualizacao(pegou.epoca)).ok).toBe(false); // solta: não renova mais
  });

  it("quem hospeda não atualiza; quem atualiza não pega o host; outro PC atualiza a própria cópia", async () => {
    const { clienteDe } = await montar();
    const host = await clienteDe("Host");
    const ana = await clienteDe("Ana");
    expect((await host.pegar()).ok).toBe(true);
    const doHost = await host.pegarAtualizacao();
    expect(doHost.ok).toBe(false);
    if (!doHost.ok) expect(doHost.motivo).toBe("hospedando");
    // Com o host ligado, a Ana atualiza a cópia dela (a razão de existir da trava de atualização).
    const daAna = await ana.pegarAtualizacao();
    expect(daAna.ok).toBe(true);
    if (daAna.ok) await ana.soltarAtualizacao(daAna.epoca);
  });

  it("o Renovador do espalhar usa o cartório de verdade; atualizando, o PC não pega o host", async () => {
    const { clienteDe } = await montar();
    const ana = await clienteDe("Ana");
    const r = new Renovador({
      cliente: {
        pegar: () => ana.pegarAtualizacao(),
        renovar: (e, s) => ana.renovarAtualizacao(e, s),
        soltar: (e) => ana.soltarAtualizacao(e),
      },
      aoPerder: () => undefined,
      trava: "atualização",
    });
    await r.pegar();
    expect(await r.renovarAgora()).toBe(true);
    expect((await ana.pegar()).ok).toBe(false);
    await r.soltar();
    expect((await ana.pegar()).ok).toBe(true);
  });
});
