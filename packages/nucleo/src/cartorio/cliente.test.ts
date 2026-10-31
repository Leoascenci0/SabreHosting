import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ErroCartorio, criarCliente, type OpcoesCliente } from "./cliente.js";
import { cofreEmMemoria } from "./cofre.js";
import { escolherFontes } from "../sync/espalhar.js";
import { PORTA_ESPALHAR } from "../sync/transferencia.js";

const TOKEN = randomBytes(16).toString("hex"); // gerado a cada execução
const URL_CARTORIO = "http://10.66.0.1:7070";

type Resposta = Response | Error | "pendurar";

/** `fetch` falso: devolve as respostas na ordem e anota cada chamada. */
function montar(respostas: Resposta[], extra: Partial<OpcoesCliente> = {}) {
  const chamadas: { url: string; init: RequestInit }[] = [];
  const esperas: number[] = [];
  const fetchFn = (url: string | URL | Request, init?: RequestInit): Promise<Response> => {
    chamadas.push({ url: String(url), init: init ?? {} });
    const r = respostas.shift() ?? json(200, {});
    if (r === "pendurar") {
      return new Promise((_ok, falhar) =>
        init?.signal?.addEventListener("abort", () => falhar(init.signal?.reason)),
      );
    }
    return r instanceof Error ? Promise.reject(r) : Promise.resolve(r);
  };
  const cofre = cofreEmMemoria();
  void cofre.guardar(TOKEN);
  const cliente = criarCliente({
    url: URL_CARTORIO,
    cofre,
    fetchFn,
    esperar: async (ms) => void esperas.push(ms),
    sortear: () => 0.5,
    ...extra,
  });
  return { cliente, chamadas, esperas };
}

const json = (status: number, corpo: unknown) =>
  new Response(JSON.stringify(corpo), { status, headers: { "content-type": "application/json" } });
const OK_TRAVA = { ok: true, epoca: 7, expiraEm: 123, renovarMs: 20_000 };
const semRede = () => new TypeError("fetch failed");

async function erroDe(p: Promise<unknown>): Promise<ErroCartorio> {
  const e = await p.then(
    () => undefined,
    (x: unknown) => x,
  );
  expect(e).toBeInstanceOf(ErroCartorio);
  return e as ErroCartorio;
}

