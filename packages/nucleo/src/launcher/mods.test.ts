import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { ModGrupo } from "../cartorio/tipos.js";
import { sincronizarMods } from "./mods.js";

const sha512 = (b: Buffer) => createHash("sha512").update(b).digest("hex");
const SODIUM = Buffer.from("sodium-bytes-".repeat(50));
const LITHIUM = Buffer.from("lithium-bytes-".repeat(50));
const NOME = (n: string) => `https://cdn.modrinth.com/data/x/${n}`;
const mod = (arquivo: string, conteudo: Buffer, extra: Partial<ModGrupo> = {}): ModGrupo => ({
  nome: arquivo,
  versao: "1",
  arquivo,
  url: NOME(arquivo),
  sha512: sha512(conteudo),
  lado: "ambos",
  ...extra,
});

let pasta: string;
let pedidos: string[];
let nuvem: Map<string, Buffer>;

beforeEach(async () => {
  pasta = await mkdtemp(join(tmpdir(), "sabre-mods-"));
  pedidos = [];
  nuvem = new Map([
    [NOME("sodium.jar"), SODIUM],
    [NOME("lithium.jar"), LITHIUM],
  ]);
  // `fetch` falso: nenhuma rede real (Modrinth é bloqueado na nuvem e o teste não depende dele).
  vi.stubGlobal("fetch", async (url: string | URL | Request) => {
    pedidos.push(String(url));
    const corpo = nuvem.get(String(url));
    return corpo
      ? new Response(new Uint8Array(corpo), {
          status: 200,
          headers: { "content-length": String(corpo.length) },
        })
      : new Response("nada", { status: 404 });
  });
});
afterEach(async () => {
  vi.unstubAllGlobals();
  await rm(pasta, { recursive: true, force: true });
});

const jars = async () => (await readdir(pasta)).filter((n) => n.endsWith(".jar")).sort();

describe("sincronizarMods", () => {
  it("baixa o que falta, confere o hash e deixa o arquivo certo", async () => {
    const r = await sincronizarMods({
      lista: [mod("sodium.jar", SODIUM), mod("lithium.jar", LITHIUM)],
      pasta,
      lado: "cliente",
    });
    expect(r.baixados.sort()).toEqual(["lithium.jar", "sodium.jar"]);
    expect(await jars()).toEqual(["lithium.jar", "sodium.jar"]);
    expect(await readFile(join(pasta, "sodium.jar"))).toEqual(SODIUM);
  });

  it("hash errado é recusado: o arquivo não fica na pasta e o resto segue", async () => {
    const ruim = { ...mod("sodium.jar", SODIUM), sha512: sha512(Buffer.from("outro")) };
    const r = await sincronizarMods({
      lista: [ruim, mod("lithium.jar", LITHIUM)],
      pasta,
      lado: "cliente",
    });
    expect(r.falhas).toHaveLength(1);
    expect(r.falhas[0]?.arquivo).toBe("sodium.jar");
    expect(r.falhas[0]?.motivo).toMatch(/hash/);
    expect(await readdir(pasta)).not.toContain("sodium.jar");
    expect(await readdir(pasta)).not.toContain("sodium.jar.parcial");
    expect(await jars()).toEqual(["lithium.jar"]);
  });

  it("mod que saiu da lista sai da pasta; o que continua não é baixado de novo", async () => {
    await sincronizarMods({
      lista: [mod("sodium.jar", SODIUM), mod("lithium.jar", LITHIUM)],
      pasta,
      lado: "cliente",
    });
    pedidos.length = 0;
    const r = await sincronizarMods({
      lista: [mod("lithium.jar", LITHIUM)],
      pasta,
      lado: "cliente",
    });
    expect(r.removidos).toEqual(["sodium.jar"]);
    expect(r.mantidos).toEqual(["lithium.jar"]);
    expect(pedidos).toEqual([]);
    expect(await jars()).toEqual(["lithium.jar"]);
  });

  it("mod do amigo (fora da lista) nunca é apagado, nem com a lista vazia", async () => {
    await writeFile(join(pasta, "meu-mod.jar"), "do amigo");
    await sincronizarMods({ lista: [mod("sodium.jar", SODIUM)], pasta, lado: "cliente" });
    await sincronizarMods({ lista: [], pasta, lado: "cliente" });
    expect(await jars()).toEqual(["meu-mod.jar"]);
    expect(await readFile(join(pasta, "meu-mod.jar"), "utf8")).toBe("do amigo");
  });

  it("arquivo do amigo com o mesmo nome de um mod do grupo não é sobrescrito", async () => {
    await writeFile(join(pasta, "sodium.jar"), "do amigo");
    const r = await sincronizarMods({ lista: [mod("sodium.jar", SODIUM)], pasta, lado: "cliente" });
    expect(r.falhas[0]?.motivo).toMatch(/seu/);
    expect(await readFile(join(pasta, "sodium.jar"), "utf8")).toBe("do amigo");
    expect(pedidos).toEqual([]);
    // E depois que o grupo tira o mod, o arquivo do amigo continua lá.
    await sincronizarMods({ lista: [], pasta, lado: "cliente" });
    expect(await jars()).toEqual(["sodium.jar"]);
  });

  it("mod nosso corrompido no disco é baixado de novo", async () => {
    await sincronizarMods({ lista: [mod("sodium.jar", SODIUM)], pasta, lado: "cliente" });
    await writeFile(join(pasta, "sodium.jar"), "estragado");
    const r = await sincronizarMods({ lista: [mod("sodium.jar", SODIUM)], pasta, lado: "cliente" });
    expect(r.baixados).toEqual(["sodium.jar"]);
    expect(await readFile(join(pasta, "sodium.jar"))).toEqual(SODIUM);
  });

  it("respeita o lado: servidor não recebe mod só de cliente, e o de cliente não sai do servidor por engano", async () => {
    const lista = [
      mod("sodium.jar", SODIUM, { lado: "cliente" }),
      mod("lithium.jar", LITHIUM, { lado: "ambos" }),
    ];
    await sincronizarMods({ lista, pasta, lado: "servidor" });
    expect(await jars()).toEqual(["lithium.jar"]);
  });

  it("recusa host fora do Modrinth antes de baixar qualquer coisa", async () => {
    const torto = { ...mod("sodium.jar", SODIUM), url: "https://exemplo.com/sodium.jar" };
    await expect(sincronizarMods({ lista: [torto], pasta, lado: "cliente" })).rejects.toThrow(
      /mod do grupo/,
    );
    expect(pedidos).toEqual([]);
  });

  it("recusa nome de arquivo que sai da pasta", async () => {
    const torto = { ...mod("sodium.jar", SODIUM), arquivo: "../fora.jar" };
    await expect(sincronizarMods({ lista: [torto], pasta, lado: "cliente" })).rejects.toThrow();
    expect(pedidos).toEqual([]);
  });

  it("marcador adulterado com caminho fora da pasta não apaga nada de fora", async () => {
    await writeFile(
      join(pasta, ".sabrehosting-mods.json"),
      JSON.stringify({ gerenciados: ["../../importante.jar", "/etc/x.jar"] }),
    );
    const r = await sincronizarMods({ lista: [], pasta, lado: "cliente" });
    expect(r.removidos).toEqual([]);
  });
});
