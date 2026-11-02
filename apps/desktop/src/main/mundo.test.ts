import { existsSync, mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hashesDoMundo } from "../../../../packages/nucleo/test/ajuda/mundos.js";
import { escreverRegiao } from "../../../../packages/nucleo/test/ajuda/regiao-mca.js";
import { MARCADOR_VERSAO_PENDENTE } from "@sabrehosting/nucleo/servidor/configurar";
import { ErroCartorio } from "@sabrehosting/nucleo/cartorio/cliente";
import { TEXTO_DEMONSTRACAO } from "./demonstracao.js";
import { algoMexendoNoMundo, criarMundo } from "./mundo.js";

const pastas: string[] = [];
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

const AREA = { tipo: "retangulo", x1: 0, z1: 0, x2: 1, z2: 0 };

/** Mundo inventado + cartório falso; `est` e `ev` deixam o teste ver e mexer no que o cartório faz. */
function cenario(sobre: { dono?: boolean; semBackups?: boolean } = {}) {
  const base = mkdtempSync(join(tmpdir(), "sabre-mundo-"));
  pastas.push(base);
  const servidor = join(base, "servidor");
  const mundo = join(servidor, "mundo");
  const backups = join(base, "backups");
  mkdirSync(backups);
  mkdirSync(mundo, { recursive: true });
  writeFileSync(join(mundo, "level.dat"), "level-falso");
  for (const t of ["region", "entities", "poi"])
    escreverRegiao(join(mundo, t, "r.0.0.mca"), [0, 1, 33, 500], undefined, 8);
  const antes = hashesDoMundo(mundo);
  const ev: string[] = [];
  const est = {
    ultimo: 7,
    fora: false,
    criar: 0,
    maisNova: null as null | { numero: number; manifestoSha256: string },
    portao: undefined as undefined | Promise<void>,
    profundidade: 0,
    maxima: 0,
    estadoTrava: undefined as undefined | (() => Promise<{ epoca: number }>),
  };
  const cai = () => {
    if (est.fora) throw new ErroCartorio("sem resposta", "rede");
  };
  const ok = { ok: true as const, epoca: 3, expiraEm: 0, renovarMs: 20_000 };
  const cliente = {
    pegar: async () => {
      ev.push("pegar");
      est.maxima = Math.max(est.maxima, ++est.profundidade);
      await est.portao;
      return ok;
    },
    renovar: async () => ok,
    soltar: async () => (ev.push("soltar"), est.profundidade--, ok),
    estadoTrava: async () => (est.estadoTrava ? est.estadoTrava() : { epoca: 3 }),
    ultimoRegistrado: async () => (cai(), est.ultimo),
    maisNova: async () => (cai(), est.maisNova as never),
    criarVersao: async () => (cai(), est.criar++, ++est.ultimo),
    enviarPacote: async () => cai(),
  };
  const o = {
    demonstracao: false,
    rodando: false,
    ocupado: false,
    dono: sobre.dono ?? true,
    euCaiu: false,
    eus: 0,
    orfao: undefined as undefined | (() => Promise<boolean>),
  };
  const m = criarMundo({
    demo: { ativa: () => o.demonstracao },
    eu: async () => {
      o.eus++;
      if (o.euCaiu) throw new Error("sem cartório");
      return { dono: o.dono };
    },
    ocupado: () => o.ocupado,
    pastaBackups: sobre.semBackups ? undefined : backups,
    pastaDoMundo: mundo,
    pastaDoServidor: servidor,
    cliente,
    servidorRodando: () => o.rodando,
    servidorOrfao: () => (o.orfao ? o.orfao() : Promise.resolve(false)),
  });
  const marca = join(servidor, MARCADOR_VERSAO_PENDENTE);
  const nada = () => {
    // Recusa de verdade: mundo igual, nenhum backup novo, nenhuma troca de versão, nenhum aviso gravado.
    expect(hashesDoMundo(mundo)).toEqual(antes);
    expect(readdirSync(backups)).toEqual([]);
    expect(est.criar).toBe(0);
    expect(existsSync(marca)).toBe(false);
  };
  return { m, o, ev, est, cliente, mundo, servidor, backups, antes, marca, nada };
}

