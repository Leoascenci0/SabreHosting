import { createHash } from "node:crypto";
import {
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { c as criarTar } from "tar";
import { afterEach, describe, expect, it } from "vitest";
import { gerarMundo, hashesDoMundo } from "../../test/ajuda/mundos.js";
import { gerarManifesto } from "./manifesto.js";
import { abrirPacote, criarPacote } from "./pacote.js";

const pastas: string[] = [];
const opcoes = { versao: 3, epoca: 1 };

function pasta(): string {
  const p = mkdtempSync(join(tmpdir(), "sabre-pacote-"));
  pastas.push(p);
  return p;
}

function sha256(arquivo: string): string {
  return createHash("sha256").update(readFileSync(arquivo)).digest("hex");
}

afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

/** Mundo pequeno, pacote bom, e o hash do pacote. */
async function pacoteBom(): Promise<{
  mundo: string;
  pacote: string;
  sha256: string;
  base: string;
}> {
  const base = pasta();
  const mundo = gerarMundo({ tamanho: "1MB", pasta: join(base, "mundo") });
  const { caminho, sha256: hash } = await criarPacote(mundo, join(base, "mundo.tar.gz"), opcoes);
  return { mundo, pacote: caminho, sha256: hash, base };
}

/** Pacote malicioso: manifesto válido do mundo + entradas extras, montado com o próprio tar. */
async function pacoteMalicioso(
  preparar: (base: string, mundo: string) => string[],
): Promise<{ pacote: string; sha256: string; base: string }> {
  const base = pasta();
  const mundo = gerarMundo({ tamanho: "1MB", pasta: join(base, "mundo") });
  const manifesto = await gerarManifesto(mundo, opcoes);
  writeFileSync(join(mundo, "manifesto.json"), JSON.stringify(manifesto));
  const extras = preparar(base, mundo);
  const pacote = join(base, "ruim.tar.gz");
  await criarTar(
    { file: pacote, cwd: mundo, gzip: true, preservePaths: true, noDirRecurse: true },
    ["manifesto.json", ...manifesto.arquivos.map((a) => a.caminho), ...extras],
  );
  return { pacote, sha256: sha256(pacote), base };
}

describe("criarPacote / abrirPacote", () => {
  it("ida e volta de um mundo de 20 MB reproduz os mesmos hashes e deixa o manifesto", async () => {
    const base = pasta();
    const mundo = gerarMundo({ tamanho: "20MB", pasta: join(base, "mundo") });
    const criado = await criarPacote(mundo, join(base, "p", "mundo.tar.gz"), opcoes);
    expect(criado.sha256).toBe(sha256(criado.caminho));
    expect(existsSync(`${criado.caminho}.parcial`)).toBe(false);

    const temp = join(base, "temp");
    const manifesto = await abrirPacote(criado.caminho, criado.sha256, temp);
    expect(hashesDoMundo(temp)).toEqual(hashesDoMundo(mundo));
    expect(manifesto).toMatchObject({ versao: 3, epoca: 1 });
    expect(manifesto.arquivos.length).toBe(Object.keys(hashesDoMundo(mundo)).length);
  }, 30_000);

  it("não trava o laço de eventos ao empacotar 20 MB (maior intervalo entre ticks de 10 ms)", async () => {
    const base = pasta();
    const mundo = gerarMundo({ tamanho: "20MB", pasta: join(base, "mundo") });
    let ultimo = performance.now();
    let maior = 0;
    const relogio = setInterval(() => {
      const agora = performance.now();
      maior = Math.max(maior, agora - ultimo);
      ultimo = agora;
    }, 10);
    await criarPacote(mundo, join(base, "mundo.tar.gz"), opcoes);
    clearInterval(relogio);
    console.log(`maior intervalo entre ticks durante o empacotamento: ${maior.toFixed(0)} ms`);
    expect(maior).toBeLessThan(200);
  }, 30_000);

  it("recusa o pacote com 1 byte trocado ANTES de extrair", async () => {
    const { pacote, sha256: hash, base } = await pacoteBom();
    const dados = readFileSync(pacote);
    const i = Math.floor(dados.length / 2);
    dados[i] = (dados[i] ?? 0) ^ 0x01;
    writeFileSync(pacote, dados);
    const temp = join(base, "temp");
    await expect(abrirPacote(pacote, hash, temp)).rejects.toThrow(/alterado ou veio corrompido/);
    expect(existsSync(temp)).toBe(false);
  });

  it("recusa entrada com caminho ../x e apaga a temporária", async () => {
    const {
      pacote,
      sha256: hash,
      base,
    } = await pacoteMalicioso((b) => {
      writeFileSync(join(b, "x"), "fora");
      return ["../x"];
    });
    const temp = join(base, "temp");
    await expect(abrirPacote(pacote, hash, temp)).rejects.toThrow(/fora do manifesto/);
    expect(existsSync(temp)).toBe(false);
    expect(existsSync(join(base, "x"))).toBe(true);
    expect(readFileSync(join(base, "x"), "utf8")).toBe("fora");
  });

  it("recusa link simbólico", async () => {
    const {
      pacote,
      sha256: hash,
      base,
    } = await pacoteMalicioso((_b, mundo) => {
      symlinkSync("/etc/passwd", join(mundo, "atalho"));
      return ["atalho"];
    });
    const temp = join(base, "temp");
    await expect(abrirPacote(pacote, hash, temp)).rejects.toThrow(/não é arquivo comum/);
    expect(existsSync(temp)).toBe(false);
  });

  it("recusa link físico", async () => {
    const {
      pacote,
      sha256: hash,
      base,
    } = await pacoteMalicioso((_b, mundo) => {
      linkSync(join(mundo, "level.dat"), join(mundo, "copia.dat"));
      return ["copia.dat"];
    });
    const temp = join(base, "temp");
    await expect(abrirPacote(pacote, hash, temp)).rejects.toThrow(
      /fora do manifesto|não é arquivo comum/,
    );
    expect(existsSync(temp)).toBe(false);
  });

  it("recusa arquivo fora do manifesto", async () => {
    const {
      pacote,
      sha256: hash,
      base,
    } = await pacoteMalicioso((_b, mundo) => {
      writeFileSync(join(mundo, "intruso.txt"), "oi");
      return ["intruso.txt"];
    });
    const temp = join(base, "temp");
    await expect(abrirPacote(pacote, hash, temp)).rejects.toThrow(/fora do manifesto/);
    expect(existsSync(temp)).toBe(false);
  });

  it("recusa arquivo repetido", async () => {
    const { pacote, sha256: hash, base } = await pacoteMalicioso(() => ["level.dat"]);
    const temp = join(base, "temp");
    await expect(abrirPacote(pacote, hash, temp)).rejects.toThrow(/fora do manifesto ou repetido/);
    expect(existsSync(temp)).toBe(false);
  });

  it("recusa pacote a que falta um arquivo do manifesto", async () => {
    const base = pasta();
    const mundo = gerarMundo({ tamanho: "1MB", pasta: join(base, "mundo") });
    const manifesto = await gerarManifesto(mundo, opcoes);
    writeFileSync(join(mundo, "manifesto.json"), JSON.stringify(manifesto));
    const pacote = join(base, "faltando.tar.gz");
    await criarTar({ file: pacote, cwd: mundo, gzip: true }, [
      "manifesto.json",
      ...manifesto.arquivos.slice(1).map((a) => a.caminho),
    ]);
    const temp = join(base, "temp");
    await expect(abrirPacote(pacote, sha256(pacote), temp)).rejects.toThrow(/faltam arquivos/);
    expect(existsSync(temp)).toBe(false);
  });

  it("recusa arquivo cujo conteúdo não bate com o manifesto e apaga o que já extraiu", async () => {
    const base = pasta();
    const mundo = gerarMundo({ tamanho: "1MB", pasta: join(base, "mundo") });
    const manifesto = await gerarManifesto(mundo, opcoes);
    writeFileSync(join(mundo, "manifesto.json"), JSON.stringify(manifesto));
    const ultimo = manifesto.arquivos.at(-1)?.caminho ?? "";
    const dados = readFileSync(join(mundo, ultimo));
    dados[0] = (dados[0] ?? 0) ^ 0xff;
    writeFileSync(join(mundo, ultimo), dados);
    const pacote = join(base, "adulterado.tar.gz");
    await criarTar({ file: pacote, cwd: mundo, gzip: true }, [
      "manifesto.json",
      ...manifesto.arquivos.map((a) => a.caminho),
    ]);
    const temp = join(base, "temp");
    await expect(abrirPacote(pacote, sha256(pacote), temp)).rejects.toThrow(
      /não bate com o manifesto/,
    );
    expect(existsSync(temp)).toBe(false);
  });

  it("recusa pasta temporária com arquivos, mesmo com pacote corrompido, e não apaga nada", async () => {
    const { pacote, base } = await pacoteBom();
    const temp = join(base, "temp");
    mkdirSync(temp);
    writeFileSync(join(temp, "importante.txt"), "meu");
    await expect(abrirPacote(pacote, "0".repeat(64), temp)).rejects.toThrow(
      /já existe e não está vazia/,
    );
    expect(readdirSync(temp)).toEqual(["importante.txt"]);
  });

  it("recusa a própria pasta do mundo como temporária", async () => {
    const { pacote, sha256: hash, mundo } = await pacoteBom();
    const antes = hashesDoMundo(mundo);
    await expect(abrirPacote(pacote, hash, mundo)).rejects.toThrow(/já existe e não está vazia/);
    expect(hashesDoMundo(mundo)).toEqual(antes);
  });

  it("recusa pasta temporária que é um arquivo e o arquivo continua lá", async () => {
    const { pacote, base } = await pacoteBom();
    const temp = join(base, "arquivo.txt");
    writeFileSync(temp, "meu");
    await expect(abrirPacote(pacote, "0".repeat(64), temp)).rejects.toThrow(
      /já existe e não está vazia/,
    );
    expect(readFileSync(temp, "utf8")).toBe("meu");
  });

  it("recusa mundo com arquivo chamado manifesto.json e não deixa .parcial", async () => {
    const base = pasta();
    const mundo = gerarMundo({ tamanho: "1MB", pasta: join(base, "mundo") });
    writeFileSync(join(mundo, "manifesto.json"), "{}");
    const destino = join(base, "mundo.tar.gz");
    await expect(criarPacote(mundo, destino, opcoes)).rejects.toThrow(/nome reservado/);
    expect(existsSync(destino)).toBe(false);
    expect(existsSync(`${destino}.parcial`)).toBe(false);
  });
});
