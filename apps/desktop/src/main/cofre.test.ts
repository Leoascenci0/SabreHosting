import { randomBytes } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { criarCofreSeguro, type CofreDoSistema } from "./cofre.js";

const pastas: string[] = [];
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});
const pasta = () => {
  const p = mkdtempSync(join(tmpdir(), "sabre-cofre-"));
  pastas.push(p);
  return p;
};

/** safeStorage falso: "cifra" invertendo os bytes, para o teste provar que o disco não tem o texto puro. */
function falso(disponivel = true): CofreDoSistema {
  return {
    isEncryptionAvailable: () => disponivel,
    encryptString: (t) => Buffer.from([...Buffer.from(t, "utf8")].reverse()),
    decryptString: (b) => Buffer.from([...b].reverse()).toString("utf8"),
  };
}
const ANTIGO = randomBytes(16).toString("base64url");
const TOKEN = randomBytes(32).toString("base64url");

describe("cofre real (safeStorage)", () => {
  it("guarda cifrado e lê de volta; o disco nunca tem o token puro", async () => {
    const dir = pasta();
    const arq = join(dir, "token.bin");
    const cofre = criarCofreSeguro(falso(), arq);
    await cofre.guardar(TOKEN);
    expect(await cofre.ler()).toBe(TOKEN);
    expect(readFileSync(arq).includes(Buffer.from(TOKEN))).toBe(false);
    expect(readdirSync(dir)).toEqual(["token.bin"]);
  });

  it("sem cofre disponível: recusa guardar, explica e não grava nada", async () => {
    const dir = pasta();
    const cofre = criarCofreSeguro(falso(false), join(dir, "token.bin"));
    const erro = await cofre.guardar(TOKEN).catch((e: Error) => e);
    expect(erro).toBeInstanceOf(Error);
    expect((erro as Error).message).toMatch(/cofre/i);
    expect((erro as Error).message).not.toContain(TOKEN);
    expect(readdirSync(dir)).toEqual([]);
  });

  it("sem cofre disponível: ler devolve vazio, mesmo com arquivo antigo", async () => {
    const dir = pasta();
    const arq = join(dir, "token.bin");
    writeFileSync(arq, Buffer.from("qualquer"));
    expect(await criarCofreSeguro(falso(false), arq).ler()).toBeUndefined();
  });

  it("sem arquivo: ler devolve vazio", async () => {
    expect(await criarCofreSeguro(falso(), join(pasta(), "nada.bin")).ler()).toBeUndefined();
  });

  it("arquivo que não decifra (outra conta do Windows): vazio, sem derrubar nem vazar", async () => {
    const dir = pasta();
    const arq = join(dir, "token.bin");
    writeFileSync(arq, Buffer.from("lixo"));
    const quebrado: CofreDoSistema = {
      ...falso(),
      decryptString: () => {
        throw new Error(`falha com ${TOKEN}`);
      },
    };
    expect(await criarCofreSeguro(quebrado, arq).ler()).toBeUndefined();
  });

  it("falha ao cifrar não destrói o token que já estava guardado", async () => {
    const dir = pasta();
    const arq = join(dir, "token.bin");
    await criarCofreSeguro(falso(), arq).guardar(ANTIGO);
    const quebrado: CofreDoSistema = {
      ...falso(),
      encryptString: () => {
        throw new Error("sem chave");
      },
    };
    await expect(criarCofreSeguro(quebrado, arq).guardar(TOKEN)).rejects.toThrow(/cofre/i);
    expect(await criarCofreSeguro(falso(), arq).ler()).toBe(ANTIGO);
    expect(readdirSync(dir)).toEqual(["token.bin"]);
  });

  it("token vazio ou torto não é guardado", async () => {
    const cofre = criarCofreSeguro(falso(), join(pasta(), "token.bin"));
    await expect(cofre.guardar("")).rejects.toThrow();
    await expect(cofre.guardar("tem\nquebra")).rejects.toThrow();
  });
});