describe("mundo: recusas no main (nenhuma escreve no mundo)", () => {
  it("demonstração: planejar, resetar, desfazer e descartar recusam sem ler o mundo nem falar com o cartório", async () => {
    const c = cenario();
    c.o.demonstracao = true;
    const recusa = { ok: false, mensagem: TEXTO_DEMONSTRACAO };
    expect(await c.m.planejar("overworld", AREA)).toEqual(recusa);
    expect(await c.m.resetar("overworld", AREA)).toEqual(recusa);
    expect(await c.m.desfazer(true)).toEqual(recusa);
    expect(await c.m.descartar(true)).toEqual(recusa);
    expect(c.o.eus).toBe(0);
    expect(c.ev).toEqual([]);
    c.nada();
  });

  it("PC que não é o dono recusa tudo (planejar, resetar, desfazer, descartar)", async () => {
    const c = cenario({ dono: false });
    for (const r of [
      await c.m.planejar("overworld", AREA),
      await c.m.resetar("overworld", AREA),
      await c.m.desfazer(true),
      await c.m.descartar(true),
    ]) {
      expect(r).toMatchObject({ ok: false, mensagem: expect.stringContaining("dono") });
    }
    expect(c.ev).toEqual([]);
    c.nada();
  });

  it("sem conseguir saber quem é o dono (cartório fora): recusa", async () => {
    const c = cenario();
    c.o.euCaiu = true;
    expect(await c.m.resetar("overworld", AREA)).toMatchObject({ ok: false });
    expect(c.ev).toEqual([]);
    c.nada();
  });

  it("servidor rodando: recusa sem pegar a vez", async () => {
    const c = cenario();
    c.o.rodando = true;
    const r = await c.m.resetar("overworld", AREA);
    expect(r).toMatchObject({ ok: false, mensagem: expect.stringContaining("servidor") });
    expect(c.ev).toEqual([]);
    c.nada();
  });

  it("sem a trava deste PC: recusa, não deixa aviso de versão e não mexe no mundo", async () => {
    const c = cenario();
    c.cliente.pegar = async () => {
      throw new Error("outro PC hospeda");
    };
    const r = await c.m.resetar("overworld", AREA);
    expect(r).toMatchObject({ ok: false, mensagem: expect.stringContaining("vez de hospedar") });
    c.nada();
    expect(c.m.ocupado()).toBe(false); // soltou a flag: dá para tentar de novo
  });

  it("backup, restauração ou troca de versão em andamento: recusa", async () => {
    const c = cenario();
    c.o.ocupado = true;
    const r = await c.m.resetar("overworld", AREA);
    expect(r).toMatchObject({ ok: false, mensagem: expect.stringContaining("backup") });
    expect(c.ev).toEqual([]);
    c.nada();
  });

  it("outro reset em andamento: o segundo recusa e a flag sobe antes de qualquer espera", async () => {
    const c = cenario();
    let abrir: () => void = () => undefined;
    c.est.portao = new Promise<void>((ok) => (abrir = ok));
    const primeiro = c.m.resetar("overworld", AREA);
    expect(c.m.ocupado()).toBe(true);
    const segundo = await c.m.resetar("overworld", AREA);
    expect(segundo).toMatchObject({ ok: false, mensagem: expect.stringContaining("andamento") });
    expect(await c.m.desfazer(true)).toMatchObject({ ok: false });
    abrir();
    expect(await primeiro).toMatchObject({ ok: true });
    expect(c.m.ocupado()).toBe(false);
  });

  it("versão pendente (aviso ao lado do mundo): recusa e o aviso fica", async () => {
    const c = cenario();
    writeFileSync(c.marca, JSON.stringify({ formato: 1, fase: "mundo-trocando" }));
    const r = await c.m.resetar("overworld", AREA);
    expect(r).toMatchObject({ ok: false, mensagem: expect.stringContaining("pendente") });
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
    expect(readdirSync(c.backups)).toEqual([]);
    expect(existsSync(c.marca)).toBe(true);
  });

  it("área torta, dimensão torta, área grande sem confirmar e área vazia recusam antes de gravar o aviso", async () => {
    const c = cenario();
    for (const [dim, area] of [
      ["overworld", { tipo: "raio", x: 0, z: 0, raio: "x" }],
      ["lua", AREA],
      ["overworld", { tipo: "retangulo", x1: 0, z1: 0, x2: 5000, z2: 5000 }],
      ["overworld", { tipo: "retangulo", x1: 90, z1: 90, x2: 91, z2: 91 }],
    ] as const) {
      expect(await c.m.resetar(dim, area)).toMatchObject({ ok: false });
    }
    c.nada();
  });
});

