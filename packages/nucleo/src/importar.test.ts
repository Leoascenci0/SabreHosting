import { randomBytes } from "node:crypto";
import { mkdirSync, mkdtempSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { levelDat } from "../test/ajuda/nbt.js";
import { montarZip, type EntradaDeZip } from "../test/ajuda/zip.js";
import { abrirPacote } from "./backup/pacote.js";
import { analisarZip, importarMundoZip, type LimitesDaImportacao } from "./importar.js";

const raizes: string[] = [];
function area() {
  const raiz = mkdtempSync(join(tmpdir(), "sabre-importar-"));
  raizes.push(raiz);
  const trabalho = join(raiz, "trabalho");
  mkdirSync(trabalho);
  return { raiz, trabalho };
}
afterEach(() => {
  for (const r of raizes.splice(0)) rmSync(r, { recursive: true, force: true });
});

const ok = (nome: string, texto = "dados de " + nome): EntradaDeZip => ({
  nome,
  dados: Buffer.from(texto),
});

async function importar(
  entradas: EntradaDeZip[],
  limites?: Partial<LimitesDaImportacao>,
  zipPronto?: Buffer,
) {
  const { raiz, trabalho } = area();
  const zip = join(raiz, "mundo.zip");
  writeFileSync(zip, zipPronto ?? montarZip(entradas));
  const enviar = vi.fn(async () => undefined);
  const antes = readdirSync(raiz).sort();
  const chamada = importarMundoZip(zip, { pastaDeTrabalho: trabalho, epoca: 1, enviar, limites });
  return { raiz, trabalho, enviar, antes, chamada };
}

/** Recusa: nada enviado, nada sobrando na pasta de trabalho, nada novo fora dela. */
async function esperarRecusa(
  entradas: EntradaDeZip[],
  mensagem: RegExp,
  limites?: Partial<LimitesDaImportacao>,
  zipPronto?: Buffer,
) {
  const { raiz, trabalho, enviar, antes, chamada } = await importar(entradas, limites, zipPronto);
  await expect(chamada).rejects.toThrow(mensagem);
  expect(enviar).not.toHaveBeenCalled();
  expect(readdirSync(trabalho)).toEqual([]);
  expect(readdirSync(raiz).sort()).toEqual(antes);
}

describe("importarMundoZip — zip honesto", () => {
  it("vira a versão 1 com o hash do pacote que criarPacote gerou", async () => {
    const { chamada, enviar, trabalho } = await importar([
      ok("level.dat"),
      ok("region/r.0.0.mca", "x".repeat(5000)),
      ok("playerdata/a.dat"),
    ]);
    const r = await chamada;
    expect(r.versao).toBe(1);
    expect(r.arquivos).toBe(3);
    expect(enviar).toHaveBeenCalledTimes(1);
    const enviado = (enviar.mock.calls[0] as unknown as [{ sha256: string; tamanho: number }])[0];
    expect(enviado.sha256).toBe(r.sha256);
    expect(enviado.tamanho).toBe(r.tamanho);
    expect(readdirSync(trabalho)).toEqual([]);
  });

  it("o pacote enviado abre com o hash e traz exatamente os arquivos do zip", async () => {
    const { raiz, trabalho } = area();
    const zip = join(raiz, "mundo.zip");
    // Bytes incompressíveis: um pacote minúsculo esbarra numa corrida já existente em abrirPacote (fora do escopo).
    const regiao = { nome: "region/r.0.0.mca", dados: randomBytes(300_000) };
    writeFileSync(zip, montarZip([ok("level.dat"), regiao]));
    const aberto = join(raiz, "aberto");
    let enviado: string | undefined;
    const r = await importarMundoZip(zip, {
      pastaDeTrabalho: trabalho,
      epoca: 7,
      enviar: async (p) => {
        enviado = p.sha256;
        const m = await abrirPacote(p.caminho, p.sha256, aberto);
        expect(m.versao).toBe(1);
        expect(m.epoca).toBe(7);
        expect(m.arquivos.map((a) => a.caminho)).toEqual(["level.dat", "region/r.0.0.mca"]);
      },
    });
    expect(enviado).toBe(r.sha256);
  });

  it("entradas de pasta (terminam em /) não viram erro", async () => {
    const { chamada } = await importar([
      { nome: "region/", dados: Buffer.alloc(0) },
      ok("region/r.0.0.mca"),
    ]);
    expect((await chamada).arquivos).toBe(1);
  });

  it("apaga a pasta temporária mesmo quando o envio falha", async () => {
    const { raiz, trabalho } = area();
    const zip = join(raiz, "mundo.zip");
    writeFileSync(zip, montarZip([ok("level.dat")]));
    await expect(
      importarMundoZip(zip, {
        pastaDeTrabalho: trabalho,
        epoca: 1,
        enviar: async () => {
          throw new Error("cartório fora");
        },
      }),
    ).rejects.toThrow("cartório fora");
    expect(readdirSync(trabalho)).toEqual([]);
  });
});

describe("importarMundoZip — zip hostil (cada um recusa antes de enviar e sem sobra)", () => {
  it("zip-slip: ../fora", async () => {
    await esperarRecusa([ok("level.dat"), ok("../fora.txt")], /caminho|nome/i);
  });
  it("zip-slip escondido no meio: a/../../fora", async () => {
    await esperarRecusa([ok("a/../../fora.txt")], /caminho|nome/i);
  });
  it("caminho absoluto", async () => {
    await esperarRecusa([ok("/etc/cron.d/x")], /caminho|nome/i);
  });
  it("letra de unidade do Windows", async () => {
    await esperarRecusa([ok("C:/Windows/x.dll")], /caminho|nome/i);
  });
  it("barra invertida", async () => {
    await esperarRecusa([ok("region\\..\\..\\x")], /caminho|nome/i);
  });
  it("NUL no nome", async () => {
    await esperarRecusa([ok("level.dat\u0000.txt")], /caminho|nome/i);
  });
  it("link simbólico (modo Unix 0o120777)", async () => {
    await esperarRecusa(
      [ok("level.dat"), { nome: "atalho", dados: Buffer.from("/etc/passwd"), modo: 0o120777 }],
      /link/i,
    );
  });
  it("entrada repetida", async () => {
    await esperarRecusa([ok("level.dat"), ok("level.dat", "outro")], /repetid|duas vezes/i);
  });
  it("entrada repetida só na maiúscula", async () => {
    await esperarRecusa([ok("Level.dat"), ok("level.dat")], /repetid|maiúscula/i);
  });
  it("arquivo e pasta com o mesmo nome", async () => {
    await esperarRecusa([ok("a"), ok("a/b")], /pasta|arquivo/i);
  });
  it("bomba de zip: tamanho declarado acima do teto (nada é lido)", async () => {
    await esperarRecusa(
      [{ nome: "region/r.0.0.mca", dados: Buffer.alloc(2_000_000) }],
      /grande|tamanho|limite/i,
      { maxBytes: 1_000_000 },
    );
  });
  it("bomba de zip: cabeçalho mente (declara pouco, entrega muito)", async () => {
    await esperarRecusa(
      [{ nome: "region/r.0.0.mca", dados: Buffer.alloc(3_000_000), tamanhoDeclarado: 10 }],
      /./,
      { maxBytes: 1_000_000 },
    );
  });
  it("bomba de zip: soma de várias entradas passa do teto", async () => {
    await esperarRecusa(
      [1, 2, 3].map((n) => ({ nome: `r${n}.mca`, dados: Buffer.alloc(400_000) })),
      /grande|tamanho|limite/i,
      { maxBytes: 1_000_000 },
    );
  });
  it("entradas demais", async () => {
    await esperarRecusa([ok("a"), ok("b"), ok("c")], /entradas|arquivos/i, { maxEntradas: 2 });
  });
  it("zip sem nenhum arquivo", async () => {
    await esperarRecusa([{ nome: "region/", dados: Buffer.alloc(0) }], /vazio|nenhum/i);
  });
  it("arquivo que não é zip", async () => {
    await esperarRecusa([], /zip/i, undefined, Buffer.from("isto não é um zip de verdade"));
  });
});

describe("importarMundoZip — versão e indícios (piloto-1.1b)", () => {
  const nivel = (nome = "level.dat"): EntradaDeZip => ({ nome, dados: levelDat("1.21.4", 4189) });

  it("devolve a versão do level.dat e sem indícios num mundo limpo", async () => {
    const { chamada } = await importar([nivel(), ok("region/r.0.0.mca")]);
    const r = await chamada;
    expect(r.versaoMinecraft).toBe("1.21.4");
    expect(r.indicios).toEqual({ plugins: false, mods: false });
  });

  it("level.dat ilegível vira 'desconhecida' e a importação segue", async () => {
    const { chamada, enviar } = await importar([ok("level.dat"), ok("region/r.0.0.mca")]);
    expect((await chamada).versaoMinecraft).toBe("desconhecida");
    expect(enviar).toHaveBeenCalledTimes(1);
  });

  it("sem level.dat também é 'desconhecida' (só avisa)", async () => {
    const { chamada } = await importar([ok("region/r.0.0.mca")]);
    expect((await chamada).versaoMinecraft).toBe("desconhecida");
  });

  it("detecta plugins/ e mods/*.jar", async () => {
    const { chamada } = await importar([
      nivel(),
      ok("plugins/Essentials.jar"),
      ok("mods/sodium.jar"),
    ]);
    expect((await chamada).indicios).toEqual({ plugins: true, mods: true });
  });

  it("mods/ sem .jar não conta como mod", async () => {
    const { chamada } = await importar([nivel(), ok("mods/leiame.txt")]);
    expect((await chamada).indicios.mods).toBe(false);
  });

  it("aceita pasta-raiz única (world/) e o pacote sai com o mundo na raiz", async () => {
    const { raiz, trabalho } = area();
    const zip = join(raiz, "mundo.zip");
    writeFileSync(
      zip,
      montarZip([
        nivel("world/level.dat"),
        { nome: "world/region/r.0.0.mca", dados: randomBytes(300_000) },
      ]),
    );
    const r = await importarMundoZip(zip, {
      pastaDeTrabalho: trabalho,
      epoca: 1,
      enviar: async (p) => {
        const m = await abrirPacote(p.caminho, p.sha256, join(raiz, "aberto"));
        expect(m.arquivos.map((a) => a.caminho)).toEqual(["level.dat", "region/r.0.0.mca"]);
      },
    });
    expect(r.versaoMinecraft).toBe("1.21.4");
  });

  it("pasta-raiz só vale se TUDO está nela (senão não mexe nos caminhos)", async () => {
    const { chamada } = await importar([nivel("world/level.dat"), ok("outro/arquivo")]);
    expect((await chamada).arquivos).toBe(2);
  });
});

describe("analisarZip (piloto-1.1c)", () => {
  it("diz versão, avisos e total sem gravar nada; recusa o hostil", async () => {
    const { raiz } = area();
    const zip = join(raiz, "mundo.zip");
    writeFileSync(
      zip,
      montarZip([
        { nome: "world/level.dat", dados: levelDat("1.20.4", 3700) },
        ok("world/plugins/x.jar"),
        ok("world/mods/y.jar"),
      ]),
    );
    const antes = readdirSync(raiz).sort();
    await expect(analisarZip(zip)).resolves.toEqual({
      arquivos: 3,
      versaoMinecraft: "1.20.4",
      indicios: { plugins: true, mods: true },
    });
    expect(readdirSync(raiz).sort()).toEqual(antes);
    writeFileSync(zip, montarZip([ok("level.dat"), ok("../fora")]));
    await expect(analisarZip(zip)).rejects.toThrow(/recusado/);
    expect(readdirSync(raiz).sort()).toEqual(antes);
  });

  it("importarMundoZip leva o número pedido no manifesto (N+1)", async () => {
    const { raiz, trabalho } = area();
    const zip = join(raiz, "mundo.zip");
    writeFileSync(
      zip,
      montarZip([ok("level.dat"), { nome: "r.mca", dados: randomBytes(300_000) }]),
    );
    let manifesto: { versao: number } | undefined;
    const r = await importarMundoZip(zip, {
      pastaDeTrabalho: trabalho,
      epoca: 4,
      versao: 7,
      enviar: async (p) => {
        manifesto = await abrirPacote(p.caminho, p.sha256, join(raiz, "aberto"));
      },
    });
    expect(r.versao).toBe(7);
    expect(manifesto?.versao).toBe(7);
  });
});
