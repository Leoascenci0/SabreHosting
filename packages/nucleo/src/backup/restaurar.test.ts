import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { rename } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { c as criarTar } from "tar";
import { afterEach, describe, expect, it, vi } from "vitest";
import { gerarMundo, hashesDoMundo } from "../../test/ajuda/mundos.js";
import { hashDoArquivo } from "../integridade/hash.js";
import { gerarManifesto } from "./manifesto.js";
import * as pacoteMod from "./pacote.js";
import { abrirPacote, criarPacote } from "./pacote.js";
import { podeSubir } from "../servidor/configurar.js";
import { restaurarBackup } from "./restaurar.js";

// Passa direto para o real; um teste corrompe o backup do atual logo depois de gravado.
vi.mock("./pacote.js", async (original) => {
  const real = await original<typeof import("./pacote.js")>();
  return { ...real, criarPacote: vi.fn(real.criarPacote) };
});

const PRAZO = 30_000;
const pastas: string[] = [];
const opcoesPacote = { versao: 4, epoca: 1 };

afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

/** Mundo "atual" (semente A) e um backup bom de outro estado (semente B), tudo de teste. */
async function cenario() {
  const base = mkdtempSync(join(tmpdir(), "sabre-restaurar-"));
  pastas.push(base);
  const pastaDoMundo = gerarMundo({ tamanho: "1MB", semente: "A", pasta: join(base, "mundo") });
  const outro = gerarMundo({ tamanho: "1MB", semente: "B", pasta: join(base, "outro") });
  const criado = await criarPacote(outro, join(base, "guardado.tar.gz"), opcoesPacote);
  const pastaBackups = join(base, "backups");
  const o = {
    pacote: criado.caminho,
    sha256: criado.sha256,
    pastaDoMundo,
    pastaBackups,
    temTrava: async () => true,
    servidorParado: () => true,
    versao: 5,
    epoca: 2,
    agora: () => new Date("2026-10-31T10:00:00.000Z"),
  };
  return { base, o, antes: hashesDoMundo(pastaDoMundo), depois: hashesDoMundo(outro) };
}

/** Sobras ao lado do mundo (temporária, .antigo) — o mundo e o pacote do cenário não contam. */
function sobras(base: string): string[] {
  return readdirSync(base).filter(
    (n) => !["mundo", "outro", "guardado.tar.gz", "backups"].includes(n),
  );
}