describe("mundo: o reset de verdade", () => {
  it("planejar só lê: devolve o plano e não escreve nada", async () => {
    const c = cenario();
    const r = await c.m.planejar("overworld", AREA);
    expect(r).toMatchObject({ ok: true, plano: { chunksExistentes: 2 } });
    expect(c.ev).toEqual([]);
    c.nada();
  });

  it("faz UM backup antes-de-resetar, troca o mundo e publica N+1 com a vez pega uma vez por etapa (sem vez aninhada)", async () => {
    const c = cenario();
    const r = await c.m.resetar("overworld", AREA);
    expect(r).toMatchObject({ ok: true, publicacao: { estado: "publicada", versao: 8 } });
    expect(hashesDoMundo(c.mundo)).not.toEqual(c.antes);
    const pacotes = readdirSync(c.backups).sort();
    expect(pacotes).toHaveLength(2); // o do reset (antes) e o da versão nova
    expect(c.ev).toEqual(["pegar", "soltar", "pegar", "soltar"]); // reset, depois publicação, em sequência
    expect(c.est.maxima).toBe(1);
    expect(existsSync(c.marca)).toBe(false);
    expect(c.est.criar).toBe(1);
  });

  it("cartório fora na publicação: o reset vale e a versão fica pendente com aviso", async () => {
    const c = cenario();
    const base = c.cliente.criarVersao;
    c.cliente.criarVersao = async () => {
      c.est.fora = true;
      return base();
    };
    const r = await c.m.resetar("overworld", AREA);
    expect(r).toMatchObject({ ok: true, publicacao: { estado: "pendente" } });
    expect(existsSync(c.marca)).toBe(true);
    expect(await c.m.estado()).toMatchObject({ dono: true, pendencia: "aguardando" });
  });

  it("falha dentro do reset: texto fixo, sem caminho cru", async () => {
    const c = cenario();
    c.est.estadoTrava = async () => {
      throw new Error("ENOENT: no such file '/home/amigo/segredo/mundo'");
    };
    const r = await c.m.resetar("overworld", AREA);
    expect(r.ok).toBe(false);
    expect(JSON.stringify(r)).not.toMatch(/\/home|segredo|ENOENT/);
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
  });

  it("desfazer devolve o mundo antigo e publica N+1; recusa com servidor rodando", async () => {
    const c = cenario();
    await c.m.resetar("overworld", AREA);
    c.o.rodando = true;
    expect(await c.m.desfazer(false)).toMatchObject({ ok: false });
    c.o.rodando = false;
    const r = await c.m.desfazer(false);
    expect(r).toMatchObject({ ok: true, feito: true, publicacao: { estado: "publicada" } });
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
  });
});

