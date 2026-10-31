import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  renameSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { copyFile, mkdir, rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { gerarMundo, hashesDoMundo } from "../../test/ajuda/mundos.js";
import { MARCADOR_TROCA, podeSubir } from "../servidor/configurar.js";
import { aplicarDelta } from "../sync/aplicar.js";
import { gerarManifesto } from "./manifesto.js";
import { gravarMarcadorTroca, recuperarTroca, restaurarBackup } from "./restaurar.js";
import { criarPacote } from "./pacote.js";

const pastas: string[] = [];
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});
const KILL = new Error("kill simulado");
const matar = () => {
  throw KILL;
};

/** Servidor com EULA aceito e mundo N inventado; `M` é o mundo remoto (mudado). */
async function cenario() {
  const base = mkdtempSync(join(tmpdir(), "sabre-troca-"));
  pastas.push(base);
  const mundo = gerarMundo({ tamanho: "1MB", semente: "A", pasta: join(base, "mundo") });
  writeFileSync(join(base, "eula.txt"), "eula=true\n");
  const remoto = join(base, "remoto");
  cpSync(mundo, remoto, { recursive: true });
  writeFileSync(join(remoto, "region", "r.0.0.mca"), "região mudada no host");
  const alvo = await gerarManifesto(remoto, { versao: 7, epoca: 2 });
  return { base, mundo, remoto, alvo, antes: hashesDoMundo(mundo) };
}

/** Disco como fica se o app morre entre os dois rename. */
function estadoPosKill(base: string, mundo: string) {
  const antigo = `${mundo}.antigo-v7`;
  const temp = `${mundo}.atualizando-v7`;
  renameSync(mundo, antigo);
  mkdirSync(temp);
  writeFileSync(join(temp, "parcial.mca"), "x");
  writeFileSync(join(base, MARCADOR_TROCA), JSON.stringify({ mundo, antigo, temp }));
  return { antigo, temp };
}

describe("recuperarTroca", () => {
  it("pós-kill: podeSubir recusa e a recuperação devolve N com os mesmos hashes", async () => {
    const { base, mundo, antes } = await cenario();
    const { antigo, temp } = estadoPosKill(base, mundo);
    expect((await podeSubir(base)).pode).toBe(false);
    expect(await recuperarTroca(base)).toBe("desfez");
    expect(hashesDoMundo(mundo)).toEqual(antes);
    expect(existsSync(antigo)).toBe(false); // foi renomeado de volta, nada duplicado
    expect(existsSync(temp)).toBe(false);
    expect(existsSync(join(base, MARCADOR_TROCA))).toBe(false);
    expect((await podeSubir(base)).pode).toBe(true);
  });

  it("mundo presente + marcador: só limpa; o .antigo (último mundo bom) fica", async () => {
    const { base, mundo, antes } = await cenario();
    const antigo = `${mundo}.antigo-v7`;
    const temp = `${mundo}.atualizando-v7`;
    cpSync(mundo, antigo, { recursive: true });
    mkdirSync(temp);
    await gravarMarcadorTroca({ mundo, antigo, temp });
    expect(await recuperarTroca(base)).toBe("limpou");
    expect(hashesDoMundo(mundo)).toEqual(antes);
    expect(hashesDoMundo(antigo)).toEqual(antes);
    expect(existsSync(temp)).toBe(false);
    expect(existsSync(join(base, MARCADOR_TROCA))).toBe(false);
  });

  it("sem marcador não faz nada; marcador sem mundo e sem .antigo mantém a trava e erra", async () => {
    const { base, mundo } = await cenario();
    expect(await recuperarTroca(base)).toBe("nada");
    rmSync(mundo, { recursive: true });
    await gravarMarcadorTroca({
      mundo,
      antigo: `${mundo}.antigo-v7`,
      temp: `${mundo}.atualizando-v7`,
    });
    await expect(recuperarTroca(base)).rejects.toThrow(/nem o mundo nem/);
    expect((await podeSubir(base)).pode).toBe(false);
  });

  it("marcador ilegível ou apontando para fora da pasta não é obedecido", async () => {
    const { base } = await cenario();
    writeFileSync(join(base, MARCADOR_TROCA), "{lixo");
    await expect(recuperarTroca(base)).rejects.toThrow(/ilegível/);
    const fora = mkdtempSync(join(tmpdir(), "sabre-fora-"));
    pastas.push(fora);
    writeFileSync(
      join(base, MARCADOR_TROCA),
      JSON.stringify({ mundo: join(fora, "m"), antigo: join(fora, "a"), temp: join(fora, "t") }),
    );
    await expect(recuperarTroca(base)).rejects.toThrow(/ilegível/);
    expect((await podeSubir(base)).pode).toBe(false);
  });
});

