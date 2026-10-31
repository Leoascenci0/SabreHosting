import { existsSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gerarChavesDoPc } from "@sabrehosting/nucleo/rede/wireguard";
import { criarBoasVindas, type DepsBoasVindas } from "./boas-vindas.js";

const AGORA = 1_800_000_000_000;
let dados: string;
let base: string;
beforeEach(() => {
  dados = mkdtempSync(join(tmpdir(), "sabre-bv-dados-"));
  base = mkdtempSync(join(tmpdir(), "sabre-bv-base-"));
});
afterEach(() => {
  rmSync(dados, { recursive: true, force: true });
  rmSync(base, { recursive: true, force: true });
});

const provisoria = gerarChavesDoPc();
const hub = gerarChavesDoPc();
function texto(extra: Record<string, unknown> = {}): string {
  const json = {
    g: "Amigos do Eliel",
    h: "nuvem.exemplo.org:51820",
    k: hub.publica,
    i: "10.66.0.201",
    p: provisoria.privada,
    c: "codigo-secreto-do-convite",
    a: 7710,
    e: AGORA / 1000 + 3600,
    ...extra,
  };
  return `sabre://convite/1.${Buffer.from(JSON.stringify(json)).toString("base64url")}`;
}

function montar(extra: Partial<DepsBoasVindas> = {}) {
  const chamadas: string[] = [];
  const guardados: string[] = [];
  const deps: DepsBoasVindas = {
    dados,
    agora: () => AGORA,
    gerarChaves: () => (chamadas.push("chaves"), gerarChavesDoPc()),
    cofreDisponivel: () => true,
    cofre: { guardar: async (t) => void guardados.push(t), ler: async () => guardados[0] },
    entrar: async () => (chamadas.push("entrar"), { token: "token-do-pc" }),
    lerGrupo: async () => ({ nome: "Amigos do Eliel", endereco_jogar: "jogar.exemplo.org:25565" }),
    pastaPadrao: () => base,
    ...extra,
  };
  return { bv: criarBoasVindas(deps), chamadas, guardados };
}