describe("mundo: pendência (conflito só sai por descartar com confirmação)", () => {
  async function comConflito() {
    const c = cenario();
    c.est.fora = true; // reset feito, cartório fora: fica pendente (sem cartório o número é chutado: 1)
    expect(await c.m.resetar("overworld", AREA)).toMatchObject({ ok: true });
    c.est.fora = false;
    c.est.ultimo = 1; // outro PC já registrou essa versão com outro conteúdo
    c.est.maisNova = { numero: 1, manifestoSha256: "0".repeat(64) };
    return c;
  }

  it("retomar vira conflito, mantém o aviso e não registra nada", async () => {
    const c = await comConflito();
    expect(await c.m.retomar()).toMatchObject({ ok: true, estado: "conflito" });
    expect(await c.m.estado()).toMatchObject({ dono: true, pendencia: "conflito" });
    expect(existsSync(c.marca)).toBe(true);
    expect(c.est.criar).toBe(0);
  });

  it("descartar exige `confirmado === true`; só então tira o aviso (nunca mundo nem backup)", async () => {
    const c = await comConflito();
    await c.m.retomar();
    const mundoDepois = hashesDoMundo(c.mundo);
    const backups = readdirSync(c.backups).sort();
    for (const falso of [undefined, false, "true", 1]) {
      expect(await c.m.descartar(falso)).toMatchObject({ ok: false });
      expect(existsSync(c.marca)).toBe(true);
    }
    expect(await c.m.descartar(true)).toEqual({ ok: true });
    expect(existsSync(c.marca)).toBe(false);
    expect(await c.m.estado()).toMatchObject({ pendencia: "nenhuma" });
    expect(hashesDoMundo(c.mundo)).toEqual(mundoDepois);
    expect(readdirSync(c.backups).sort()).toEqual(backups);
  });

  it("retomar sem pendência não faz nada", async () => {
    const c = cenario();
    expect(await c.m.retomar()).toEqual({ ok: true, estado: "nada" });
    expect(c.ev).toEqual([]);
  });

  it("retomar de reset que parou antes de publicar conclui a versão", async () => {
    const c = cenario();
    writeFileSync(c.marca, JSON.stringify({ formato: 1, fase: "mundo-trocando" }));
    expect(await c.m.retomar()).toMatchObject({ ok: true, estado: "publicada", versao: 8 });
    expect(existsSync(c.marca)).toBe(false);
  });
});

describe("mundo: antes de hospedar", () => {
  it("com reset em curso barra o Hospedar", async () => {
    const c = cenario();
    let abrir: () => void = () => undefined;
    c.est.portao = new Promise<void>((ok) => (abrir = ok));
    const reset = c.m.resetar("overworld", AREA);
    expect(await c.m.antesDeHospedar()).toMatchObject({ ok: false });
    abrir();
    await reset;
  });

  it("com versão pendente que não conclui (conflito) barra; sem pendência deixa passar", async () => {
    const c = cenario();
    expect(await c.m.antesDeHospedar()).toBeUndefined();
    c.est.fora = true;
    await c.m.resetar("overworld", AREA);
    c.est.fora = false;
    c.est.ultimo = 1;
    c.est.maisNova = { numero: 1, manifestoSha256: "0".repeat(64) };
    expect(await c.m.antesDeHospedar()).toMatchObject({
      ok: false,
      mensagem: expect.stringContaining("Outro PC"),
    });
    expect(existsSync(c.marca)).toBe(true);
  });

  it("pendência que o cartório já pode concluir é concluída e libera o Hospedar", async () => {
    const c = cenario();
    writeFileSync(c.marca, JSON.stringify({ formato: 1, fase: "mundo-trocando" }));
    expect(await c.m.antesDeHospedar()).toBeUndefined();
    expect(existsSync(c.marca)).toBe(false);
  });
});

