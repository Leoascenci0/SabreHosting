import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hashesDoMundo } from "../../test/ajuda/mundos.js";
import { escreverRegiao } from "../../test/ajuda/regiao-mca.js";
import { nomeDoBackup } from "../backup/agendador.js";
import { listarBackups } from "../backup/listar.js";
import { criarPacote } from "../backup/pacote.js";
import { restaurarBackup } from "../backup/restaurar.js";
import { ErroCartorio } from "../cartorio/cliente.js";
import { hashDoArquivo } from "../integridade/hash.js";
import { MARCADOR_VERSAO_PENDENTE, podeSubir } from "../servidor/configurar.js";
import { resetarMundo } from "./resetar.js";
import {
  desfazerUltimoReset,
  publicarVersaoDoMundo,
  retomarVersaoPendente,
  type ClienteVersao,
} from "./versao-reset.js";

const pastas: string[] = [];
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

/** Cartório falso: conta chamadas e pode "cair". Só o que o núcleo usa. */
function cartorioFalso(inicial = 7) {
  const est = {
    ultimo: inicial,
    guardada: inicial,
    fora: false,
    criar: 0,
    enviar: 0,
    caiNoEnvio: false,
    manifestos: [] as string[],
    enviados: [] as { n: number; sha: string }[],
  };
  const cai = () => {
    if (est.fora)
      throw new ErroCartorio("Sem resposta do cartório (rede ou tempo esgotado).", "rede");
  };
  const cliente: ClienteVersao = {
    ultimoRegistrado: async () => (cai(), est.ultimo),
    maisNova: async () => (
      cai(),
      est.guardada === 0
        ? null
        : {
            numero: est.guardada,
            epoca: 3,
            pcId: 1,
            manifestoSha256: "0".repeat(64),
            arquivos: 1,
            bytes: 1,
            criadaEm: 1,
          }
    ),
    criarVersao: async (_e, d) => (
      cai(),
      est.criar++,
      est.manifestos.push(d.manifestoSha256),
      ++est.ultimo
    ),
    enviarPacote: async (n, _e, p) => {
      cai();
      if (est.caiNoEnvio) throw new ErroCartorio("caiu", "rede");
      est.enviar++;
      est.guardada = n;
      est.enviados.push({ n, sha: p.sha256 });
    },
  };
  return { cliente, est };
}

/** Mundo inventado + reset já feito (backup antes-de-resetar v7). */
async function cenario() {
  const base = mkdtempSync(join(tmpdir(), "sabre-versao-reset-"));
  pastas.push(base);
  const servidor = join(base, "servidor");
  const mundo = join(servidor, "mundo");
  const pastaBackups = join(base, "backups");
  mkdirSync(join(mundo, "playerdata"), { recursive: true });
  mkdirSync(pastaBackups);
  writeFileSync(join(mundo, "level.dat"), "level-falso");
  writeFileSync(join(mundo, "playerdata", "abc.dat"), "jogador-falso");
  for (const t of ["region", "entities", "poi"]) {
    escreverRegiao(join(mundo, t, "r.0.0.mca"), [0, 1, 33, 500], undefined, 8);
  }
  const antes = hashesDoMundo(mundo);
  const trava = { tem: true };
  const base_ = {
    pastaDoMundo: mundo,
    pastaDoServidor: servidor,
    pastaBackups,
    epoca: 3,
    temTrava: async () => trava.tem,
    servidorParado: () => true,
  };
  await resetarMundo({
    ...base_,
    dimensao: "overworld",
    area: { tipo: "retangulo", x1: 0, z1: 0, x2: 1, z2: 0 },
    versao: 7,
    agora: () => new Date("2026-11-02T10:00:00.000Z"),
  });
  const depoisDoReset = hashesDoMundo(mundo);
  const restaurar = async (nome: string) => {
    const alvo = (await listarBackups(pastaBackups)).find((b) => b.nome === nome);
    if (!alvo) throw new Error("sem backup");
    await restaurarBackup({
      pacote: alvo.caminho,
      sha256: await hashDoArquivo(alvo.caminho),
      pastaDoMundo: mundo,
      pastaBackups,
      pastaDoServidor: servidor,
      temTrava: base_.temTrava,
      servidorParado: base_.servidorParado,
      versao: Math.max(0, ...(await listarBackups(pastaBackups)).map((b) => b.versao)),
      epoca: 3,
    });
  };
  return { base, servidor, mundo, pastaBackups, antes, depoisDoReset, trava, o: base_, restaurar };
}

