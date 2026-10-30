import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { ErroCartorio, criarCliente, type OpcoesCliente } from "./cliente.js";
import { cofreEmMemoria } from "./cofre.js";

const TOKEN = randomBytes(16).toString("hex"); // gerado a cada execução
const URL_CARTORIO = "http://10.8.0.1:7070";

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

  it.each(["http://203.0.113.5:7070", "ftp://10.8.0.1", "http://cartorio.exemplo"])(
    "recusa endereço inseguro %s",
    (url) => {
      expect(() => criarCliente({ url, cofre: cofreEmMemoria() })).toThrow(/https/);
    },
  );

  it.each([
    "https://cartorio.exemplo",
    "http://127.0.0.1:1",
    "http://192.168.0.9",
    "http://[fd00::1]",
  ])("aceita %s", (url) => {
    expect(() => criarCliente({ url, cofre: cofreEmMemoria() })).not.toThrow();
  });
});