describe("mundo: cruzamentos, texto seguro e bordas (devolução do qa)", () => {
  it("servidor órfão vivo (ou sem saber se há) recusa sem pegar a vez", async () => {
    for (const orfao of [async () => true, async () => Promise.reject(new Error("x"))]) {
      const c = cenario();
      c.o.orfao = orfao;
      expect(await c.m.resetar("overworld", AREA)).toMatchObject({
        ok: false,
        mensagem: expect.stringContaining("servidor"),
      });
      expect(c.ev).toEqual([]);
      c.nada();
    }
  });

  it("planejar: área grande só passa com `confirmado === true` (valor torto não vale)", async () => {
    const c = cenario();
    const grande = { tipo: "retangulo", x1: 0, z1: 0, x2: 100, z2: 100 };
    expect(await c.m.planejar("overworld", grande)).toMatchObject({
      ok: false,
      chunksNaArea: 10201,
    });
    expect(await c.m.planejar("overworld", grande, "sim")).toMatchObject({ ok: false });
    expect(await c.m.planejar("overworld", grande, true)).toMatchObject({ ok: true });
    c.nada();
  });

  it("erro cru (TypeError, IP:porta) nunca vai para a tela; texto conhecido do núcleo passa", async () => {
    for (const erro of [
      new TypeError("Cannot read properties of undefined (reading 'x')"),
      new Error("ECONNREFUSED 10.0.0.1:25565"),
      new Error("falha em 10.0.0.1:25565"),
    ]) {
      const c = cenario();
      c.est.estadoTrava = async () => {
        throw erro;
      };
      const r = await c.m.resetar("overworld", AREA);
      expect(r).toMatchObject({ ok: false });
      expect(JSON.stringify(r)).not.toMatch(/TypeError|undefined|ECONN|10\.0\.0\.1|reading/);
      // não afirma mais do que sabe
      expect((r as { mensagem: string }).mensagem).toMatch(/conferido ao abrir o app/);
    }
    const c = cenario();
    const conhecido = "Não consegui fazer o backup antes de resetar; o mundo não foi alterado.";
    c.est.estadoTrava = async () => {
      throw new Error(conhecido);
    };
    expect(await c.m.resetar("overworld", AREA)).toEqual({ ok: false, mensagem: conhecido });
  });

  it("sem pasta de backups não há pendência: retomar, estado e antesDeHospedar não barram", async () => {
    const c = cenario({ semBackups: true });
    expect(await c.m.retomar()).toEqual({ ok: true, estado: "nada" });
    expect(await c.m.estado()).toMatchObject({ dono: true, pendencia: "nenhuma" });
    expect(await c.m.antesDeHospedar()).toBeUndefined();
  });

  it("algoMexendoNoMundo: qualquer uma das operações basta", () => {
    const todas = {
      restaurando: false,
      trocandoVersao: false,
      fazendoBackup: false,
      importando: false,
      atualizando: false,
      agendaOcupada: false,
    };
    const f = (v: Partial<typeof todas>) =>
      algoMexendoNoMundo(
        Object.fromEntries(
          Object.entries({ ...todas, ...v }).map(([k, x]) => [k, () => x]),
        ) as never,
      );
    expect(f({})).toBe(false);
    for (const k of Object.keys(todas)) expect(f({ [k]: true })).toBe(true);
  });
});

describe("mundo: o que a tela Mundo lê (chunk-1.6)", () => {
  it("estado traz o nome do mundo (só a pasta) e se o servidor está ligado", async () => {
    const c = cenario();
    expect(await c.m.estado()).toEqual({
      dono: true,
      pendencia: "nenhuma",
      nome: "mundo",
      servidorLigado: false,
    });
    c.o.rodando = true;
    expect(await c.m.estado()).toMatchObject({ servidorLigado: true });
    c.o.rodando = false;
    c.o.orfao = async () => true; // servidor de uma sessão anterior ainda vivo conta como ligado
    expect(await c.m.estado()).toMatchObject({ servidorLigado: true });
  });

  it("quem não é dono não recebe nome nem controles; demonstração avisa para a tela mostrar a recusa", async () => {
    const outro = cenario({ dono: false });
    expect(await outro.m.estado()).toEqual({ dono: false });
    const demo = cenario();
    demo.o.demonstracao = true;
    expect(await demo.m.estado()).toEqual({ dono: false, demonstracao: true });
    expect(demo.o.eus).toBe(0);
  });

  it("regioes: só números da dimensão (sem caminho), com os chunks de cada região do terreno", async () => {
    const c = cenario();
    escreverRegiao(join(c.mundo, "region", "r.1.-1.mca"), [5], undefined, 2);
    const r = await c.m.regioes("overworld");
    expect(r).toMatchObject({ ok: true });
    if (!r.ok) throw new Error("esperava ok");
    expect(r.regioes).toEqual([
      { x: 0, z: 0, chunks: 4 },
      { x: 1, z: -1, chunks: 1 },
    ]);
    expect(JSON.stringify(r)).not.toContain(c.mundo);
    expect(typeof r.tamanhoMundo === "number" || r.tamanhoMundo === undefined).toBe(true);
  });

  it("regioes: dimensão sem pasta é lista vazia; dimensão inválida, não-dono e demonstração recusam", async () => {
    const c = cenario();
    expect(await c.m.regioes("nether")).toMatchObject({ ok: true, regioes: [] });
    expect(await c.m.regioes("lua")).toMatchObject({ ok: false });
    c.o.dono = false;
    expect(await c.m.regioes("overworld")).toMatchObject({
      ok: false,
      mensagem: expect.stringContaining("dono"),
    });
    c.o.dono = true;
    c.o.demonstracao = true;
    expect(await c.m.regioes("overworld")).toEqual({ ok: false, mensagem: TEXTO_DEMONSTRACAO });
    c.nada();
  });
});