const marcador = (servidor: string) => join(servidor, MARCADOR_VERSAO_PENDENTE);

describe("publicarVersaoDoMundo", () => {
  it("sobe a versão UMA vez e guarda o pacote como backup local da versão nova", async () => {
    const c = await cenario();
    const { cliente, est } = cartorioFalso(7);
    const r = await publicarVersaoDoMundo({ ...c.o, cliente });
    expect(r).toEqual({ estado: "publicada", versao: 8 });
    expect(est.criar).toBe(1);
    expect(est.enviar).toBe(1);
    expect(est.enviados[0]?.n).toBe(8);
    expect(est.manifestos[0]).toMatch(/^[0-9a-f]{64}$/);
    const lista = await listarBackups(c.pastaBackups);
    expect(Math.max(...lista.map((b) => b.versao))).toBe(8);
    expect(existsSync(marcador(c.servidor))).toBe(false);
  });

  it("sem cartório: o reset fica local, grava o marcador, avisa e bloqueia o servidor", async () => {
    const c = await cenario();
    const { cliente, est } = cartorioFalso(7);
    est.fora = true;
    const r = await publicarVersaoDoMundo({ ...c.o, cliente });
    expect(r.estado).toBe("pendente");
    if (r.estado === "pendente") expect(r.aviso).toMatch(/ainda não foi espalhada/i);
    expect(est.criar).toBe(0);
    expect(existsSync(marcador(c.servidor))).toBe(true);
    expect(hashesDoMundo(c.mundo)).toEqual(c.depoisDoReset); // mundo local intacto
    writeFileSync(join(c.servidor, "eula.txt"), "eula=true\n");
    const pode = await podeSubir(c.servidor);
    expect(pode.pode).toBe(false);
    expect(pode.motivo).toMatch(/ainda não foi espalhad/i);
    expect(pode.motivo).not.toContain(c.base);
  });

  it("recusa com servidor rodando ou sem trava, sem escrever nada", async () => {
    const c = await cenario();
    const { cliente, est } = cartorioFalso(7);
    const antes = readdirSync(c.pastaBackups).sort();
    await expect(
      publicarVersaoDoMundo({ ...c.o, cliente, servidorParado: () => false }),
    ).rejects.toThrow(/servidor está rodando/);
    c.trava.tem = false;
    await expect(publicarVersaoDoMundo({ ...c.o, cliente, prazoTravaMs: 50 })).rejects.toThrow(
      /trava/,
    );
    expect(readdirSync(c.pastaBackups).sort()).toEqual(antes);
    expect(est.criar).toBe(0);
    expect(existsSync(marcador(c.servidor))).toBe(false);
  });
});

