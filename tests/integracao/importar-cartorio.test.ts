// Importar mundo de ponta a ponta (piloto-1.1c): cartório de verdade em 127.0.0.1 (banco e armazém em pasta
// temporária) + cliente do núcleo + zip de mundo INVENTADO. Nada de mundo real nem da máquina da nuvem.
import { createHash, randomBytes } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile, mkdir } from "node:fs/promises";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { levelDat } from "../../packages/nucleo/test/ajuda/nbt.js";
import { montarZip, type EntradaDeZip } from "../../packages/nucleo/test/ajuda/zip.js";
import { abrirPacote } from "../../packages/nucleo/src/backup/pacote.js";
import { criarCliente } from "../../packages/nucleo/src/cartorio/cliente.js";
import { cofreEmMemoria } from "../../packages/nucleo/src/cartorio/cofre.js";
import { importarNoCartorio } from "../../packages/nucleo/src/importar.js";
import { abrirBanco, criarConvite, type Banco } from "../../services/cartorio/src/banco.js";
import { criarCartorio } from "../../services/cartorio/src/servidor.js";

const TEMPOS = { prazoMs: 3000, renovarMs: 1000 };

let pasta: string;
let fechar: Array<() => Promise<unknown>>;

beforeEach(async () => {
  pasta = await mkdtemp(join(tmpdir(), "sabre-importar-integ-"));
  fechar = [];
});
afterEach(async () => {
  for (const f of fechar.splice(0).reverse()) await f().catch(() => {});
  await rm(pasta, { recursive: true, force: true });
});

async function subirCartorio() {
  const banco: Banco = abrirBanco(join(pasta, "cartorio.db"));
  const armazem = join(pasta, "nuvem");
  const app = criarCartorio({
    banco,
    logger: { level: "silent" },
    trava: TEMPOS,
    armazem: { pasta: armazem },
  });
  await app.listen({ host: "127.0.0.1", port: 0 });
  fechar.push(() => app.close());
  const url = `http://127.0.0.1:${(app.server.address() as AddressInfo).port}`;
  async function pc(nomePc: string, dono = false) {
    const convite = criarConvite(banco, nomePc, Date.now(), 60_000);
    const usado = await app.inject({ method: "POST", url: "/convites/usar", payload: { convite } });
    if (dono) banco.prepare("UPDATE pcs SET dono = 1 WHERE nome = ?").run(nomePc);
    const cofre = cofreEmMemoria();
    await cofre.guardar(usado.json<{ token: string }>().token);
    return criarCliente({ url, cofre, prazoMs: 2000, esperaBaseMs: 10 });
  }
  const versoes = () =>
    banco
      .prepare("SELECT numero, manifesto_sha256 AS m FROM versoes ORDER BY numero")
      .all() as Array<{
      numero: number;
      m: string;
    }>;
  return { banco, app, pc, armazem, versoes };
}

const mundoInventado = (nome = "1.21.1"): EntradaDeZip[] => [
  { nome: "world/level.dat", dados: levelDat(nome, 3955) },
  // Incompressível: pacote minúsculo esbarra numa corrida já conhecida de `abrirPacote` (ver importar.test.ts).
  { nome: "world/region/r.0.0.mca", dados: randomBytes(300_000) },
  { nome: "world/playerdata/a.dat", dados: Buffer.from("jogador inventado") },
];

async function zipDe(entradas: EntradaDeZip[], nome = "mundo.zip") {
  const zip = join(pasta, nome);
  await writeFile(zip, montarZip(entradas));
  const trabalho = join(pasta, "trabalho");
  await mkdir(trabalho, { recursive: true });
  return { zip, trabalho };
}

const sha256 = async (arquivo: string) =>
  createHash("sha256")
    .update(await readFile(arquivo))
    .digest("hex");

