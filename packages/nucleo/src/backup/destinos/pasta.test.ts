import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
  existsSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hashDoArquivo } from "../../integridade/hash.js";
import { PASTA_NAO_ENCONTRADA, copiarParaPasta } from "./pasta.js";

const pastas: string[] = [];
const nova = (): string => {
  const p = mkdtempSync(join(tmpdir(), "sabre-destino-"));
  pastas.push(p);
  return p;
};
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

async function pacoteDeTeste(local: string, nome = "2026-10-31T10-00-00-000Z-v1.tar.gz") {
  const caminho = join(local, nome);
  writeFileSync(caminho, Buffer.alloc(200_000, 7)); // conteúdo inventado
  return { caminho, sha256: await hashDoArquivo(caminho) };
}

describe("copiarParaPasta (drive-1.1a)", () => {
  it("copia o pacote fechado para a pasta e o hash confere", async () => {
    const local = nova();
    const destino = nova();
    const p = await pacoteDeTeste(local);
    const feito = await copiarParaPasta(p.caminho, p.sha256, destino, local);
    expect(readdirSync(destino)).toEqual(["2026-10-31T10-00-00-000Z-v1.tar.gz"]);
    expect(await hashDoArquivo(feito)).toBe(p.sha256);
  });

  it("pasta que some no meio: erro claro, backup local intacto, nada de .parcial sobrando", async () => {
    const local = nova();
    const destino = join(nova(), "sumiu");
    const p = await pacoteDeTeste(local);
    await expect(copiarParaPasta(p.caminho, p.sha256, destino, local)).rejects.toThrow(
      PASTA_NAO_ENCONTRADA,
    );
    expect(existsSync(destino)).toBe(false); // não recria a pasta por conta própria
    expect(readFileSync(p.caminho).length).toBe(200_000);
    expect(readdirSync(local)).toEqual(["2026-10-31T10-00-00-000Z-v1.tar.gz"]);
  });

  it("hash diferente: não deixa arquivo com o nome final", async () => {
    const local = nova();
    const destino = nova();
    const p = await pacoteDeTeste(local);
    await expect(copiarParaPasta(p.caminho, "0".repeat(64), destino, local)).rejects.toThrow(
      /não bateu/i,
    );
    expect(readdirSync(destino)).toEqual([]);
  });

  it("nunca escreve por cima de um arquivo que já existe na pasta", async () => {
    const local = nova();
    const destino = nova();
    const p = await pacoteDeTeste(local);
    writeFileSync(join(destino, "2026-10-31T10-00-00-000Z-v1.tar.gz"), "antigo");
    await expect(copiarParaPasta(p.caminho, p.sha256, destino, local)).rejects.toThrow(
      /já existe/i,
    );
    expect(readFileSync(join(destino, "2026-10-31T10-00-00-000Z-v1.tar.gz"), "utf8")).toBe(
      "antigo",
    );
  });

  it("recusa destino igual, DENTRO ou CONTENDO a pasta de backups e a do mundo (S-07)", async () => {
    const raiz = nova();
    const local = join(raiz, "backups");
    const mundo = join(raiz, "mundo");
    mkdirSync(join(local, "sub"), { recursive: true });
    mkdirSync(join(mundo, "region"), { recursive: true });
    const p = await pacoteDeTeste(local);
    const tenta = (destino: string) =>
      copiarParaPasta(p.caminho, p.sha256, destino, [local, mundo]);
    for (const ruim of [local, join(local, "sub"), raiz, mundo, join(mundo, "region")]) {
      await expect(tenta(ruim), ruim).rejects.toThrow(/nem ficar dentro/i);
    }
    expect(readdirSync(join(local, "sub"))).toEqual([]); // nada escrito dentro dos backups
    expect(readdirSync(raiz).sort()).toEqual(["backups", "mundo"]); // nem na pasta que contém
    await expect(tenta(nova())).resolves.toContain("v1.tar.gz"); // pasta fora de tudo passa
  });

  it(".parcial antigo na pasta: aviso claro e o arquivo não é tocado", async () => {
    const local = nova();
    const destino = nova();
    const p = await pacoteDeTeste(local);
    const velho = join(destino, "2026-10-31T10-00-00-000Z-v1.tar.gz.parcial");
    writeFileSync(velho, "de outra hora");
    await expect(copiarParaPasta(p.caminho, p.sha256, destino, local)).rejects.toThrow(
      /cópia incompleta/i,
    );
    expect(readFileSync(velho, "utf8")).toBe("de outra hora");
  });

  it.each(["relativa/pasta", "", "."])(
    "pasta da config inválida (%j) é recusada",
    async (pasta) => {
      const local = nova();
      const p = await pacoteDeTeste(local);
      await expect(copiarParaPasta(p.caminho, p.sha256, pasta, local)).rejects.toThrow(
        /histórico longo/i,
      );
    },
  );

  it("recusa a própria pasta de backups e arquivo no lugar de pasta (S-07)", async () => {
    const local = nova();
    const p = await pacoteDeTeste(local);
    await expect(copiarParaPasta(p.caminho, p.sha256, local, local)).rejects.toThrow(
      /nem ficar dentro/i,
    );
    const arquivo = join(nova(), "arq");
    writeFileSync(arquivo, "x");
    await expect(copiarParaPasta(p.caminho, p.sha256, arquivo, local)).rejects.toThrow(
      PASTA_NAO_ENCONTRADA,
    );
  });
});