describe("boas-vindas (main)", () => {
  it("só abre se o PC ainda não foi configurado", async () => {
    const { bv } = montar();
    expect(await bv.estado()).toMatchObject({ aberto: true, passo: "convite" });
    await bv.conferirConvite(texto());
    await bv.entrar();
    await bv.aceitarEula(true);
    expect((await bv.concluir(base)).ok).toBe(true);
    expect(await montar().bv.estado()).toEqual({ aberto: false });
  });

  it.each([
    ["torto", "isto não é um convite", "não está certo"],
    ["vencido", texto({ e: AGORA / 1000 - 1 }), "venceu"],
  ])("convite %s: mensagem clara e nada muda", async (_n, entrada, parte) => {
    const { bv, chamadas, guardados } = montar();
    const r = await bv.conferirConvite(entrada);
    expect(r.ok).toBe(false);
    expect(!r.ok && r.mensagem).toContain(parte);
    expect((await bv.entrar()).ok).toBe(false);
    expect(chamadas).toEqual([]);
    expect(guardados).toEqual([]);
  });

  it("convite que venceu entre conferir e entrar não é usado", async () => {
    let agora = AGORA;
    const { bv, chamadas } = montar({ agora: () => agora });
    expect((await bv.conferirConvite(texto())).ok).toBe(true);
    agora += 2 * 3600_000;
    const r = await bv.entrar();
    expect(!r.ok && r.mensagem).toContain("venceu");
    expect(chamadas).toEqual([]);
  });

  it("convite já usado (401 do cartório): mensagem clara, token não guardado", async () => {
    const { bv, guardados } = montar({
      entrar: async () => {
        throw Object.assign(new Error("Cartório recusou (401)"), { tipo: "acesso" });
      },
    });
    await bv.conferirConvite(texto());
    const r = await bv.entrar();
    expect(!r.ok && r.mensagem).toContain("já foi usado");
    expect(guardados).toEqual([]);
    expect((await bv.estado()).aberto && (await bv.estado())).toMatchObject({ passo: "convite" });
  });

  it("sem cofre seguro: nem gasta o convite nem guarda o token", async () => {
    const { bv, chamadas, guardados } = montar({ cofreDisponivel: () => false });
    await bv.conferirConvite(texto());
    const r = await bv.entrar();
    expect(!r.ok && r.mensagem).toContain("cofre");
    expect(chamadas).toEqual([]);
    expect(guardados).toEqual([]);
  });

  it("entra: guarda o token no cofre, mostra o grupo e vai para o EULA; a janela não recebe segredo", async () => {
    const { bv, guardados } = montar();
    const conferido = await bv.conferirConvite(texto());
    expect(JSON.stringify(conferido)).not.toContain("codigo-secreto");
    expect(JSON.stringify(conferido)).not.toContain(provisoria.privada);
    const r = await bv.entrar();
    expect(r).toEqual({ ok: true, grupo: "Amigos do Eliel", endereco: "jogar.exemplo.org:25565" });
    expect(guardados).toEqual(["token-do-pc"]);
    expect(await bv.estado()).toMatchObject({ aberto: true, passo: "eula" });
  });

  it("erro no passo elevado nunca repete o texto do convite nem as chaves", async () => {
    const { bv } = montar({
      entrar: async (c, chaves) => {
        throw new Error(`falhou com ${c.codigo} e ${c.chavePrivadaProvisoria} e ${chaves.privada}`);
      },
    });
    await bv.conferirConvite(texto());
    const r = await bv.entrar();
    expect(r.ok).toBe(false);
    const msg = !r.ok ? r.mensagem : "";
    expect(msg).not.toContain("codigo-secreto");
    expect(msg).not.toContain(provisoria.privada);
  });

  it("quem já entrou e fechou o app volta no EULA (o convite usado não é pedido de novo)", async () => {
    const primeira = montar();
    await primeira.bv.conferirConvite(texto());
    await primeira.bv.entrar();
    expect(await montar().bv.estado()).toMatchObject({
      aberto: true,
      passo: "eula",
      grupo: { nome: "Amigos do Eliel" },
    });
  });

  it("sem aceite do EULA não conclui e não cria nada", async () => {
    const { bv } = montar();
    await bv.conferirConvite(texto());
    await bv.entrar();
    expect((await bv.concluir(base)).ok).toBe(false);
    expect((await bv.aceitarEula(false)).ok).toBe(false);
    expect((await bv.concluir(base)).ok).toBe(false);
    expect(existsSync(join(base, "servidor"))).toBe(false);
    expect(await bv.estado()).toMatchObject({ aberto: true });
  });

  it("pasta relativa ou raiz do disco é recusada", async () => {
    const { bv } = montar();
    await bv.conferirConvite(texto());
    await bv.entrar();
    await bv.aceitarEula(true);
    expect((await bv.concluir("pasta/relativa")).ok).toBe(false);
    expect((await bv.concluir("/")).ok).toBe(false);
    expect((await bv.concluir(42)).ok).toBe(false);
    expect((await bv.estado()).aberto).toBe(true);
  });

  it("conclui: cria servidor\\ e mundos\\, grava eula=true só com aceite e guarda a pasta", async () => {
    const { bv } = montar();
    await bv.conferirConvite(texto());
    await bv.entrar();
    await bv.aceitarEula(true);
    expect(await bv.concluir(base)).toEqual({ ok: true });
    expect(readFileSync(join(base, "servidor", "eula.txt"), "utf8")).toContain("eula=true");
    expect(existsSync(join(base, "mundos"))).toBe(true);
    expect(JSON.parse(readFileSync(join(dados, "boas-vindas.json"), "utf8"))).toMatchObject({
      concluido: true,
      pastaBase: base,
    });
  });

  it("o arquivo de estado nunca guarda token, convite nem chave", async () => {
    const { bv } = montar();
    await bv.conferirConvite(texto());
    await bv.entrar();
    const conteudo = readFileSync(join(dados, "boas-vindas.json"), "utf8");
    for (const segredo of ["token-do-pc", "codigo-secreto", provisoria.privada])
      expect(conteudo).not.toContain(segredo);
  });

  it("não consegue ler o nome do grupo: ainda assim entrou (usa o nome do convite)", async () => {
    const { bv } = montar({ lerGrupo: async () => Promise.reject(new Error("x")) });
    await bv.conferirConvite(texto());
    expect(await bv.entrar()).toEqual({ ok: true, grupo: "Amigos do Eliel" });
  });

  it("duas entradas ao mesmo tempo: só a primeira roda", async () => {
    const { bv, chamadas } = montar({
      entrar: async () => {
        await new Promise((r) => setTimeout(r, 20));
        return { token: "t" };
      },
    });
    await bv.conferirConvite(texto());
    const [a, b] = await Promise.all([bv.entrar(), bv.entrar()]);
    expect([a.ok, b.ok].filter(Boolean)).toHaveLength(1);
    expect(chamadas.filter((c) => c === "chaves")).toHaveLength(1);
  });
});