describe("importarNoCartorio com cartório de verdade", () => {
  it("mundo inventado vira a versão 1; a nuvem guarda o pacote e o hash confere; trava solta", async () => {
    const c = await subirCartorio();
    const cliente = await c.pc("PC do Lucas");
    const { zip, trabalho } = await zipDe(mundoInventado());
    const zipAntes = await sha256(zip);

    const r = await importarNoCartorio(zip, { cliente, pastaDeTrabalho: trabalho });

    expect(r).toMatchObject({ versao: 1, versaoMinecraft: "1.21.1", arquivos: 3 });
    expect(c.versoes()).toHaveLength(1);
    const guardado = join(c.armazem, "v1.tar.gz");
    expect(await sha256(guardado)).toBe(r.sha256);
    const manifesto = await abrirPacote(guardado, r.sha256, join(pasta, "aberto"));
    expect(manifesto.versao).toBe(1);
    expect(manifesto.arquivos.map((a) => a.caminho).sort()).toEqual([
      "level.dat",
      "playerdata/a.dat",
      "region/r.0.0.mca",
    ]);
    expect((await cliente.estadoTrava()).dono).toBeNull(); // solta no fim
    expect(await readdir(trabalho)).toEqual([]); // nada sobrando
    expect(await sha256(zip)).toBe(zipAntes); // o zip só foi lido
  });

  it("com versão no grupo: sem confirmar recusa; o dono confirmando vira N+1 (nada apagado)", async () => {
    const c = await subirCartorio();
    const dono = await c.pc("PC do Eliel", true);
    const amigo = await c.pc("PC do Lucas");
    const { zip, trabalho } = await zipDe(mundoInventado());
    await importarNoCartorio(zip, { cliente: dono, pastaDeTrabalho: trabalho });

    await expect(
      importarNoCartorio(zip, { cliente: dono, pastaDeTrabalho: trabalho }),
    ).rejects.toThrow(/já tem um mundo/);
    await expect(
      importarNoCartorio(zip, {
        cliente: amigo,
        pastaDeTrabalho: trabalho,
        aceitarVersaoNova: true,
      }),
    ).rejects.toThrow(/Só o dono do grupo/);
    expect(c.versoes()).toHaveLength(1);
    expect((await dono.estadoTrava()).dono).toBeNull();

    const r = await importarNoCartorio(zip, {
      cliente: dono,
      pastaDeTrabalho: trabalho,
      aceitarVersaoNova: true,
    });
    expect(r.versao).toBe(2);
    expect(c.versoes().map((v) => v.numero)).toEqual([1, 2]);
    const m = await abrirPacote(join(c.armazem, "v2.tar.gz"), r.sha256, join(pasta, "v2"));
    expect(m.versao).toBe(2); // o manifesto leva o mesmo número do cartório (o espalhar confere)
  });

  it("trava com outro PC: recusa e nada é registrado nem enviado", async () => {
    const c = await subirCartorio();
    const host = await c.pc("PC da Ana");
    const cliente = await c.pc("PC do Lucas");
    const pega = await host.pegar();
    expect(pega.ok).toBe(true);
    const { zip, trabalho } = await zipDe(mundoInventado());
    await expect(importarNoCartorio(zip, { cliente, pastaDeTrabalho: trabalho })).rejects.toThrow(
      /outro PC/i,
    );
    expect(c.versoes()).toHaveLength(0);
    expect(await readdir(c.armazem)).toEqual([]);
    expect((await cliente.estadoTrava()).dono?.nome).toBe("PC da Ana"); // a trava dele ficou intacta
  });

  it("este PC hospedando: recusa sem pegar a trava de novo (a época dele não muda)", async () => {
    const c = await subirCartorio();
    const cliente = await c.pc("PC do Lucas");
    const pega = await cliente.pegar();
    if (!pega.ok) throw new Error("trava");
    const { zip, trabalho } = await zipDe(mundoInventado());
    await expect(importarNoCartorio(zip, { cliente, pastaDeTrabalho: trabalho })).rejects.toThrow(
      /Pare o servidor/,
    );
    expect((await cliente.estadoTrava()).epoca).toBe(pega.epoca);
    expect(c.versoes()).toHaveLength(0);
    await cliente.soltar(pega.epoca);
  });

  it("zip hostil: recusa sem versão nova, sem gravar e com a trava solta", async () => {
    const c = await subirCartorio();
    const cliente = await c.pc("PC do Lucas");
    const { zip, trabalho } = await zipDe([
      ...mundoInventado(),
      { nome: "../fora.txt", dados: Buffer.from("x") },
    ]);
    await expect(importarNoCartorio(zip, { cliente, pastaDeTrabalho: trabalho })).rejects.toThrow(
      /recusado/,
    );
    expect(c.versoes()).toHaveLength(0);
    expect(await readdir(c.armazem)).toEqual([]);
    expect(await readdir(trabalho)).toEqual([]);
    await expect(readdir(join(pasta, ".."))).resolves.not.toContain("fora.txt");
    expect((await cliente.estadoTrava()).dono).toBeNull();
  });
});
