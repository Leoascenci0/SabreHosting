import { mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { Writable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { type AjudanteEntrada, type PacoteLigacao, gerarParProvisorio } from "./ajudante.js";
import { ajudanteDoAmbiente } from "./ambiente.js";
import { abrirBanco, apagarConvitesVencidos, criarConvite, donoAtual, revogarPc } from "./banco.js";
import { hashSegredo } from "./segredo.js";
import { criarConviteDono, rodarComando, trocarDono } from "./comandos.js";
import { type Grupo, limparProvisorios } from "./convite.js";
import { criarCartorio } from "./servidor.js";

const HORA = 3_600_000;
const pastas: string[] = [];
const fechar: Array<() => Promise<unknown>> = [];

afterEach(async () => {
  for (const f of fechar.splice(0)) await f();
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

/** Ajudante falso com o comportamento do contrato: idempotente pela chave, grava cada chamada. */
function ajudanteFalso() {
  const chamadas: string[][] = [];
  const salaPorChave = new Map<string, string>();
  const defPorChave = new Map<string, string>();
  const hub = gerarParProvisorio().publica;
  const falhas = { trocar: 0, remover: 0 };
  const ajudante: AjudanteEntrada = {
    adicionar(chave) {
      chamadas.push(["entrada-adicionar", chave]);
      if (!salaPorChave.has(chave)) salaPorChave.set(chave, `10.66.0.${200 + salaPorChave.size}`);
      return Promise.resolve(salaPorChave.get(chave) ?? "");
    },
    trocar(ipProv, nome, chave) {
      chamadas.push(["entrada-trocar", ipProv, nome, chave]);
      if (falhas.trocar > 0) {
        falhas.trocar--;
        return Promise.reject(new Error("tempo esgotado"));
      }
      if (!defPorChave.has(chave)) defPorChave.set(chave, `10.66.0.${2 + defPorChave.size}`);
      const pacote: PacoteLigacao = {
        ip_pc: defPorChave.get(chave) ?? "",
        chave_publica_hub: hub,
        endpoint: "hub.exemplo:51820",
        allowed_ips: "10.66.0.0/24",
      };
      return Promise.resolve(pacote);
    },
    remover(ipProv) {
      chamadas.push(["entrada-remover", ipProv]);
      if (falhas.remover > 0) {
        falhas.remover--;
        return Promise.reject(new Error("falhou"));
      }
      return Promise.resolve();
    },
  };
  const removidos = () => chamadas.filter((c) => c[0] === "entrada-remover").map((c) => c[1]);
  return { ajudante, chamadas, falhas, removidos };
}

const GRUPO: Grupo = {
  nome: "Grupo de Teste",
  enderecoJogar: "jogar.exemplo",
  hubEndpoint: "hub.exemplo:51820",
  hubChavePub: gerarParProvisorio().publica,
  portaCartorio: 7710,
};

interface TextoConvite {
  g: string;
  h: string;
  k: string;
  i: string;
  p: string;
  c: string;
  a: number;
  e: number;
}
function ler(texto: string): TextoConvite {
  const m = /^sabre:\/\/convite\/1\.([A-Za-z0-9_-]+)$/.exec(texto);
  if (!m?.[1]) throw new Error(`texto de convite torto: ${texto}`);
  return JSON.parse(Buffer.from(m[1], "base64url").toString()) as TextoConvite;
}

function montar(extra: { semAjudante?: boolean; limpezaMs?: number } = {}) {
  const pasta = mkdtempSync(join(tmpdir(), "sabre-convite-"));
  pastas.push(pasta);
  const relogio = { agora: 1_000_000 };
  const linhasDoLog: string[] = [];
  const log = new Writable({
    write(pedaco, _cod, pronto) {
      linhasDoLog.push(String(pedaco));
      pronto();
    },
  });
  const banco = abrirBanco(join(pasta, "cartorio.db"));
  const falso = ajudanteFalso();
  const app = criarCartorio({
    banco,
    logger: { level: "trace", stream: log },
    agora: () => relogio.agora,
    ajudante: extra.semAjudante ? undefined : falso.ajudante,
    grupo: GRUPO,
    limpezaMs: extra.limpezaMs,
  });
  fechar.push(() => app.close());

  function usar(convite: string, chave: string, ip: string) {
    return app.inject({
      method: "POST",
      url: "/convites/usar",
      payload: { convite, chave_publica: chave },
      remoteAddress: ip,
    });
  }
  /** Entra com o texto do convite como o app faria: chave própria nova, do IP provisório, e confirma. */
  async function entrar(texto: string, confirmar = true) {
    const t = ler(texto);
    const chave = gerarParProvisorio().publica;
    const r = await usar(t.c, chave, t.i);
    expect(r.statusCode).toBe(200);
    const { token, pacote } = r.json<{ token: string; pacote: PacoteLigacao }>();
    const auth = { authorization: `Bearer ${token}` };
    if (confirmar) {
      const c = await app.inject({
        method: "POST",
        url: "/convites/confirmar",
        headers: auth,
        remoteAddress: pacote.ip_pc,
      });
      expect(c.statusCode).toBe(204);
    }
    return { token, pacote, auth, chave, t };
  }
  async function comDono() {
    const texto = await criarConviteDono(
      banco,
      falso.ajudante,
      GRUPO,
      { nomePc: "pc-do-dono" },
      relogio.agora,
    );
    return { texto, ...(await entrar(texto)) };
  }
  function convidar(auth: Record<string, string>, payload: object, ip = "10.66.0.2") {
    return app.inject({
      method: "POST",
      url: "/convites",
      headers: auth,
      payload,
      remoteAddress: ip,
    });
  }
  return { app, banco, pasta, relogio, linhasDoLog, usar, entrar, comDono, convidar, ...falso };
}

describe("convite do grupo: criar (só o dono)", () => {
  it("dono cria; o texto leva grupo, hub, IP e chave provisórios, código, porta e prazo", async () => {
    const { comDono, convidar, chamadas, relogio } = montar();
    const { auth } = await comDono();
    const r = await convidar(auth, { nomePc: "pc-da-ana" });
    expect(r.statusCode).toBe(201);
    const { convite, expiraEm } = r.json<{ convite: string; expiraEm: number }>();
    expect(expiraEm).toBe(relogio.agora + 24 * HORA);
    const t = ler(convite);
    expect(t).toMatchObject({
      g: GRUPO.nome,
      h: GRUPO.hubEndpoint,
      k: GRUPO.hubChavePub,
      a: 7710,
      e: Math.floor((relogio.agora + 24 * HORA) / 1000),
    });
    expect(t.i).toMatch(/^10\.66\.0\.2\d\d$/);
    expect(t.c).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(convite.length).toBeLessThan(400);
    // O ajudante recebeu a chave PÚBLICA que corresponde à privada do texto.
    const adicionadas = chamadas.filter((c) => c[0] === "entrada-adicionar").map((c) => c[1]);
    expect(adicionadas).toHaveLength(2);
    expect(adicionadas[1]).not.toBe(t.p);
  });

  it("PC que não é dono → 403; sem token → 401", async () => {
    const { comDono, convidar, entrar } = montar();
    const { auth } = await comDono();
    const texto = (await convidar(auth, { nomePc: "pc-da-ana" })).json<{ convite: string }>();
    const ana = await entrar(texto.convite);
    const r = await convidar(ana.auth, { nomePc: "pc-x" }, ana.pacote.ip_pc);
    expect(r.statusCode).toBe(403);
    expect(r.json<{ erro: string }>().erro).toMatch(/dono/);
    expect((await convidar({}, { nomePc: "pc-x" })).statusCode).toBe(401);
  });

  it("validade padrão 24 h, máximo 72 h; nome fora do formato da rede → 400; nome em uso → 409", async () => {
    const { comDono, convidar } = montar();
    const { auth } = await comDono();
    expect((await convidar(auth, { nomePc: "pc-b", validadeHoras: 72 })).statusCode).toBe(201);
    expect((await convidar(auth, { nomePc: "pc-c", validadeHoras: 73 })).statusCode).toBe(400);
    expect((await convidar(auth, { nomePc: "pc-c", validadeHoras: 0 })).statusCode).toBe(400);
    expect((await convidar(auth, { nomePc: "PC da Ana" })).statusCode).toBe(400);
    expect((await convidar(auth, { nomePc: "a".repeat(33) })).statusCode).toBe(400);
    expect((await convidar(auth, { nomePc: "pc-b" })).statusCode).toBe(409);
    expect((await convidar(auth, { nomePc: "pc-do-dono" })).statusCode).toBe(409);
  });

  it("sem ajudante configurado → 503 (falha fechada, nada é gravado)", async () => {
    const { banco, convidar } = montar({ semAjudante: true });
    const pc = banco
      .prepare("INSERT INTO pcs (nome, criado_em, dono) VALUES ('pc-do-dono', 0, 1)")
      .run();
    banco
      .prepare("INSERT INTO tokens (hash, pc_id, criado_em) VALUES (?, ?, 0)")
      .run((await import("./segredo.js")).hashSegredo("token-de-teste"), pc.lastInsertRowid);
    const r = await convidar({ authorization: "Bearer token-de-teste" }, { nomePc: "pc-b" });
    expect(r.statusCode).toBe(503);
    expect(banco.prepare("SELECT count(*) AS n FROM convites").get()).toEqual({ n: 0 });
  });
});

describe("tirar PC do grupo: POST /pcs/:id/revogar (só o dono)", () => {
  async function comAna() {
    const m = montar();
    const dono = await m.comDono();
    const texto = (await m.convidar(dono.auth, { nomePc: "pc-da-ana" })).json<{
      convite: string;
    }>();
    const ana = await m.entrar(texto.convite);
    const idDe = (nome: string) =>
      (m.banco.prepare("SELECT id FROM pcs WHERE nome = ?").get(nome) as { id: number }).id;
    const revogar = (auth: Record<string, string>, id: number | string, ip = "10.66.0.2") =>
      m.app.inject({ method: "POST", url: `/pcs/${id}/revogar`, headers: auth, remoteAddress: ip });
    const eu = (a: { auth: Record<string, string>; pacote: PacoteLigacao }) =>
      m.app.inject({ url: "/eu", headers: a.auth, remoteAddress: a.pacote.ip_pc });
    return { m, dono, ana, idDe, revogar, eu };
  }

  it("dono revoga: o token do PC tirado vira 401 no /eu; o do dono continua valendo", async () => {
    const { dono, ana, idDe, revogar, eu } = await comAna();
    expect((await eu(ana)).statusCode).toBe(200);
    const r = await revogar(dono.auth, idDe("pc-da-ana"));
    expect(r.statusCode).toBe(204);
    expect((await eu(ana)).statusCode).toBe(401);
    expect((await eu(dono)).statusCode).toBe(200);
  });

  it("revogar duas vezes é inofensivo (204) e o PC continua sem acesso", async () => {
    const { dono, ana, idDe, revogar, eu } = await comAna();
    expect((await revogar(dono.auth, idDe("pc-da-ana"))).statusCode).toBe(204);
    expect((await revogar(dono.auth, idDe("pc-da-ana"))).statusCode).toBe(204);
    expect((await eu(ana)).statusCode).toBe(401);
  });

  it("quem não é dono → 403 e nada é revogado; sem token → 401", async () => {
    const { dono, ana, idDe, revogar, eu } = await comAna();
    const r = await revogar(ana.auth, idDe("pc-do-dono"), ana.pacote.ip_pc);
    expect(r.statusCode).toBe(403);
    expect(r.json<{ erro: string }>().erro).toMatch(/dono/);
    expect((await revogar({}, idDe("pc-da-ana"))).statusCode).toBe(401);
    expect((await eu(dono)).statusCode).toBe(200);
    expect((await eu(ana)).statusCode).toBe(200);
  });

  it("o dono não se tira (409, só depois do trocar-dono); PC inexistente → 404; id inválido → 400", async () => {
    const { dono, idDe, revogar, eu } = await comAna();
    const r = await revogar(dono.auth, idDe("pc-do-dono"));
    expect(r.statusCode).toBe(409);
    expect(r.json<{ erro: string }>().erro).toMatch(/trocar-dono|posse/);
    expect((await eu(dono)).statusCode).toBe(200);
    expect((await revogar(dono.auth, 9999)).statusCode).toBe(404);
    expect((await revogar(dono.auth, "abc")).statusCode).toBe(400);
  });

  it("revogarPc direto no banco recusa o dono e o PC inexistente (a conferência é da transação, não da rota)", async () => {
    const { m, ana, idDe, eu } = await comAna();
    expect(revogarPc(m.banco, idDe("pc-do-dono"), 1)).toBe("dono");
    expect(revogarPc(m.banco, 9999, 1)).toBe("inexistente");
    expect(revogarPc(m.banco, idDe("pc-da-ana"), 1)).toBe("revogado");
    expect((await eu(ana)).statusCode).toBe(401);
    expect(
      m.banco.prepare("SELECT count(*) AS n FROM tokens WHERE revogado_em IS NULL").get(),
    ).toEqual({ n: 1 });
  });

  it("PC tirado que segurava a trava a perde só no prazo (~20 s), não na hora", async () => {
    const { m, dono, ana, idDe, revogar } = await comAna();
    const pegar = await m.app.inject({
      method: "POST",
      url: "/trava/pegar",
      headers: ana.auth,
      remoteAddress: ana.pacote.ip_pc,
    });
    expect(pegar.statusCode).toBeLessThan(300);
    await revogar(dono.auth, idDe("pc-da-ana"));
    const t = await m.app.inject({ url: "/trava", headers: dono.auth, remoteAddress: "10.66.0.2" });
    expect(t.json<{ dono: { nome: string } | null }>().dono?.nome).toBe("pc-da-ana");
    m.relogio.agora += 60_000;
    const depois = await m.app.inject({
      url: "/trava",
      headers: dono.auth,
      remoteAddress: "10.66.0.2",
    });
    expect(depois.json<{ dono: unknown }>().dono).toBeNull();
  });
});

describe("convite do grupo: usar (sala de entrada, duas fases)", () => {
  async function comConvite(m: ReturnType<typeof montar>) {
    const dono = await m.comDono();
    const r = await m.convidar(dono.auth, { nomePc: "pc-da-ana" });
    return { dono, texto: r.json<{ convite: string }>().convite };
  }

  it("de outro IP → 401 (e conta falha); do IP provisório → token + pacote definitivo", async () => {
    const m = montar();
    const { texto } = await comConvite(m);
    const t = ler(texto);
    const chave = gerarParProvisorio().publica;
    expect((await m.usar(t.c, chave, "10.66.0.250")).statusCode).toBe(401);
    expect((await m.usar(t.c, chave, "10.66.0.7")).statusCode).toBe(401);
    expect((await m.usar(t.c, chave, "127.0.0.1")).statusCode).toBe(401);
    const sem = await m.app.inject({
      method: "POST",
      url: "/convites/usar",
      payload: { convite: t.c },
      remoteAddress: t.i,
    });
    expect(sem.statusCode).toBe(401);
    const r = await m.usar(t.c, chave, t.i);
    expect(r.statusCode).toBe(200);
    const { token, pacote } = r.json<{ token: string; pacote: PacoteLigacao }>();
    expect(pacote.ip_pc).toMatch(/^10\.66\.0\.\d+$/);
    expect(m.chamadas).toContainEqual(["entrada-trocar", t.i, "pc-da-ana", chave]);
    const eu = await m.app.inject({
      url: "/eu",
      headers: { authorization: `Bearer ${token}` },
      remoteAddress: pacote.ip_pc,
    });
    expect(eu.json()).toMatchObject({ nome: "pc-da-ana" });
  });

  it("resposta perdida: repetir com a MESMA chave → mesmo IP e token novo (o anterior para); chave diferente → 401", async () => {
    const m = montar();
    const { texto } = await comConvite(m);
    const t = ler(texto);
    const chave = gerarParProvisorio().publica;
    const a = (await m.usar(t.c, chave, t.i)).json<{ token: string; pacote: PacoteLigacao }>();
    const b = (await m.usar(t.c, chave, t.i)).json<{ token: string; pacote: PacoteLigacao }>();
    expect(b.pacote.ip_pc).toBe(a.pacote.ip_pc);
    expect(b.token).not.toBe(a.token);
    const eu = (token: string) =>
      m.app.inject({
        url: "/eu",
        headers: { authorization: `Bearer ${token}` },
        remoteAddress: a.pacote.ip_pc,
      });
    expect((await eu(a.token)).statusCode).toBe(401);
    expect((await eu(b.token)).statusCode).toBe(200);
    expect((await m.usar(t.c, gerarParProvisorio().publica, t.i)).statusCode).toBe(401);
    expect(m.banco.prepare("SELECT count(*) AS n FROM pcs").get()).toEqual({ n: 2 });
  });

  it("ajudante falha no trocar → 503; o PC repete e entra (não encalha)", async () => {
    const m = montar();
    const { texto } = await comConvite(m);
    const t = ler(texto);
    const chave = gerarParProvisorio().publica;
    m.falhas.trocar = 1;
    expect((await m.usar(t.c, chave, t.i)).statusCode).toBe(503);
    const r = await m.usar(t.c, chave, t.i);
    expect(r.statusCode).toBe(200);
  });

  it("confirmar do IP definitivo tira o provisório; depois disso repetir o usar → 401", async () => {
    const m = montar();
    const { texto } = await comConvite(m);
    const t = ler(texto);
    const chave = gerarParProvisorio().publica;
    const { token, pacote } = (await m.usar(t.c, chave, t.i)).json<{
      token: string;
      pacote: PacoteLigacao;
    }>();
    const confirmar = (ip: string) =>
      m.app.inject({
        method: "POST",
        url: "/convites/confirmar",
        headers: { authorization: `Bearer ${token}` },
        remoteAddress: ip,
      });
    expect((await confirmar("10.66.0.99")).statusCode).toBe(403);
    expect((await confirmar(t.i)).statusCode).toBe(403); // sala de entrada não confirma
    expect(m.removidos()).not.toContain(t.i);
    expect((await confirmar(pacote.ip_pc)).statusCode).toBe(204);
    expect(m.removidos()).toContain(t.i);
    expect((await confirmar(pacote.ip_pc)).statusCode).toBe(204);
    expect(m.removidos().filter((ip) => ip === t.i)).toHaveLength(1);
    expect((await m.usar(t.c, chave, t.i)).statusCode).toBe(401);
  });

  it("convite vencido: usar → 401 e a limpeza remove o provisório; a de 7 dias não apaga a linha antes", async () => {
    const m = montar();
    const { texto } = await comConvite(m);
    const t = ler(texto);
    m.relogio.agora += 24 * HORA - 1;
    expect(await limparProvisorios(m.banco, m.ajudante, m.relogio.agora)).toEqual({
      removidos: 0,
      falhas: 0,
    });
    m.relogio.agora += 1;
    expect((await m.usar(t.c, gerarParProvisorio().publica, t.i)).statusCode).toBe(401);
    m.falhas.remover = 1;
    m.relogio.agora += 8 * 24 * HORA;
    expect(await limparProvisorios(m.banco, m.ajudante, m.relogio.agora)).toEqual({
      removidos: 0,
      falhas: 1,
    });
    expect(apagarConvitesVencidos(m.banco, m.relogio.agora)).toBe(0);
    expect(await limparProvisorios(m.banco, m.ajudante, m.relogio.agora)).toEqual({
      removidos: 1,
      falhas: 0,
    });
    expect(m.removidos().filter((ip) => ip === t.i)).toHaveLength(2);
    expect(apagarConvitesVencidos(m.banco, m.relogio.agora)).toBe(1);
  });

  it("convite usado e não confirmado: no prazo, a limpeza tira o provisório", async () => {
    const m = montar();
    const { texto } = await comConvite(m);
    const t = ler(texto);
    expect((await m.usar(t.c, gerarParProvisorio().publica, t.i)).statusCode).toBe(200);
    m.relogio.agora += 24 * HORA;
    expect((await limparProvisorios(m.banco, m.ajudante, m.relogio.agora)).removidos).toBe(1);
    expect(m.removidos()).toContain(t.i);
  });

  it("a limpeza roda sozinha no intervalo configurado", async () => {
    const m = montar({ limpezaMs: 10 });
    const { texto } = await comConvite(m);
    const t = ler(texto);
    m.relogio.agora += 24 * HORA;
    for (let i = 0; i < 200 && !m.removidos().includes(t.i); i++)
      await new Promise((ok) => setTimeout(ok, 10));
    expect(m.removidos()).toContain(t.i);
  });
});

describe("convite do grupo: sala de entrada e /grupo", () => {
  it("da sala de entrada só o usar responde; /grupo dá nome e endereço do Jogar", async () => {
    const m = montar();
    const { auth } = await m.comDono();
    for (const url of ["/saude", "/eu", "/grupo", "/trava"]) {
      const r = await m.app.inject({ url, headers: auth, remoteAddress: "10.66.0.230" });
      expect(r.statusCode, url).toBe(403);
    }
    const g = await m.app.inject({ url: "/grupo", headers: auth, remoteAddress: "10.66.0.2" });
    expect(g.json()).toEqual({ nome: GRUPO.nome, endereco_jogar: GRUPO.enderecoJogar });
    expect((await m.app.inject({ url: "/grupo", remoteAddress: "10.66.0.2" })).statusCode).toBe(
      401,
    );
  });

  it("código, token, chave privada provisória e texto do convite fora do banco e do log", async () => {
    const m = montar();
    const dono = await m.comDono();
    const r = await m.convidar(dono.auth, { nomePc: "pc-da-ana" });
    const texto = r.json<{ convite: string }>().convite;
    const ana = await m.entrar(texto);
    await m.app.close();
    const segredos = [dono.token, dono.t.c, dono.t.p, ana.token, ana.t.c, ana.t.p, texto];
    for (const arquivo of readdirSync(m.pasta)) {
      const bytes = readFileSync(join(m.pasta, arquivo)).toString("latin1");
      for (const s of segredos) expect(bytes).not.toContain(s);
    }
    const log = m.linhasDoLog.join("");
    expect(log.length).toBeGreaterThan(0);
    for (const s of segredos) expect(log).not.toContain(s);
  });
});

describe("comandos de root: criar-convite-dono e trocar-dono", () => {
  it("convite de dono: quem entra vira dono; segundo comando recusa (com dono ou convite pendente)", async () => {
    const m = montar();
    const criar = () =>
      criarConviteDono(m.banco, m.ajudante, GRUPO, { nomePc: "outro" }, m.relogio.agora);
    const texto = await criarConviteDono(
      m.banco,
      m.ajudante,
      GRUPO,
      { nomePc: "pc-do-dono" },
      m.relogio.agora,
    );
    await expect(criar()).rejects.toThrow(/pendente/);
    await m.entrar(texto);
    expect(donoAtual(m.banco)?.nome).toBe("pc-do-dono");
    await expect(criar()).rejects.toThrow(/já tem dono/);
    await expect(
      criarConviteDono(m.banco, m.ajudante, GRUPO, { nomePc: "x", horas: 73 }, m.relogio.agora),
    ).rejects.toThrow(/validade/);
  });

  it("trocar-dono passa a marca para outro PC ativo; --novo-convite: o antigo deixa de ser dono quando o novo entra", async () => {
    const m = montar();
    const dono = await m.comDono();
    const ana = await m.entrar(
      (await m.convidar(dono.auth, { nomePc: "pc-da-ana" })).json<{ convite: string }>().convite,
    );
    const anaId = m.app.inject({ url: "/eu", headers: ana.auth, remoteAddress: ana.pacote.ip_pc });
    const id = (await anaId).json<{ id: number }>().id;
    expect(() => trocarDono(m.banco, 999)).toThrow(/não há PC ativo/);
    expect(trocarDono(m.banco, id)).toBe("pc-da-ana");
    expect((await m.convidar(dono.auth, { nomePc: "pc-b" }, "10.66.0.2")).statusCode).toBe(403);
    expect((await m.convidar(ana.auth, { nomePc: "pc-b" })).statusCode).toBe(201);

    const novo = await criarConviteDono(
      m.banco,
      m.ajudante,
      GRUPO,
      { nomePc: "pc-novo", substituir: true },
      m.relogio.agora,
    );
    expect(donoAtual(m.banco)?.nome).toBe("pc-da-ana");
    await m.entrar(novo);
    expect(donoAtual(m.banco)?.nome).toBe("pc-novo");
    expect(m.banco.prepare("SELECT count(*) AS n FROM pcs WHERE dono = 1").get()).toEqual({ n: 1 });
  });

  it("linha de comando: uso errado e ajudante ausente → erro, sem criar convite", async () => {
    const pasta = mkdtempSync(join(tmpdir(), "sabre-cmd-"));
    pastas.push(pasta);
    const env = {
      SABRE_CARTORIO_BANCO: join(pasta, "c.db"),
      SABRE_AJUDANTE_SOCKET: join(pasta, "nao-existe.sock"),
      SABRE_GRUPO_NOME: "G",
      SABRE_GRUPO_ENDERECO_JOGAR: "jogar.exemplo",
      SABRE_HUB_ENDPOINT: "hub.exemplo:51820",
      SABRE_HUB_CHAVE_PUB: GRUPO.hubChavePub,
    };
    await expect(rodarComando([], env)).rejects.toThrow(/uso:/);
    await expect(rodarComando(["trocar-dono", "abc"], env)).rejects.toThrow(/uso:/);
    await expect(rodarComando(["criar-convite-dono", "pc-do-dono"], env)).rejects.toThrow(
      /ajudante/,
    );
    await expect(rodarComando(["trocar-dono", "1"], env)).rejects.toThrow(/não há PC ativo/);
    const banco = abrirBanco(env.SABRE_CARTORIO_BANCO);
    expect(banco.prepare("SELECT count(*) AS n FROM convites").get()).toEqual({ n: 0 });
    banco.close();
  });
});

describe("revisão do PR #84", () => {
  it("ajudanteDoAmbiente: socket ausente → sem ajudante → POST /convites 503 (falha fechada, nunca um falso)", async () => {
    const pasta = mkdtempSync(join(tmpdir(), "sabre-amb-"));
    pastas.push(pasta);
    const ausente = join(pasta, "nao-existe.sock");
    expect(ajudanteDoAmbiente({ SABRE_AJUDANTE_SOCKET: ausente })).toBeUndefined();
    const existe = join(pasta, "ajudante.sock");
    writeFileSync(existe, "");
    expect(ajudanteDoAmbiente({ SABRE_AJUDANTE_SOCKET: existe })).toBeDefined();

    const banco = abrirBanco(join(pasta, "c.db"));
    const app = criarCartorio({
      banco,
      logger: { level: "silent" },
      ajudante: ajudanteDoAmbiente({ SABRE_AJUDANTE_SOCKET: ausente }),
      grupo: GRUPO,
    });
    fechar.push(() => app.close());
    const pc = banco.prepare("INSERT INTO pcs (nome, criado_em, dono) VALUES ('d', 0, 1)").run();
    banco
      .prepare("INSERT INTO tokens (hash, pc_id, criado_em) VALUES (?, ?, 0)")
      .run(hashSegredo("token-do-dono"), pc.lastInsertRowid);
    const r = await app.inject({
      method: "POST",
      url: "/convites",
      headers: { authorization: "Bearer token-do-dono" },
      payload: { nomePc: "pc-b" },
    });
    expect(r.statusCode).toBe(503);
    expect(banco.prepare("SELECT count(*) AS n FROM convites").get()).toEqual({ n: 0 });
  });

  it("convite antigo (sem sala de entrada): vale uma vez de qualquer IP, sem chamar o ajudante", async () => {
    const m = montar();
    const antigo = criarConvite(m.banco, "pc-antigo", m.relogio.agora, 60_000);
    const usar = (ip: string) =>
      m.app.inject({
        method: "POST",
        url: "/convites/usar",
        payload: { convite: antigo },
        remoteAddress: ip,
      });
    const r = await usar("10.66.0.40");
    expect(r.statusCode).toBe(200);
    expect(Object.keys(r.json<object>())).toEqual(["token"]);
    expect((await usar("10.66.0.40")).statusCode).toBe(401);
    expect(m.chamadas).toEqual([]);
    const vencido = criarConvite(m.banco, "pc-vencido", m.relogio.agora, 60_000);
    m.relogio.agora += 60_000;
    expect(
      (
        await m.app.inject({
          method: "POST",
          url: "/convites/usar",
          payload: { convite: vencido },
        })
      ).statusCode,
    ).toBe(401);
  });
});
