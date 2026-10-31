import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { lerConfigPc } from "./config-pc.js";
import { criarPastaBase } from "./pasta-base.js";

let raiz: string;
let dados: string;
let antiga: string;
let nova: string;
beforeEach(() => {
  raiz = mkdtempSync(join(tmpdir(), "sabre-pasta-"));
  dados = join(raiz, "dados");
  antiga = join(raiz, "Antiga");
  nova = join(raiz, "Nova");
  mkdirSync(dados);
  mkdirSync(join(antiga, "servidor", "world"), { recursive: true });
  mkdirSync(join(antiga, "mundos"), { recursive: true });
  writeFileSync(join(antiga, "servidor", "world", "level.dat"), "mundo-de-teste");
  writeFileSync(join(antiga, "servidor", "eula.txt"), "eula=true\n");
  writeFileSync(
    join(dados, "boas-vindas.json"),
    JSON.stringify({
      grupo: { nome: "G" },
      portaCartorio: 7710,
      concluido: true,
      pastaBase: antiga,
    }),
  );
});
afterEach(() => rmSync(raiz, { recursive: true, force: true }));

const cofre = { ler: async () => "tk" };
function montar(rodando = false) {
  return criarPastaBase({ dados, servidorRodando: () => rodando });
}

describe("pasta do SabreHosting (appmel-1.13)", () => {
  it("estado mostra a pasta gravada pelo assistente", () => {
    expect(montar().estado()).toEqual({ pasta: antiga });
  });

  it("trocar atualiza onde servidor, mundo e backups são lidos, sem mexer no mundo antigo", async () => {
    const r = await montar().trocar(nova);
    expect(r).toEqual({ ok: true, anterior: antiga });
    const c = await lerConfigPc(dados, cofre, {});
    expect(c).toMatchObject({
      pastaBase: nova,
      pastaServidor: join(nova, "servidor"),
      pastaMundo: join(nova, "servidor", "world"),
      pastaBackups: join(nova, "mundos"),
      grupo: "G",
    });
    expect(existsSync(join(nova, "mundos"))).toBe(true);
    expect(readFileSync(join(nova, "servidor", "eula.txt"), "utf8")).toBe("eula=true\n");
    // regra de ouro: o mundo antigo continua onde estava, intacto, e nada foi copiado para a nova
    expect(readFileSync(join(antiga, "servidor", "world", "level.dat"), "utf8")).toBe(
      "mundo-de-teste",
    );
    expect(existsSync(join(nova, "servidor", "world"))).toBe(false);
  });

  it("servidor rodando: recusa com mensagem fixa e não grava nada", async () => {
    const r = await montar(true).trocar(nova);
    expect(r).toEqual({
      ok: false,
      mensagem: "Pare o servidor antes de trocar a pasta do SabreHosting.",
    });
    expect((await lerConfigPc(dados, cofre, {})).pastaBase).toBe(antiga);
    expect(existsSync(nova)).toBe(false);
  });

  it.each(["relativa/pasta", "C:\\", "C:\\Windows\\x", `${"/tmp"}/../etc`, 42, ""])(
    "pasta torta %j é recusada",
    async (torta) => {
      const r = await montar().trocar(torta);
      expect(r.ok).toBe(false);
      expect((await lerConfigPc(dados, cofre, {})).pastaBase).toBe(antiga);
    },
  );

  it("mesma pasta: avisa e não muda nada", async () => {
    const r = await montar().trocar(antiga);
    expect(r).toEqual({ ok: false, mensagem: "Essa já é a pasta do SabreHosting." });
  });

  it("sem assistente concluído: recusa", async () => {
    rmSync(join(dados, "boas-vindas.json"));
    const r = await montar().trocar(nova);
    expect(r.ok).toBe(false);
    expect(montar().estado()).toEqual({});
  });

  it("falha de disco vira mensagem fixa, sem caminho, e a pasta antiga continua valendo", async () => {
    writeFileSync(nova, "arquivo no lugar da pasta"); // não dá para criar nova\servidor
    const r = await montar().trocar(nova);
    expect(r).toEqual({ ok: false, mensagem: "Não consegui preparar a pasta. Escolha outra." });
    expect((await lerConfigPc(dados, cofre, {})).pastaBase).toBe(antiga);
  });

  it("trocada() só vale depois de uma troca que deu certo (appmel-1.16)", async () => {
    const pb = montar();
    expect(pb.trocada()).toBe(false);
    expect((await pb.trocar(antiga)).ok).toBe(false); // igual: falha
    expect(pb.trocada()).toBe(false);
    expect((await pb.trocar(nova)).ok).toBe(true);
    expect(pb.trocada()).toBe(true);
  });
});