describe("restaurarBackup", () => {
  it(
    "troca o mundo pelo backup, guarda o estado atual e apaga o .antigo",
    async () => {
      const { base, o, antes, depois } = await cenario();
      const r = await restaurarBackup(o);
      expect(hashesDoMundo(o.pastaDoMundo)).toEqual(depois);
      expect(sobras(base)).toEqual([]);
      expect(r.mundoAntigo).toBeUndefined();
      // O backup do estado atual existe, confere e reproduz o mundo de antes.
      const backup = r.backupDoAtual;
      if (backup === undefined) throw new Error("devia ter feito o backup do atual");
      expect(backup.caminho).toBe(join(o.pastaBackups, "2026-10-31T10-00-00-000Z-v5.tar.gz"));
      expect(backup.sha256).toBe(await hashDoArquivo(backup.caminho));
      const conferido = join(base, "conferido");
      await abrirPacote(backup.caminho, backup.sha256, conferido);
      expect(hashesDoMundo(conferido)).toEqual(antes);
      expect(r.restaurado).toMatchObject({ versao: 4, epoca: 1 });
    },
    PRAZO,
  );

  it(
    "manterAntigo guarda o mundo de antes ao lado",
    async () => {
      const { base, o, antes } = await cenario();
      const r = await restaurarBackup({ ...o, manterAntigo: true });
      expect(r.mundoAntigo).toBeDefined();
      expect(hashesDoMundo(r.mundoAntigo ?? "")).toEqual(antes);
      expect(sobras(base)).toHaveLength(1);
    },
    PRAZO,
  );

  it(
    "sem trava, trava com erro ou que não responde: nada muda",
    async () => {
      for (const temTrava of [
        async () => false,
        async () => {
          throw new Error("cartório fora");
        },
        () => new Promise<boolean>(() => undefined),
      ]) {
        const { base, o, antes } = await cenario();
        await expect(restaurarBackup({ ...o, temTrava, prazoTravaMs: 50 })).rejects.toThrow(
          /trava/i,
        );
        expect(hashesDoMundo(o.pastaDoMundo)).toEqual(antes);
        expect(sobras(base)).toEqual([]);
        expect(existsSync(o.pastaBackups)).toBe(false);
      }
    },
    PRAZO,
  );

  it(
    "servidor rodando: nada muda",
    async () => {
      const { base, o, antes } = await cenario();
      await expect(restaurarBackup({ ...o, servidorParado: () => false })).rejects.toThrow(
        /servidor/i,
      );
      expect(hashesDoMundo(o.pastaDoMundo)).toEqual(antes);
      expect(sobras(base)).toEqual([]);
      expect(existsSync(o.pastaBackups)).toBe(false);
    },
    PRAZO,
  );

  it(
    "pacote com hash errado: mundo intacto e sem sobras",
    async () => {
      const { base, o, antes } = await cenario();
      await expect(restaurarBackup({ ...o, sha256: "0".repeat(64) })).rejects.toThrow(
        /hash diferente/,
      );
      expect(hashesDoMundo(o.pastaDoMundo)).toEqual(antes);
      expect(sobras(base)).toEqual([]);
    },
    PRAZO,
  );

  it(
    "falha no meio da extração (arquivo não bate com o manifesto): mundo original intacto",
    async () => {
      const { base, o, antes } = await cenario();
      const outro = join(base, "outro");
      const manifesto = await gerarManifesto(outro, opcoesPacote);
      writeFileSync(join(outro, "manifesto.json"), JSON.stringify(manifesto));
      const ultimo = manifesto.arquivos.at(-1)?.caminho ?? "";
      const dados = readFileSync(join(outro, ultimo));
      dados[0] = (dados[0] ?? 0) ^ 0xff;
      writeFileSync(join(outro, ultimo), dados);
      const ruim = join(base, "ruim.tar.gz");
      await criarTar({ file: ruim, cwd: outro, gzip: true }, [
        "manifesto.json",
        ...manifesto.arquivos.map((a) => a.caminho),
      ]);
      const sha256 = await hashDoArquivo(ruim);
      await expect(restaurarBackup({ ...o, pacote: ruim, sha256 })).rejects.toThrow(
        /não bate com o manifesto/,
      );
      expect(hashesDoMundo(o.pastaDoMundo)).toEqual(antes);
      expect(sobras(base).filter((n) => n !== "ruim.tar.gz")).toEqual([]);
      // O backup do estado atual foi feito antes, e fica.
      expect(readdirSync(o.pastaBackups)).toHaveLength(1);
    },
    PRAZO,
  );

  it(
    "falha entre os dois renames: o mundo original volta",
    async () => {
      const { base, o, antes } = await cenario();
      let chamadas = 0;
      const renomear = vi.fn(async (de: string, para: string) => {
        if (++chamadas === 2) throw new Error("disco falhou");
        await rename(de, para);
      });
      await expect(restaurarBackup({ ...o, renomear })).rejects.toThrow(/mundo continua/i);
      expect(renomear).toHaveBeenCalledTimes(3); // mundo→antigo, temp→mundo (falha), antigo→mundo (desfaz)
      expect(hashesDoMundo(o.pastaDoMundo)).toEqual(antes);
      expect(sobras(base)).toEqual([]);
    },
    PRAZO,
  );

  it(
    "trava perdida durante a extração: reconfere antes da troca e nada muda",
    async () => {
      const { base, o, antes } = await cenario();
      const temTrava = vi.fn().mockResolvedValueOnce(true).mockResolvedValue(false);
      await expect(restaurarBackup({ ...o, temTrava })).rejects.toThrow(/trava/i);
      expect(temTrava).toHaveBeenCalledTimes(2);
      expect(hashesDoMundo(o.pastaDoMundo)).toEqual(antes);
      expect(sobras(base)).toEqual([]);
    },
    PRAZO,
  );

  it(
    "servidor que sobe durante a extração: reconfere antes da troca e nada muda",
    async () => {
      const { base, o, antes } = await cenario();
      const servidorParado = vi.fn().mockReturnValueOnce(true).mockReturnValue(false);
      await expect(restaurarBackup({ ...o, servidorParado })).rejects.toThrow(/servidor/i);
      expect(hashesDoMundo(o.pastaDoMundo)).toEqual(antes);
      expect(sobras(base)).toEqual([]);
    },
    PRAZO,
  );

  it(
    "backup do estado atual que não confere: descartado e o mundo não muda",
    async () => {
      const { base, o, antes } = await cenario();
      vi.mocked(pacoteMod.criarPacote).mockImplementationOnce(async (...a) => {
        const r = await vi
          .importActual<typeof pacoteMod>("./pacote.js")
          .then((m) => m.criarPacote(...a));
        const dados = readFileSync(r.caminho);
        const i = Math.floor(dados.length / 2);
        dados[i] = (dados[i] ?? 0) ^ 0x01;
        writeFileSync(r.caminho, dados); // o hash devolvido já não bate com o arquivo
        return r;
      });
      await expect(restaurarBackup(o)).rejects.toThrow(/não passou na conferência/);
      expect(hashesDoMundo(o.pastaDoMundo)).toEqual(antes);
      expect(sobras(base)).toEqual([]);
      expect(readdirSync(o.pastaBackups)).toEqual([]);
    },
    PRAZO,
  );

  it(
    "mundo inexistente: restaura direto, sem backup do atual nem .antigo",
    async () => {
      const { base, o, depois } = await cenario();
      rmSync(o.pastaDoMundo, { recursive: true });
      const r = await restaurarBackup(o);
      expect(r.backupDoAtual).toBeUndefined();
      expect(hashesDoMundo(o.pastaDoMundo)).toEqual(depois);
      expect(sobras(base)).toEqual([]);
      expect(existsSync(o.pastaBackups)).toBe(false);
    },
    PRAZO,
  );

  it(
    "pasta do mundo vazia: segue como com mundo (faz backup e troca)",
    async () => {
      const { o, depois } = await cenario();
      rmSync(o.pastaDoMundo, { recursive: true });
      mkdirSync(o.pastaDoMundo);
      const r = await restaurarBackup(o);
      expect(hashesDoMundo(o.pastaDoMundo)).toEqual(depois);
      expect(r.backupDoAtual).toBeDefined();
    },
    PRAZO,
  );

  it(
    "caminho do mundo com barra no fim: a temporária fica ao lado, não dentro",
    async () => {
      const { base, o, depois } = await cenario();
      await restaurarBackup({ ...o, pastaDoMundo: `${o.pastaDoMundo}/` });
      expect(hashesDoMundo(o.pastaDoMundo)).toEqual(depois);
      expect(sobras(base)).toEqual([]);
      expect(readdirSync(o.pastaDoMundo).some((n) => n.includes("restaurando"))).toBe(false);
    },
    PRAZO,
  );

  it(
    "nem o desfazer funciona: erro diz onde está tudo e o servidor não sobe",
    async () => {
      const { base, o, antes } = await cenario();
      let n = 0;
      const renomear = async (de: string, para: string) => {
        if (++n >= 2) throw new Error("EPERM");
        await rename(de, para);
      };
      const erro = await restaurarBackup({ ...o, renomear }).catch((e: Error) => e);
      expect(erro).toBeInstanceOf(Error);
      const texto = (erro as Error).message;
      const antigo = readdirSync(base).find((x) => x.startsWith("mundo.antigo-")) ?? "";
      expect(texto).toContain(join(base, antigo));
      expect(texto).toContain(o.pastaBackups);
      expect(texto).not.toMatch(/^EPERM/);
      expect(hashesDoMundo(join(base, antigo))).toEqual(antes); // o mundo de antes está inteiro
      expect(existsSync(join(base, "RESTAURACAO-INCOMPLETA.txt"))).toBe(true);
      writeFileSync(join(base, "eula.txt"), "eula=true\n");
      expect((await podeSubir(base)).pode).toBe(false);
    },
    PRAZO,
  );

  it(
    "nunca escreve por cima de um backup que já existe",
    async () => {
      const { base, o, antes } = await cenario();
      const existente = join(o.pastaBackups, "2026-10-31T10-00-00-000Z-v5.tar.gz");
      await criarPacote(o.pastaDoMundo, existente, opcoesPacote);
      const antesDoBackup = readFileSync(existente);
      await expect(restaurarBackup(o)).rejects.toThrow(/já existe/i);
      expect(readFileSync(existente).equals(antesDoBackup)).toBe(true);
      expect(hashesDoMundo(o.pastaDoMundo)).toEqual(antes);
      expect(sobras(base)).toEqual([]);
    },
    PRAZO,
  );
});
