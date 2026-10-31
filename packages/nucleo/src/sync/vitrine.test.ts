import {
  existsSync,
  lstatSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { gerarMundo } from "../../test/ajuda/mundos.js";
import { criarPacote } from "../backup/pacote.js";
import { servirArquivos, type Servidor } from "./transferencia.js";
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

  it("fechar durante uma publicação espera por ela e não deixa pasta v-* órfã", async () => {
    const p = await pacoteDeTeste(1);
    const pasta = join(p.base, "vitrine");
    const vitrine = criarVitrine(pasta);
    const publicando = vitrine.publicar(p.caminho, p.sha256);
    await vitrine.fechar(); // sem esperar, a pasta nasceria depois do rm
    await publicando.catch(() => undefined);
    expect(readdirSync(pasta).filter((n) => n.startsWith("v-"))).toEqual([]);
    expect(vitrine.arquivos(p.manifesto.sha256)).toBeUndefined();
    expect(await vitrine.publicar(p.caminho, p.sha256)).toBe(false); // fechada não publica mais
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

describe("só pacote fechado sai pelo arquivos(hash) (syncmel-1.3)", () => {
  it("cada hash servido é de arquivo regular dentro da vitrine, nunca da pasta do mundo vivo", async () => {
    const p = await pacoteDeTeste(1);
    const pasta = join(p.base, "vitrine");
    const vitrine = criarVitrine(pasta);
    await vitrine.publicar(p.caminho, p.sha256);
    const m = JSON.parse(
      readFileSync(vitrine.arquivos(p.manifesto.sha256)?.caminho ?? "", "utf8"),
    ) as {
      arquivos: { sha256: string }[];
    };
    expect(m.arquivos.length).toBeGreaterThan(0);
    for (const hash of [p.manifesto.sha256, ...m.arquivos.map((a) => a.sha256)]) {
      const { caminho } = vitrine.arquivos(hash) ?? { caminho: "" };
      expect(caminho).not.toBe("");
      expect(relative(pasta, caminho).startsWith("..")).toBe(false); // dentro da vitrine
      expect(relative(p.mundo, caminho).startsWith("..")).toBe(true); // fora do mundo vivo
      expect(lstatSync(caminho).isSymbolicLink()).toBe(false);
      expect(lstatSync(caminho).isFile()).toBe(true);
    }
  });

  it("arquivo do mundo vivo que não está no pacote não sai (nem pelo hash dele)", async () => {
    const p = await pacoteDeTeste(1);
    const vitrine = criarVitrine(join(p.base, "vitrine"));
    await vitrine.publicar(p.caminho, p.sha256);
    writeFileSync(join(p.mundo, "novo-depois-do-pacote.dat"), "criado depois do backup");
    const { hashDoArquivo } = await import("../integridade/hash.js");
    const hash = await hashDoArquivo(join(p.mundo, "novo-depois-do-pacote.dat"));
    expect(vitrine.arquivos(hash)).toBeUndefined();
  });

  describe("pelo servidor", () => {
    let servidor: Servidor | undefined;
    afterEach(async () => {
      await servidor?.fechar();
      servidor = undefined;
    });
    const subir = async (vitrine: ReturnType<typeof criarVitrine>) =>
      (servidor = await servirArquivos({
        endereco: "127.0.0.1",
        porta: 0,
        permitirLoopbackParaTeste: true,
        conferirToken: async () => "pc-teste",
        arquivos: (h) => vitrine.arquivos(h),
      }));
    const pedir = (s: Servidor, hash: string) =>
      fetch(`http://127.0.0.1:${s.porta}/arquivos/${hash}`, {
        headers: { authorization: "Bearer t" },
      });

    it("serve arquivo do pacote registrado (200) e hash de fora dele dá 404", async () => {
      const p = await pacoteDeTeste(1);
      const vitrine = criarVitrine(join(p.base, "vitrine"));
      await vitrine.publicar(p.caminho, p.sha256);
      const s = await subir(vitrine);
      expect((await pedir(s, p.manifesto.sha256)).status).toBe(200);
      expect((await pedir(s, "0".repeat(64))).status).toBe(404);
    });

    it("pasta intermediária trocada por link simbólico para fora: 404 e nada de fora vaza", async () => {
      const p = await pacoteDeTeste(1);
      const vitrine = criarVitrine(join(p.base, "vitrine"));
      await vitrine.publicar(p.caminho, p.sha256);
      const m = JSON.parse(
        readFileSync(vitrine.arquivos(p.manifesto.sha256)?.caminho ?? "", "utf8"),
      ) as {
        arquivos: { sha256: string; caminho: string }[];
      };
      const a = m.arquivos.find((x) => x.caminho.includes("/"));
      expect(a).toBeDefined();
      const caminho = vitrine.arquivos(a?.sha256 ?? "")?.caminho ?? "";
      const subpasta = dirname(caminho);
      const fora = join(p.base, "fora");
      renameSync(subpasta, fora); // o arquivo "de fora" tem o mesmo nome e conteúdo; basta estar fora da vitrine
      symlinkSync(fora, subpasta);
      expect(vitrine.arquivos(a?.sha256 ?? "")).toBeUndefined();
      const s = await subir(vitrine);
      expect((await pedir(s, a?.sha256 ?? "")).status).toBe(404);
    });

    it("link simbólico para fora no lugar do arquivo da vitrine: 404 e nada de fora vaza", async () => {
      const p = await pacoteDeTeste(1);
      const vitrine = criarVitrine(join(p.base, "vitrine"));
      await vitrine.publicar(p.caminho, p.sha256);
      const alvo = vitrine.arquivos(p.manifesto.sha256)?.caminho ?? "";
      const segredo = join(p.base, "fora-da-vitrine.txt");
      writeFileSync(segredo, "conteudo de fora");
      rmSync(alvo);
      symlinkSync(segredo, alvo);
      const s = await subir(vitrine);
      const resp = await pedir(s, p.manifesto.sha256);
      expect(resp.status).toBe(404);
      expect(await resp.text()).not.toContain("conteudo de fora");
    });
  });
});
