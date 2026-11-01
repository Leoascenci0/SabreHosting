import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gerarChavesDoPc } from "@sabrehosting/nucleo/rede/wireguard";
import { criarBoasVindas, pastaPermitida, type DepsBoasVindas } from "./boas-vindas.js";

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
      portaCartorio: 7710, // o app lê daqui o endereço do cartório; sem isso ele dependeria do ambiente
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

  /** Passo elevado que falha na definitiva (convite já gasto) nas `falhas` primeiras vezes. */
  function gastaEFalha(falhas: number) {
    const relogio = { agora: AGORA };
    const usos: Array<{ codigo: string; publica: string; privada: string }> = [];
    const m = montar({
      agora: () => relogio.agora,
      entrar: async (c, chaves, guardar) => {
        usos.push({ codigo: c.codigo, publica: chaves.publica, privada: chaves.privada });
        await guardar(`token-${usos.length}`);
        if (usos.length <= falhas)
          throw Object.assign(new Error("Clique em Tentar de novo."), { conviteGasto: true });
        return { token: `token-${usos.length}` };
      },
    });
    return { ...m, relogio, usos };
  }

  it("falha na definitiva depois do convite gasto: Tentar de novo reusa convite e chaves e entra", async () => {
    const { bv, usos, chamadas, guardados, relogio } = gastaEFalha(1);
    await bv.conferirConvite(texto());
    const r = await bv.entrar();
    expect(r).toMatchObject({ ok: false, tentarDeNovo: true });
    expect(JSON.stringify(r)).not.toContain(usos[0]?.privada);
    relogio.agora += 29 * 60_000;
    const de = await bv.entrar();
    expect(de).toEqual({ ok: true, grupo: "Amigos do Eliel", endereco: "jogar.exemplo.org:25565" });
    expect(usos).toHaveLength(2);
    expect(usos[1]).toEqual(usos[0]); // MESMO convite e MESMA chave: o cartório só reemite para o mesmo PC
    expect(chamadas.filter((c) => c === "chaves")).toHaveLength(1);
    expect(guardados.at(-1)).toBe("token-2");
    expect(await bv.estado()).toMatchObject({ aberto: true, passo: "eula" });
    expect((await bv.entrar()).ok).toBe(false); // entrou: nada fica guardado para repetir
    expect(usos).toHaveLength(2);
  });

  it("falhou de novo: o botão continua, e a janela de 30 min conta do primeiro uso", async () => {
    const { bv, usos, relogio } = gastaEFalha(5);
    await bv.conferirConvite(texto());
    await bv.entrar();
    relogio.agora += 20 * 60_000;
    expect(await bv.entrar()).toMatchObject({ ok: false, tentarDeNovo: true });
    relogio.agora += 10 * 60_000; // 30 min do 1º uso
    const r = await bv.entrar();
    expect(r.ok).toBe(false);
    expect(r).not.toHaveProperty("tentarDeNovo");
    expect(!r.ok && r.mensagem).toContain("convite novo");
    expect(usos).toHaveLength(2); // passou a janela: nem tenta (não pede o administrador à toa)
    expect((await bv.entrar()).ok).toBe(false);
    expect(usos).toHaveLength(2);
  });

  it("o cartório recusou a repetição (401): esquece o convite e pede outro", async () => {
    let vez = 0;
    const { bv } = montar({
      entrar: async () => {
        vez++;
        if (vez === 1) throw Object.assign(new Error("x"), { conviteGasto: true });
        throw Object.assign(new Error("Cartório recusou (401)"), { tipo: "acesso" });
      },
    });
    await bv.conferirConvite(texto());
    expect(await bv.entrar()).toMatchObject({ tentarDeNovo: true });
    const r = await bv.entrar();
    expect(r).not.toHaveProperty("tentarDeNovo");
    expect(!r.ok && r.mensagem).toContain("convite novo");
    expect((await bv.entrar()).ok).toBe(false);
    expect(vez).toBe(2);
  });

  it("conferir outro convite descarta a retomada (chaves novas para o convite novo)", async () => {
    const { bv, usos, chamadas } = gastaEFalha(1);
    await bv.conferirConvite(texto());
    await bv.entrar();
    await bv.conferirConvite(texto({ c: "outro-codigo-do-convite" }));
    expect((await bv.entrar()).ok).toBe(true);
    expect(usos[1]?.codigo).toBe("outro-codigo-do-convite");
    expect(usos[1]?.publica).not.toBe(usos[0]?.publica);
    expect(chamadas.filter((c) => c === "chaves")).toHaveLength(2);
  });

  it("conferir de novo o MESMO convite não perde a retomada (a chave continua a mesma)", async () => {
    const { bv, usos } = gastaEFalha(1);
    await bv.conferirConvite(texto());
    await bv.entrar();
    await bv.conferirConvite(texto());
    expect((await bv.entrar()).ok).toBe(true);
    expect(usos[1]).toEqual(usos[0]);
  });

  it("falha antes do cartório (UAC negado): repetir usa a MESMA chave (o cartório pode ter marcado o convite)", async () => {
    const chaves: string[] = [];
    let vez = 0;
    const { bv } = montar({
      entrar: async (_c, k) => {
        chaves.push(k.publica);
        if (++vez === 1) throw new Error("Não consegui instalar a rede privada.");
        return { token: "t" };
      },
    });
    await bv.conferirConvite(texto());
    const r = await bv.entrar();
    expect(r).toEqual({ ok: false, mensagem: "Não consegui instalar a rede privada." });
    expect((await bv.entrar()).ok).toBe(true);
    expect(chaves[1]).toBe(chaves[0]);
  });

  it("o token chega ao cofre pelo passo elevado e não é guardado duas vezes", async () => {
    const { bv, guardados } = montar({
      entrar: async (_c, _k, guardar) => {
        await guardar("token-do-pc");
        return { token: "token-do-pc" };
      },
    });
    await bv.conferirConvite(texto());
    expect((await bv.entrar()).ok).toBe(true);
    expect(guardados).toEqual(["token-do-pc"]);
  });
});

