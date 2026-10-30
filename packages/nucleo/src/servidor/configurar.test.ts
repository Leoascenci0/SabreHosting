import { mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  gerarEula,
  gerarPropriedades,
  gravarConfiguracao,
  perguntaEula,
  podeSubir,
} from "./configurar.js";

const base = { ipRedePrivada: "10.8.0.5" };

describe("gerarPropriedades", () => {
  it("liga whitelist, desliga rcon e fica na rede privada", () => {
    const t = gerarPropriedades(base);
    expect(t).toContain("server-ip=10.8.0.5\n");
    expect(t).toContain("server-port=25565\n");
    expect(t).toContain("online-mode=false\n");
    expect(t).toContain("white-list=true\n");
    expect(t).toContain("enforce-whitelist=true\n");
    expect(t).toContain("enable-rcon=false\n");
    expect(t).toContain("view-distance=10\n");
    expect(t).toContain("simulation-distance=8\n");
  });

  it.each([
    "",
    "0.0.0.0",
    "8.8.8.8",
    "127.0.0.1",
    "172.32.0.1",
    "10.8.0.5\nonline-mode=true",
    "abc",
  ])("recusa IP %j fora da rede privada", (ip) => {
    expect(() => gerarPropriedades({ ipRedePrivada: ip })).toThrow(/rede privada/);
  });

  it.each(["10.0.0.1", "172.16.0.1", "172.31.255.1", "192.168.1.9"])(
    "aceita IP privado %s",
    (ip) => {
      expect(gerarPropriedades({ ipRedePrivada: ip })).toContain(`server-ip=${ip}\n`);
    },
  );

  it("recusa simulação maior ou igual à visão", () => {
    expect(() => gerarPropriedades({ ...base, distanciaVisao: 8, distanciaSimulacao: 8 })).toThrow(
      /simulação/,
    );
    expect(() => gerarPropriedades({ ...base, distanciaVisao: 8, distanciaSimulacao: 12 })).toThrow(
      /simulação/,
    );
  });

  it("recusa distâncias fora da faixa e não inteiras", () => {
    expect(() => gerarPropriedades({ ...base, distanciaVisao: 2 })).toThrow(/visão/);
    expect(() => gerarPropriedades({ ...base, distanciaVisao: 33 })).toThrow(/visão/);
    expect(() => gerarPropriedades({ ...base, distanciaVisao: 12.5 })).toThrow(/visão/);
    expect(() => gerarPropriedades({ ...base, distanciaSimulacao: 2 })).toThrow(/simulação/);
  });

  it("recusa porta inválida", () => {
    expect(() => gerarPropriedades({ ...base, porta: 80 })).toThrow(/porta/);
    expect(() => gerarPropriedades({ ...base, porta: 70000 })).toThrow(/porta/);
    expect(gerarPropriedades({ ...base, porta: 25570 })).toContain("server-port=25570\n");
  });
});

describe("gerarEula e perguntaEula", () => {
  it("sem aceite, eula=false", () => {
    expect(gerarEula()).toContain("eula=false\n");
  });

  it("com aceite explícito, eula=true e a data do aceite", () => {
    const t = gerarEula({ aceitoEm: new Date("2026-10-30T12:00:00Z") });
    expect(t).toContain("eula=true\n");
    expect(t).toContain("2026-10-30T12:00:00.000Z");
  });

  it("aceite com data inválida não vale", () => {
    expect(gerarEula({ aceitoEm: new Date("x") })).toContain("eula=false\n");
  });

  it("expõe a pergunta com o link oficial", () => {
    const p = perguntaEula();
    expect(p.link).toBe("https://aka.ms/MinecraftEULA");
    expect(p.texto).toMatch(/Mojang/);
  });
});

describe("podeSubir e gravarConfiguracao", () => {
  let pasta: string;
  beforeEach(async () => {
    pasta = await mkdtemp(join(tmpdir(), "sabre-conf-"));
  });
  afterEach(async () => {
    await rm(pasta, { recursive: true, force: true });
  });

  it("recusa sem eula.txt", async () => {
    const r = await podeSubir(pasta);
    expect(r.pode).toBe(false);
    expect(r.motivo).toMatch(/EULA/);
  });

  it("sem aceite, grava eula=false e o servidor não sobe", async () => {
    await gravarConfiguracao(pasta, base);
    expect(await readFile(join(pasta, "eula.txt"), "utf8")).toContain("eula=false");
    expect((await podeSubir(pasta)).pode).toBe(false);
  });

  it("com aceite, grava os dois arquivos e o servidor pode subir", async () => {
    await gravarConfiguracao(pasta, base, { aceitoEm: new Date() });
    expect((await podeSubir(pasta)).pode).toBe(true);
    expect(await readFile(join(pasta, "server.properties"), "utf8")).toContain("white-list=true");
    expect((await readdir(pasta)).sort()).toEqual(["eula.txt", "server.properties"]);
  });

  it("não aceita eula=true editado com lixo (eula=truee)", async () => {
    await writeFile(join(pasta, "eula.txt"), "eula=truee\n");
    expect((await podeSubir(pasta)).pode).toBe(false);
  });

  it("opções inválidas não escrevem nada", async () => {
    await expect(gravarConfiguracao(pasta, { ipRedePrivada: "0.0.0.0" })).rejects.toThrow();
    expect(await readdir(pasta)).toEqual([]);
  });
});