describe("kill entre os dois rename", () => {
  it("aplicarDelta: morreu entre os renames → servidor não sobe até recuperar; N volta", async () => {
    const { base, mundo, remoto, alvo, antes } = await cenario();
    await expect(
      aplicarDelta({
        pastaDoMundo: mundo,
        alvo,
        baixar: async (a, destino) => {
          await mkdir(dirname(destino), { recursive: true });
          await copyFile(join(remoto, a.caminho), destino);
        },
        temAtualizacao: async () => true,
        hospedaAgora: async () => false,
        servidorParado: () => true,
        avisarCopia: async () => undefined,
        aposPrimeiroRename: matar,
      }),
    ).rejects.toBe(KILL);
    expect(existsSync(mundo)).toBe(false);
    expect((await podeSubir(base)).pode).toBe(false);
    expect(await recuperarTroca(base)).toBe("desfez");
    expect(hashesDoMundo(mundo)).toEqual(antes);
    expect((await podeSubir(base)).pode).toBe(true);
  });

  it("restaurarBackup: morreu entre os renames → N volta", async () => {
    const { base, mundo, remoto, antes } = await cenario();
    const pacote = await criarPacote(remoto, join(base, "guardado.tar.gz"), {
      versao: 4,
      epoca: 1,
    });
    await expect(
      restaurarBackup({
        pacote: pacote.caminho,
        sha256: pacote.sha256,
        pastaDoMundo: mundo,
        pastaBackups: join(base, "backups"),
        temTrava: async () => true,
        servidorParado: () => true,
        versao: 5,
        epoca: 1,
        aposPrimeiroRename: matar,
      }),
    ).rejects.toBe(KILL);
    expect((await podeSubir(base)).pode).toBe(false);
    expect(await recuperarTroca(base)).toBe("desfez");
    expect(hashesDoMundo(mundo)).toEqual(antes);
    expect(
      readdirSync(base).filter((n) => n.includes("restaurando") || n === MARCADOR_TROCA),
    ).toEqual([]);
  });

  it("sem kill, o marcador não sobra (troca normal)", async () => {
    const { base, mundo, remoto, alvo } = await cenario();
    await aplicarDelta({
      pastaDoMundo: mundo,
      alvo,
      baixar: async (a, destino) => {
        await mkdir(dirname(destino), { recursive: true });
        await copyFile(join(remoto, a.caminho), destino);
      },
      temAtualizacao: async () => true,
      hospedaAgora: async () => false,
      servidorParado: () => true,
      avisarCopia: async () => undefined,
      renomear: rename,
    });
    expect(existsSync(join(base, MARCADOR_TROCA))).toBe(false);
  });
});

describe("marcador forjado ou fora do lugar", () => {
  it("temp igual ao mundo ou apontando para mods/: recusa e não apaga nada", async () => {
    const { base, mundo, antes } = await cenario();
    mkdirSync(join(base, "mods"));
    writeFileSync(join(base, "mods", "a.jar"), "x");
    for (const temp of [mundo, join(base, "mods")]) {
      writeFileSync(
        join(base, MARCADOR_TROCA),
        JSON.stringify({ mundo, antigo: `${mundo}.antigo-v7`, temp }),
      );
      await expect(recuperarTroca(base)).rejects.toThrow(/ilegível/);
      expect(hashesDoMundo(mundo)).toEqual(antes);
      expect(existsSync(join(base, "mods", "a.jar"))).toBe(true);
    }
    // antigo e temp iguais entre si também não vale
    const igual = `${mundo}.antigo-v7`;
    writeFileSync(
      join(base, MARCADOR_TROCA),
      JSON.stringify({ mundo, antigo: igual, temp: igual }),
    );
    await expect(recuperarTroca(base)).rejects.toThrow(/ilegível/);
  });

  it("mundo fora da pasta do servidor: aplicarDelta e restaurarBackup recusam antes de mexer", async () => {
    const { base, mundo, remoto, alvo, antes } = await cenario();
    const outra = join(base, "outra");
    mkdirSync(outra);
    await expect(
      aplicarDelta({
        pastaDoMundo: mundo,
        pastaDoServidor: outra,
        alvo,
        baixar: async () => undefined,
        temAtualizacao: async () => true,
        hospedaAgora: async () => false,
        servidorParado: () => true,
        avisarCopia: async () => undefined,
      }),
    ).rejects.toThrow(/dentro da pasta do servidor/);
    const pacote = await criarPacote(remoto, join(base, "guardado.tar.gz"), {
      versao: 4,
      epoca: 1,
    });
    await expect(
      restaurarBackup({
        pacote: pacote.caminho,
        sha256: pacote.sha256,
        pastaDoMundo: mundo,
        pastaDoServidor: outra,
        pastaBackups: join(base, "backups"),
        temTrava: async () => true,
        servidorParado: () => true,
        versao: 5,
        epoca: 1,
      }),
    ).rejects.toThrow(/dentro da pasta do servidor/);
    expect(hashesDoMundo(mundo)).toEqual(antes);
    expect(readdirSync(base).sort()).toEqual([
      "eula.txt",
      "guardado.tar.gz",
      "mundo",
      "outra",
      "remoto",
    ]);
  });
});