describe("pastaPermitida", () => {
  it.each([
    "C:\\a\\..\\..",
    "C:\\..\\Windows",
    "C:\\Jogos\\..\\..\\x",
    "C:\\",
    "C:",
    "/",
    "pasta/relativa",
    "C:\\Windows",
    "c:/windows/system32/sabre",
    "C:\\Program Files\\Sabre",
    "C:\\Program Files (x86)\\Sabre",
    "",
  ])("recusa %s", (p) => expect(pastaPermitida(p)).toBe(false));
  it.each(["C:\\Jogos\\SabreHosting", "D:/Amigos/Sabre", "/home/x/sabre"])("aceita %s", (p) =>
    expect(pastaPermitida(p)).toBe(true),
  );
  it("recusa o que não é texto", () => {
    expect(pastaPermitida(42)).toBe(false);
    expect(pastaPermitida(undefined)).toBe(false);
  });

  it("PC já configurado com cofre corrompido: reabre no convite avisando; ausente/ok não", async () => {
    writeFileSync(
      join(dados, "boas-vindas.json"),
      JSON.stringify({
        grupo: { nome: "G" },
        portaCartorio: 7710,
        concluido: true,
        pastaBase: base,
      }),
    );
    const com = (tipo: "corrompido" | "ausente" | "indisponivel") =>
      montar({
        cofre: {
          guardar: async () => {},
          ler: async () => undefined,
          estado: async () => ({ tipo }),
        },
      }).bv;
    expect(await com("corrompido").estado()).toMatchObject({
      aberto: true,
      passo: "convite",
      cofreCorrompido: true,
    });
    expect(await com("ausente").estado()).toEqual({ aberto: false });
    expect(await com("indisponivel").estado()).toEqual({ aberto: false });
  });
});
