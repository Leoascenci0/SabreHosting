import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { gerarMundo } from "../../test/ajuda/mundos.js";
import { criarPacote } from "../backup/pacote.js";
import { criarVitrine } from "./vitrine.js";

const pastas: string[] = [];
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

async function pacoteDeTeste(versao: number, semente = "A") {
  const base = mkdtempSync(join(tmpdir(), "sabre-vitrine-"));
  pastas.push(base);
  const mundo = gerarMundo({ tamanho: "1MB", semente, pasta: join(base, "world") });
  const p = await criarPacote(mundo, join(base, `v${versao}.tar.gz`), { versao, epoca: 1 });
  return { base, mundo, ...p };
}

describe("criarVitrine (syncmel-1.10)", () => {
  it("serve o manifesto (pelo hash que o cartório registra) e cada arquivo do pacote por hash", async () => {
    const p = await pacoteDeTeste(1);
    const vitrine = criarVitrine(join(p.base, "vitrine"));
    expect(await vitrine.publicar(p.caminho, p.sha256)).toBe(true);
    const manifesto = vitrine.arquivos(p.manifesto.sha256);
    expect(manifesto).toBeDefined();
    const m = JSON.parse(readFileSync(manifesto?.caminho ?? "", "utf8")) as {
      arquivos: { sha256: string; caminho: string }[];
    };
    for (const a of m.arquivos) {
      const f = vitrine.arquivos(a.sha256);
      expect(f && readFileSync(f.caminho).length).toBeGreaterThan(0);
    }
  });

  it("hash desconhecido, caminho ou vazio não acham nada (nunca a pasta do mundo vivo)", async () => {
    const p = await pacoteDeTeste(1);
    const vitrine = criarVitrine(join(p.base, "vitrine"));
    expect(vitrine.arquivos("0".repeat(64))).toBeUndefined();
    await vitrine.publicar(p.caminho, p.sha256);
    expect(vitrine.arquivos("../world/level.dat")).toBeUndefined();
    expect(vitrine.arquivos("0".repeat(64))).toBeUndefined();
  });

  it("pacote adulterado não publica e a vitrine anterior continua servindo", async () => {
    const p1 = await pacoteDeTeste(1);
    const p2 = await pacoteDeTeste(2, "B");
    const vitrine = criarVitrine(join(p1.base, "vitrine"));
    await vitrine.publicar(p1.caminho, p1.sha256);
    writeFileSync(p2.caminho, Buffer.concat([readFileSync(p2.caminho), Buffer.from("x")]));
    await expect(vitrine.publicar(p2.caminho, p2.sha256)).rejects.toThrow();
    expect(vitrine.arquivos(p1.manifesto.sha256)).toBeDefined();
    expect(vitrine.arquivos(p2.manifesto.sha256)).toBeUndefined();
    expect(readdirSync(join(p1.base, "vitrine"))).toHaveLength(1); // a tentativa falha não deixa pasta
  });

  it("publicar a versão nova troca o índice e apaga a pasta da velha", async () => {
    const p1 = await pacoteDeTeste(1);
    const p2 = await pacoteDeTeste(2, "B");
    const vitrine = criarVitrine(join(p1.base, "vitrine"));
    await vitrine.publicar(p1.caminho, p1.sha256);
    const velha = vitrine.arquivos(p1.manifesto.sha256)?.caminho ?? "";
    expect(velha).not.toBe("");
    await vitrine.publicar(p2.caminho, p2.sha256);
    expect(vitrine.arquivos(p1.manifesto.sha256)).toBeUndefined();
    expect(vitrine.arquivos(p2.manifesto.sha256)).toBeDefined();
    expect(existsSync(velha)).toBe(false);
  });

  it("uma publicação por vez: a segunda, enquanto a primeira roda, é pulada", async () => {
    const p = await pacoteDeTeste(1);
    const vitrine = criarVitrine(join(p.base, "vitrine"));
    const [a, b] = await Promise.all([
      vitrine.publicar(p.caminho, p.sha256),
      vitrine.publicar(p.caminho, p.sha256),
    ]);
    expect([a, b].sort()).toEqual([false, true]);
  });

  it("no arranque limpa só as pastas v-* de uma sessão anterior", async () => {
    const p = await pacoteDeTeste(1);
    const pasta = join(p.base, "vitrine");
    const outra = await pacoteDeTeste(2, "B");
    const antiga = criarVitrine(pasta);
    await antiga.publicar(outra.caminho, outra.sha256);
    writeFileSync(join(pasta, "nao-e-minha.txt"), "fica");
    const nova = criarVitrine(pasta);
    await nova.publicar(p.caminho, p.sha256);
    expect(readdirSync(pasta).sort()).toEqual(
      ["nao-e-minha.txt", ...readdirSync(pasta).filter((n) => n.startsWith("v-"))].sort(),
    );
    expect(readdirSync(pasta).filter((n) => n.startsWith("v-"))).toHaveLength(1);
  });
});