describe("retomarVersaoPendente", () => {
  async function pendente() {
    const c = await cenario();
    const f = cartorioFalso(7);
    f.est.fora = true;
    await publicarVersaoDoMundo({ ...c.o, cliente: f.cliente });
    f.est.fora = false;
    return { c, ...f };
  }

  it("publica o pendente uma vez só e apaga o marcador", async () => {
    const { c, cliente, est } = await pendente();
    const r = await retomarVersaoPendente({ ...c.o, cliente });
    expect(r).toEqual({ estado: "publicada", versao: 8 });
    expect(est.criar).toBe(1);
    expect(est.enviar).toBe(1);
    expect(existsSync(marcador(c.servidor))).toBe(false);
    expect(await retomarVersaoPendente({ ...c.o, cliente })).toEqual({ estado: "nada" });
    expect(est.criar).toBe(1);
  });

  it("registro órfão (caiu no envio): a retomada só envia, não registra de novo", async () => {
    const c = await cenario();
    const { cliente, est } = cartorioFalso(7);
    est.caiNoEnvio = true;
    const r = await publicarVersaoDoMundo({ ...c.o, cliente });
    expect(r.estado).toBe("pendente");
    expect(est.criar).toBe(1);
    est.caiNoEnvio = false;
    await retomarVersaoPendente({ ...c.o, cliente });
    expect(est.criar).toBe(1);
    expect(est.enviar).toBe(1);
    expect(est.guardada).toBe(8);
    expect(existsSync(marcador(c.servidor))).toBe(false);
  });

  it("cartório ainda fora: continua pendente e não apaga o marcador", async () => {
    const { c, cliente, est } = await pendente();
    est.fora = true;
    const r = await retomarVersaoPendente({ ...c.o, cliente });
    expect(r.estado).toBe("pendente");
    expect(existsSync(marcador(c.servidor))).toBe(true);
  });

  it("versão do cartório que não bate recusa e mantém o marcador", async () => {
    const { c, cliente, est } = await pendente();
    est.ultimo = 12;
    await expect(retomarVersaoPendente({ ...c.o, cliente })).rejects.toThrow(/não bate/);
    expect(est.criar).toBe(0);
    expect(existsSync(marcador(c.servidor))).toBe(true);
  });

  it("marcador adulterado não publica nem apaga nada fora", async () => {
    const { c, cliente, est } = await pendente();
    const original = JSON.parse(readFileSync(marcador(c.servidor), "utf8")) as Record<
      string,
      unknown
    >;
    const fora = join(c.base, "fora.tar.gz");
    writeFileSync(fora, "dados");
    const adulterados: unknown[] = [
      { ...original, pacote: fora },
      { ...original, pacote: "../fora.tar.gz" },
      { ...original, pacote: "nao-e-pacote.txt" },
      { ...original, sha256: "a".repeat(64) },
      { ...original, versao: -1 },
      { ...original, versao: "8" },
    ];
    for (const m of adulterados) {
      writeFileSync(marcador(c.servidor), JSON.stringify(m));
      await expect(retomarVersaoPendente({ ...c.o, cliente })).rejects.toThrow(
        /marcador|pendente/i,
      );
    }
    writeFileSync(marcador(c.servidor), "{torto");
    await expect(retomarVersaoPendente({ ...c.o, cliente })).rejects.toThrow(
      /ilegível|fora do esperado/,
    );
    expect(est.criar).toBe(0);
    expect(est.enviar).toBe(0);
    expect(readFileSync(fora, "utf8")).toBe("dados");
    expect(existsSync(marcador(c.servidor))).toBe(true);
    for (const b of await listarBackups(c.pastaBackups)) expect(existsSync(b.caminho)).toBe(true);
  });
});