describe("cliente do cartório", () => {
  it("manda o token só no cabeçalho e devolve a resposta tipada", async () => {
    const { cliente, chamadas } = montar([json(200, OK_TRAVA)]);
    expect(await cliente.renovar(7)).toEqual(OK_TRAVA);
    expect(chamadas).toHaveLength(1);
    const { url, init } = chamadas[0] ?? { url: "", init: {} };
    expect(url).toBe(`${URL_CARTORIO}/trava/renovar`);
    expect(init.method).toBe("POST");
    expect(init.redirect).toBe("error");
    expect(new Headers(init.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(JSON.parse(String(init.body))).toEqual({ epoca: 7 });
    expect(url).not.toContain(TOKEN);
  });

  it("desiste no prazo quando o cartório não responde e repete o GET", async () => {
    const { cliente, chamadas } = montar(["pendurar", "pendurar", "pendurar"], { prazoMs: 20 });
    const e = await erroDe(cliente.estadoTrava());
    expect(e.tipo).toBe("rede");
    expect(chamadas).toHaveLength(3);
  });

  it("renovar repete em 5xx com espera crescente e jitter determinístico", async () => {
    const { cliente, chamadas, esperas } = montar([json(503, {}), semRede(), json(200, OK_TRAVA)]);
    expect(await cliente.renovar(7)).toEqual(OK_TRAVA);
    expect(chamadas).toHaveLength(3);
    // base 500 ms · 2^(n−1) · (0,5 + 0,5 · 0,5)
    expect(esperas).toEqual([375, 750]);
  });

  it("jitter acompanha o sorteio", async () => {
    const { cliente, esperas } = montar([json(500, {}), json(200, OK_TRAVA)], {
      sortear: () => 0,
    });
    await cliente.renovar(7);
    expect(esperas).toEqual([250]);
  });

  it("pegar com 500 NÃO é repetido (muda a época)", async () => {
    const { cliente, chamadas } = montar([json(500, {}), json(200, OK_TRAVA)]);
    const e = await erroDe(cliente.pegar());
    expect(e.tipo).toBe("servidor");
    expect(chamadas).toHaveLength(1);
  });

  it.each(["pegar", "soltar", "passar"] as const)(
    "%s com erro de rede NÃO é repetido",
    async (rota) => {
      const { cliente, chamadas } = montar([semRede(), json(200, OK_TRAVA)]);
      const chamar = {
        pegar: () => cliente.pegar(),
        soltar: () => cliente.soltar(7),
        passar: () => cliente.passar(7, 2),
      }[rota];
      expect((await erroDe(chamar())).tipo).toBe("rede");
      expect(chamadas).toHaveLength(1);
    },
  );

  it("desiste depois das tentativas", async () => {
    const { cliente, chamadas } = montar([json(502, {}), json(502, {}), json(502, {})]);
    expect((await erroDe(cliente.renovar(7))).tipo).toBe("servidor");
    expect(chamadas).toHaveLength(3);
  });

  it("recusa /eu sem o campo dono e lista torta", async () => {
    const { cliente } = montar([json(200, { id: 3, nome: "pc-b" }), json(200, { id: 1 })]);
    expect((await erroDe(cliente.eu())).tipo).toBe("resposta");
    expect((await erroDe(cliente.listarPcs())).tipo).toBe("resposta");
  });

  it("401 não repete e não mostra o token", async () => {
    const { cliente, chamadas } = montar([json(401, { erro: "Acesso negado." })]);
    const e = await erroDe(cliente.eu());
    expect(e.tipo).toBe("acesso");
    expect(chamadas).toHaveLength(1);
    expect(`${e.message} ${String(e.cause)}`).not.toContain(TOKEN);
  });

  it("409 devolve a recusa com o motivo", async () => {
    const recusa = {
      ok: false,
      erro: "Ocupada.",
      motivo: "ocupada",
      donoPcId: 2,
      epoca: 9,
      expiraEm: 5,
    };
    const { cliente } = montar([json(409, recusa)]);
    expect(await cliente.pegar()).toEqual(recusa);
  });

  it("409 com destino_sem_acesso (cartmel-1.6) é recusa válida", async () => {
    const recusa = {
      ok: false,
      erro: "Sem acesso.",
      motivo: "destino_sem_acesso",
      donoPcId: 1,
      epoca: 4,
      expiraEm: 5,
    };
    const { cliente } = montar([json(409, recusa)]);
    expect(await cliente.passar(4, 2)).toEqual(recusa);
  });

  it("corpo que não é JSON vira erro de resposta", async () => {
    const { cliente } = montar([new Response("<html>", { status: 200 })]);
    expect((await erroDe(cliente.estadoTrava())).tipo).toBe("resposta");
  });

  it("sem token no cofre avisa que o PC não entrou no grupo", async () => {
    const { cliente, chamadas } = montar([], { cofre: cofreEmMemoria() });
    const e = await erroDe(cliente.eu());
    expect(e.tipo).toBe("acesso");
    expect(e.message).toContain("ainda não entrou no grupo");
    expect(chamadas).toHaveLength(0);
  });

  it.each([
    "http://203.0.113.5:7070",
    "ftp://10.66.0.1",
    "http://cartorio.exemplo",
    "http://10.0.0.5",
    "http://10.66.0.5",
    "http://192.168.0.9",
    "http://[fd00::1]",
  ])("recusa endereço inseguro %s", (url) => {
    expect(() => criarCliente({ url, cofre: cofreEmMemoria() })).toThrow(/https/);
  });

  it.each([
    "https://cartorio.exemplo",
    "http://127.0.0.1:1",
    "http://[::1]:7070",
    "http://10.66.0.1",
  ])("aceita %s", (url) => {
    expect(() => criarCliente({ url, cofre: cofreEmMemoria() })).not.toThrow();
  });

  it("convite: criar (sem repetir), usar sem token (repete, prazo maior), confirmar 204 e grupo", async () => {
    const pacote = {
      ip_pc: "10.66.0.12",
      chave_publica_hub: "A".repeat(43) + "=",
      endpoint: "hub.exemplo:51820",
      allowed_ips: "10.66.0.0/24",
    };
    const criado = { convite: "sabre://convite/1.abc", expiraEm: 99 };
    const grupo = { nome: "Grupo", endereco_jogar: "jogar.exemplo" };
    const { cliente, chamadas } = montar([
      json(201, criado),
      semRede(),
      json(200, { token: "t-novo", pacote }),
      new Response(null, { status: 204 }),
      json(200, grupo),
    ]);
    expect(await cliente.criarConvite("pc-da-ana", 48)).toEqual(criado);
    expect(await cliente.usarConvite("codigo", "chave-pub")).toEqual({ token: "t-novo", pacote });
    expect(await cliente.confirmarEntrada()).toBeUndefined();
    expect(await cliente.grupo()).toEqual(grupo);
    expect(chamadas.map((c) => [c.init.method, c.url.replace(URL_CARTORIO, "")])).toEqual([
      ["POST", "/convites"],
      ["POST", "/convites/usar"],
      ["POST", "/convites/usar"],
      ["POST", "/convites/confirmar"],
      ["GET", "/grupo"],
    ]);
    expect(JSON.parse(String(chamadas[0]?.init.body))).toEqual({
      nomePc: "pc-da-ana",
      validadeHoras: 48,
    });
    expect(JSON.parse(String(chamadas[1]?.init.body))).toEqual({
      convite: "codigo",
      chave_publica: "chave-pub",
    });
    expect(new Headers(chamadas[1]?.init.headers).get("authorization")).toBeNull();
    expect(new Headers(chamadas[3]?.init.headers).get("authorization")).toBe(`Bearer ${TOKEN}`);
  });

  it("usar o convite funciona sem token no cofre; 401 diz que o convite não vale", async () => {
    const { cliente } = montar([json(401, {})], { cofre: cofreEmMemoria() });
    const e = await erroDe(cliente.usarConvite("codigo", "chave"));
    expect(e.tipo).toBe("acesso");
    expect(e.message).toMatch(/convite/);
  });

  it("criar convite não repete e traz a mensagem do cartório (403 de quem não é dono)", async () => {
    const { cliente, chamadas } = montar([
      json(403, { erro: "Só o dono do grupo cria convites." }),
    ]);
    const e = await erroDe(cliente.criarConvite("pc-x"));
    expect(e.tipo).toBe("resposta");
    expect(e.message).toContain("Só o dono do grupo cria convites.");
    const r = montar([semRede(), json(201, {})]);
    expect((await erroDe(r.cliente.criarConvite("pc-x"))).tipo).toBe("rede");
    expect(r.chamadas).toHaveLength(1);
    expect(chamadas).toHaveLength(1);
  });

  it("config do grupo: lê e grava (PUT com o corpo certo); 409 e 403 trazem a mensagem do cartório", async () => {
    const ok = { versaoMinecraft: "1.20.1", sha1Manifesto: "a".repeat(40), atualizadoEm: 5 };
    const { cliente, chamadas } = montar([json(200, ok), json(200, ok)]);
    expect(await cliente.lerConfigGrupo()).toEqual(ok);
    expect(await cliente.gravarConfigGrupo("1.20.1", "a".repeat(40))).toEqual(ok);
    expect(chamadas[1]?.url).toBe(`${URL_CARTORIO}/grupo/config`);
    expect(chamadas[1]?.init.method).toBe("PUT");
    expect(JSON.parse(String(chamadas[1]?.init.body))).toEqual({
      versaoMinecraft: "1.20.1",
      sha1Manifesto: "a".repeat(40),
    });
    for (const status of [409, 403]) {
      const r = montar([json(status, { erro: "Pare o servidor antes." })]);
      const e = await erroDe(r.cliente.gravarConfigGrupo("1.20.1", "a".repeat(40)));
      expect(e.message).toContain(`(${status})`);
      expect(e.message).toContain("Pare o servidor antes.");
    }
    const torta = montar([
      json(200, { versaoMinecraft: "1.20.1", sha1Manifesto: "xyz", atualizadoEm: 1 }),
    ]);
    expect((await erroDe(torta.cliente.lerConfigGrupo())).tipo).toBe("resposta");
    const sem = montar([
      json(200, { versaoMinecraft: "1.21.1", sha1Manifesto: null, atualizadoEm: 0 }),
    ]);
    expect((await sem.cliente.lerConfigGrupo()).sha1Manifesto).toBeNull();
  });

  it("revogarPc: 204 tira; 403, 409 e 404 trazem o status e a mensagem; 401 é acesso; nunca repete", async () => {
    const { cliente, chamadas } = montar([new Response(null, { status: 204 })]);
    expect(await cliente.revogarPc(5)).toBeUndefined();
    expect(chamadas[0]?.url).toBe(`${URL_CARTORIO}/pcs/5/revogar`);
    expect(chamadas[0]?.init.method).toBe("POST");
    for (const [status, erro] of [
      [403, "Só o dono do grupo tira um PC do grupo."],
      [409, "O PC dono não pode ser tirado."],
      [404, "Esse PC não existe no grupo."],
    ] as const) {
      const r = montar([json(status, { erro }), new Response(null, { status: 204 })]);
      const e = await erroDe(r.cliente.revogarPc(5));
      expect([e.tipo, e.status]).toEqual(["resposta", status]);
      expect(e.message).toContain(erro);
      expect(r.chamadas).toHaveLength(1);
    }
    const a = montar([json(401, {})]);
    expect((await erroDe(a.cliente.revogarPc(5))).tipo).toBe("acesso");
    const rede = montar([semRede(), new Response(null, { status: 204 })]);
    expect((await erroDe(rede.cliente.revogarPc(5))).tipo).toBe("rede");
    expect(rede.chamadas).toHaveLength(1);
  });

  const PACOTE = {
    ip_pc: "10.66.0.12",
    chave_publica_hub: `${"A".repeat(43)}=`,
    endpoint: "hub.exemplo:51820",
    allowed_ips: "10.66.0.0/24",
  };
  const RECUSA = { ok: false, erro: "x", motivo: "ocupada", donoPcId: 2, epoca: 9, expiraEm: 5 };
  const ESTADO = { dono: null, epoca: 0, expiraEm: 0, prazoMs: 60_000, renovarMs: 20_000 };

  it.each([
    ["renovar: época em texto", "renovar", json(200, { ...OK_TRAVA, epoca: "7" })],
    ["renovar: época 0 na aceita", "renovar", json(200, { ...OK_TRAVA, epoca: 0 })],
    ["renovar: renovarMs quebrado", "renovar", json(200, { ...OK_TRAVA, renovarMs: 1.5 })],
    ["renovar: sem ok", "renovar", json(200, { epoca: 7, expiraEm: 1, renovarMs: 20_000 })],
    ["renovar: lista", "renovar", json(200, [OK_TRAVA])],
    ["renovar: null", "renovar", json(200, null)],
    ["pegar: motivo inventado", "pegar", json(409, { ...RECUSA, motivo: "porque_sim" })],
    ["pegar: recusa sem erro", "pegar", json(409, { ...RECUSA, erro: undefined })],
    ["pegar: recusa com ok true no 409", "pegar", json(409, OK_TRAVA)],
    ["pegar: dono em texto", "pegar", json(409, { ...RECUSA, donoPcId: "2" })],
    ["estado: sem renovarMs", "estado", json(200, { ...ESTADO, renovarMs: undefined })],
    ["estado: dono torto", "estado", json(200, { ...ESTADO, dono: { id: "1", nome: "a" } })],
    ["eu: id em texto", "eu", json(200, { id: "1", nome: "pc" })],
    ["grupo: nome número", "grupo", json(200, { nome: 1, endereco_jogar: "x" })],
    ["convite: sem texto", "convite", json(201, { expiraEm: 1 })],
    ["usar: sem token", "usar", json(200, { pacote: PACOTE })],
    [
      "usar: pacote torto",
      "usar",
      json(200, { token: "t", pacote: { ...PACOTE, allowed_ips: "0.0.0.0/0" } }),
    ],
  ])("resposta malformada recusada (%s)", async (_nome, rota, resposta) => {
    const { cliente, chamadas } = montar([resposta, json(200, OK_TRAVA)]);
    const chamar = {
      renovar: () => cliente.renovar(7),
      pegar: () => cliente.pegar(),
      estado: () => cliente.estadoTrava(),
      eu: () => cliente.eu(),
      grupo: () => cliente.grupo(),
      convite: () => cliente.criarConvite("pc"),
      usar: () => cliente.usarConvite("c", "k"),
    }[rota as "renovar"];
    const e = await erroDe(chamar());
    expect(e.tipo).toBe("resposta");
    expect(chamadas).toHaveLength(1); // resposta torta não repete
  });

  it("respostas boas passam pela conferência", async () => {
    const { cliente } = montar([
      json(200, ESTADO),
      json(200, { ...ESTADO, dono: { id: 3, nome: "pc-b" }, epoca: 4 }),
      json(200, { id: 3, nome: "pc-b", dono: false }),
      json(200, [
        { id: 1, nome: "pc-a", dono: true },
        { id: 3, nome: "pc-b", dono: false },
      ]),
      json(200, { ...OK_TRAVA, expiraEm: 0 }),
    ]);
    expect(await cliente.estadoTrava()).toEqual(ESTADO);
    expect((await cliente.estadoTrava()).dono).toEqual({ id: 3, nome: "pc-b" });
    expect(await cliente.eu()).toEqual({ id: 3, nome: "pc-b", dono: false });
    expect(await cliente.listarPcs()).toEqual([
      { id: 1, nome: "pc-a", dono: true },
      { id: 3, nome: "pc-b", dono: false },
    ]);
    expect((await cliente.soltar(7)).ok).toBe(true);
  });

  it("teto estourado recusado: content-length acima de 64 KB nem é lido", async () => {
    let leituras = 0;
    let cancelado = false;
    const corpo = new ReadableStream<Uint8Array>({
      pull(c) {
        leituras += 1;
        c.enqueue(new Uint8Array(1_024).fill(32));
      },
      cancel() {
        cancelado = true;
      },
    });
    const resposta = new Response(corpo, {
      status: 200,
      headers: { "content-length": String(70_000) },
    });
    const { cliente, chamadas } = montar([resposta]);
    const e = await erroDe(cliente.renovar(7));
    expect(e.tipo).toBe("resposta");
    expect(e.message).toMatch(/grande/);
    expect(chamadas).toHaveLength(1);
    expect(cancelado).toBe(true);
    expect(leituras).toBeLessThanOrEqual(1); // só o enchimento inicial do fluxo; ninguém leu o corpo
  });

  it("erro longo do cartório é cortado em 200 caracteres (4xx e recusa da trava)", async () => {
    const longo = "z".repeat(500);
    const { cliente } = montar([json(403, { erro: longo }), json(409, { ...RECUSA, erro: longo })]);
    const e = await erroDe(cliente.criarConvite("pc"));
    expect(e.message).toContain("z".repeat(150));
    expect(e.message).not.toContain("z".repeat(250));
    const recusa = await cliente.pegar();
    if (recusa.ok) throw new Error("esperava recusa");
    expect(recusa.erro.length).toBeLessThanOrEqual(201);
    expect(recusa.erro.endsWith("…")).toBe(true);
  });

  it("convite antigo (só token, sem pacote) é recusado com mensagem clara", async () => {
    const { cliente, chamadas } = montar([json(200, { token: "t-velho" }), json(200, OK_TRAVA)]);
    const e = await erroDe(cliente.usarConvite("c", "k"));
    expect(e.tipo).toBe("resposta");
    expect(e.message).toBe(
      "Este convite é de uma versão antiga do cartório; peça um convite novo ao dono do grupo.",
    );
    expect(chamadas).toHaveLength(1);
  });

  it("teto estourado recusado: corpo sem content-length é contado e cortado", async () => {
    let enviados = 0;
    const corpo = new ReadableStream<Uint8Array>({
      pull(c) {
        enviados += 16_384;
        c.enqueue(new Uint8Array(16_384).fill(32)); // espaços: JSON válido se lido inteiro
        if (enviados > 1_000_000) c.close();
      },
    });
    const { cliente } = montar([new Response(corpo, { status: 200 })]);
    const e = await erroDe(cliente.estadoTrava());
    expect(e.tipo).toBe("resposta");
    expect(e.message).toMatch(/grande/);
    expect(enviados).toBeLessThan(200_000); // parou logo depois do teto, não leu o megabyte
  });

  it("corpo de erro (4xx) também respeita o teto", async () => {
    const { cliente } = montar([json(403, { erro: "y".repeat(70_000) })]);
    const e = await erroDe(cliente.criarConvite("pc"));
    expect(e.tipo).toBe("resposta");
    expect(e.message).not.toContain("yyyy");
  });

  it("nenhuma tentativa depois de cancelar: na espera entre tentativas", async () => {
    const parar = new AbortController();
    const { cliente, chamadas } = montar([json(503, {}), json(200, OK_TRAVA)], {
      esperar: async () => parar.abort(), // soltou/perdeu enquanto esperava a 2ª tentativa
    });
    const e = await erroDe(cliente.renovar(7, parar.signal));
    expect(e.tipo).toBe("cancelado");
    expect(chamadas).toHaveLength(1);
  });

  it("nenhuma tentativa depois de cancelar: já cancelado não envia nada", async () => {
    const parar = new AbortController();
    parar.abort();
    const { cliente, chamadas } = montar([json(200, OK_TRAVA)]);
    expect((await erroDe(cliente.renovar(7, parar.signal))).tipo).toBe("cancelado");
    expect(chamadas).toHaveLength(0);
  });

  it("cancelar aborta a tentativa pendurada e não repete", async () => {
    const parar = new AbortController();
    const { cliente, chamadas } = montar(["pendurar", json(200, OK_TRAVA)], { prazoMs: 60_000 });
    const p = erroDe(cliente.renovar(7, parar.signal));
    await new Promise((ok) => setImmediate(ok));
    parar.abort();
    expect((await p).tipo).toBe("cancelado");
    expect(chamadas).toHaveLength(1);
  });
});

describe("descoberta de fontes (cartmel-2.4)", () => {
  const SHA = "b".repeat(64);
  const VERSAO = {
    numero: 4,
    epoca: 2,
    pcId: 1,
    manifestoSha256: SHA,
    arquivos: 3,
    bytes: 9,
    criadaEm: 5,
  };

  it("maisNova: GET /versoes/mais-nova, com e sem versão", async () => {
    const { cliente, chamadas } = montar([
      json(200, { versao: VERSAO }),
      json(200, { versao: null }),
    ]);
    expect(await cliente.maisNova()).toEqual(VERSAO);
    expect(await cliente.maisNova()).toBeNull();
    expect(chamadas[0]?.url).toBe(`${URL_CARTORIO}/versoes/mais-nova`);
    expect(chamadas[0]?.init.method).toBe("GET");
  });

  it("quemTem: devolve IP de cada PC (ou null) e se a nuvem tem a versão", async () => {
    const corpo = {
      numero: 4,
      nuvem: true,
      pcs: [
        { id: 1, nome: "Ana", ip: "10.66.0.5" },
        { id: 2, nome: "Bia", ip: null },
      ],
    };
    const { cliente, chamadas } = montar([json(200, corpo)]);
    expect(await cliente.quemTem(4)).toEqual(corpo);
    expect(chamadas[0]?.url).toBe(`${URL_CARTORIO}/versoes/4/copias`);
  });

  it.each([
    ["sem o sinalizador da nuvem", { numero: 4, pcs: [] }],
    ["ip que não é texto", { numero: 4, nuvem: false, pcs: [{ id: 1, nome: "Ana", ip: 5 }] }],
    ["hash do manifesto inválido", { versao: { ...VERSAO, manifestoSha256: "xx" } }],
  ])("resposta inválida (%s) vira erro do cartório", async (_nome, corpo) => {
    const { cliente } = montar([json(200, corpo), json(200, corpo)]);
    const p = "versao" in corpo ? cliente.maisNova() : cliente.quemTem(4);
    expect((await erroDe(p)).tipo).toBe("resposta");
  });

  it("IP fora da rede privada devolvido pelo cartório é recusado ao escolher fontes", async () => {
    const { cliente } = montar([
      json(200, { numero: 4, nuvem: false, pcs: [{ id: 1, nome: "Ana", ip: "8.8.8.8" }] }),
    ]);
    const { pcs } = await cliente.quemTem(4);
    expect(() =>
      escolherFontes(
        pcs.map((p) => ({ tipo: "pc" as const, endereco: String(p.ip), porta: PORTA_ESPALHAR })),
      ),
    ).toThrow(/rede privada/);
  });
});

describe("informarCopia", () => {
  it("avisa a versão que este PC tem: POST /copias com a versão, sem corpo na resposta", async () => {
    const { cliente, chamadas } = montar([new Response(null, { status: 204 })]);
    await cliente.informarCopia(7);
    expect(chamadas[0]?.url).toBe(`${URL_CARTORIO}/copias`);
    expect(chamadas[0]?.init.method).toBe("POST");
    expect(JSON.parse(String(chamadas[0]?.init.body))).toEqual({ versao: 7 });
  });

  it("versão que o cartório não conhece (404) vira erro do cartório", async () => {
    const { cliente } = montar([json(404, { erro: "Versão inexistente." })]);
    const e = await erroDe(cliente.informarCopia(99));
    expect(e.tipo).toBe("resposta");
  });
});

describe("trava de atualização (syncmel-1.8b)", () => {
  it("pegar, renovar e soltar vão às rotas de /atualizacao com a época no corpo", async () => {
    const { cliente, chamadas } = montar([
      json(200, OK_TRAVA),
      json(200, OK_TRAVA),
      json(200, OK_TRAVA),
    ]);
    expect(await cliente.pegarAtualizacao()).toEqual(OK_TRAVA);
    expect(await cliente.renovarAtualizacao(7)).toEqual(OK_TRAVA);
    expect(await cliente.soltarAtualizacao(7)).toEqual(OK_TRAVA);
    expect(chamadas.map((c) => c.url.replace(URL_CARTORIO, ""))).toEqual([
      "/atualizacao/pegar",
      "/atualizacao/renovar",
      "/atualizacao/soltar",
    ]);
    expect(chamadas.map((c) => c.init.body)).toEqual([
      undefined,
      JSON.stringify({ epoca: 7 }),
      JSON.stringify({ epoca: 7 }),
    ]);
  });

  it("409 devolve a recusa com o motivo (hospedando), sem donoPcId", async () => {
    const recusa = {
      ok: false,
      erro: "Este PC está hospedando o servidor.",
      motivo: "hospedando",
      epoca: 0,
      expiraEm: 0,
    };
    const { cliente } = montar([json(409, recusa)]);
    expect(await cliente.pegarAtualizacao()).toEqual(recusa);
  });

  it("resposta torta é erro: motivo desconhecido, 200 com ok:false ou 409 com ok:true", async () => {
    const torta = { ok: false, erro: "x", motivo: "ocupada", epoca: 1, expiraEm: 0 };
    for (const r of [
      json(409, torta),
      json(200, { ...torta, motivo: "vencida" }),
      json(409, OK_TRAVA),
    ]) {
      const { cliente } = montar([r]);
      expect((await erroDe(cliente.pegarAtualizacao())).tipo).toBe("resposta");
    }
  });

  it("só renovar repete; pegar e soltar mudam a época e vão uma vez só", async () => {
    const a = montar([json(503, {}), json(200, OK_TRAVA)]);
    expect(await a.cliente.renovarAtualizacao(7)).toEqual(OK_TRAVA);
    expect(a.chamadas).toHaveLength(2);
    const b = montar([json(503, {}), json(200, OK_TRAVA)]);
    await erroDe(b.cliente.pegarAtualizacao());
    expect(b.chamadas).toHaveLength(1);
    const c = montar([semRede(), json(200, OK_TRAVA)]);
    await erroDe(c.cliente.soltarAtualizacao(7));
    expect(c.chamadas).toHaveLength(1);
  });

  it("renovar cancelado pelo sinal não tenta de novo", async () => {
    const parar = new AbortController();
    parar.abort();
    const { cliente, chamadas } = montar([json(200, OK_TRAVA)]);
    expect((await erroDe(cliente.renovarAtualizacao(7, parar.signal))).tipo).toBe("cancelado");
    expect(chamadas).toHaveLength(0);
  });
});