describe("desfazerUltimoReset", () => {
  it("devolve o mundo byte a byte, faz backup do atual antes e sobe UMA versão nova", async () => {
    const c = await cenario();
    const { cliente, est } = cartorioFalso(7);
    await publicarVersaoDoMundo({ ...c.o, cliente }); // versão 8 do reset
    const r = await desfazerUltimoReset({ ...c.o, cliente, restaurar: c.restaurar });
    expect(r.feito).toBe(true);
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
    const lista = await listarBackups(c.pastaBackups);
    expect(lista.some((b) => b.origem === "antes-de-restaurar")).toBe(true);
    expect(est.criar).toBe(2); // 1 do reset + 1 do desfazer
    expect(est.guardada).toBe(9); // sempre sobe: versão nunca volta
    expect(Math.max(...lista.map((b) => b.versao))).toBe(9);
  });

  it("sem reset anterior recusa", async () => {
    const c = await cenario();
    for (const b of await listarBackups(c.pastaBackups)) rmSync(b.caminho);
    const { cliente } = cartorioFalso(7);
    await expect(desfazerUltimoReset({ ...c.o, cliente, restaurar: c.restaurar })).rejects.toThrow(
      /Não há reset para desfazer/,
    );
  });

  it("já desfeito recusa; o mundo e o cartório não mudam", async () => {
    const c = await cenario();
    const { cliente, est } = cartorioFalso(7);
    await publicarVersaoDoMundo({ ...c.o, cliente });
    await desfazerUltimoReset({ ...c.o, cliente, restaurar: c.restaurar });
    const h = hashesDoMundo(c.mundo);
    const criar = est.criar;
    await expect(desfazerUltimoReset({ ...c.o, cliente, restaurar: c.restaurar })).rejects.toThrow(
      /já foi desfeito/,
    );
    expect(hashesDoMundo(c.mundo)).toEqual(h);
    expect(est.criar).toBe(criar);
  });

  it("jogado depois: sem confirmar devolve o plano e não escreve; confirmado segue", async () => {
    const c = await cenario();
    const { cliente, est } = cartorioFalso(7);
    await publicarVersaoDoMundo({ ...c.o, cliente });
    // Jogaram depois do reset: backup novo da versão 9.
    await criarPacote(c.mundo, join(c.pastaBackups, nomeDoBackup(new Date(), 9)), {
      versao: 9,
      epoca: 3,
      origem: "manual",
    });
    const h = hashesDoMundo(c.mundo);
    const nomes = readdirSync(c.pastaBackups).sort();
    const r = await desfazerUltimoReset({ ...c.o, cliente, restaurar: c.restaurar });
    expect(r.feito).toBe(false);
    expect(r.plano.jogadoDepois).toBe(true);
    expect(hashesDoMundo(c.mundo)).toEqual(h);
    expect(readdirSync(c.pastaBackups).sort()).toEqual(nomes);
    expect(est.criar).toBe(1);
    const r2 = await desfazerUltimoReset({
      ...c.o,
      cliente,
      restaurar: c.restaurar,
      confirmado: true,
    });
    expect(r2.feito).toBe(true);
    expect(hashesDoMundo(c.mundo)).toEqual(c.antes);
  });

  it("versão do cartório mais nova que a do reset também conta como jogado depois", async () => {
    const c = await cenario();
    const { cliente, est } = cartorioFalso(7);
    await publicarVersaoDoMundo({ ...c.o, cliente });
    est.ultimo = 10; // outro PC hospedou e registrou
    const r = await desfazerUltimoReset({ ...c.o, cliente, restaurar: c.restaurar });
    expect(r.feito).toBe(false);
    expect(r.plano.jogadoDepois).toBe(true);
  });

  it("recusa com servidor rodando, sem trava, ou com reset ainda pendente", async () => {
    const c = await cenario();
    const { cliente, est } = cartorioFalso(7);
    await publicarVersaoDoMundo({ ...c.o, cliente });
    const h = hashesDoMundo(c.mundo);
    await expect(
      desfazerUltimoReset({ ...c.o, cliente, restaurar: c.restaurar, servidorParado: () => false }),
    ).rejects.toThrow(/servidor está rodando/);
    c.trava.tem = false;
    await expect(
      desfazerUltimoReset({ ...c.o, cliente, restaurar: c.restaurar, prazoTravaMs: 50 }),
    ).rejects.toThrow(/trava/);
    c.trava.tem = true;
    writeFileSync(marcador(c.servidor), "{}");
    await expect(desfazerUltimoReset({ ...c.o, cliente, restaurar: c.restaurar })).rejects.toThrow(
      /ainda não foi espalhad/,
    );
    expect(hashesDoMundo(c.mundo)).toEqual(h);
    expect(est.criar).toBe(1);
  });

  it("mensagens de erro não trazem caminho cru", async () => {
    const c = await cenario();
    const { cliente } = cartorioFalso(7);
    const falhas: string[] = [];
    for (const f of [
      () =>
        desfazerUltimoReset({
          ...c.o,
          cliente,
          restaurar: c.restaurar,
          servidorParado: () => false,
        }),
      () =>
        retomarVersaoPendente({ ...c.o, cliente }).then(() => {
          throw new Error("x");
        }),
    ]) {
      await f().catch((e: Error) => falhas.push(e.message));
    }
    writeFileSync(marcador(c.servidor), "{torto");
    await retomarVersaoPendente({ ...c.o, cliente }).catch((e: Error) => falhas.push(e.message));
    for (const m of falhas) expect(m).not.toContain(c.base);
  });
});
