import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { gerarMundo } from "../../test/ajuda/mundos.js";
import { criarPacote } from "./pacote.js";
import {
  aplicarRotacao,
  conferirPacote,
  planejarRotacao,
  type BackupDaRotacao,
  type EstadoDoBackup,
} from "./rotacao.js";

const pastas: string[] = [];
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});
function pasta(): string {
  const p = mkdtempSync(join(tmpdir(), "sabre-rot-"));
  pastas.push(p);
  return p;
}

/** Nome no padrão do agendador (bkp-1.3). */
function nomeDe(data: Date, versao = 1): string {
  return `${data.toISOString().replace(/[:.]/g, "-")}-v${versao}.tar.gz`;
}
function backup(data: Date, estado: EstadoDoBackup = "bom", versao = 1): BackupDaRotacao {
  return { nome: nomeDe(data, versao), data, estado };
}
const AGORA = new Date(2026, 9, 30, 15, 0, 0); // 30/10/2026 15:00 no fuso local
const horas = (n: number): Date => new Date(AGORA.getTime() - n * 3_600_000);
const nomes = (l: BackupDaRotacao[]): string[] => l.map((b) => b.nome).sort();
function primeiro<T>(l: readonly T[]): T {
  const x = l[0];
  if (x === undefined) throw new Error("lista vazia no teste");
  return x;
}

/** PRNG com semente (mulberry32): sem biblioteca, e uma falha é reproduzível pela semente. */
function prng(semente: number): () => number {
  let s = semente >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

describe("planejarRotacao", () => {
  it("com poucos backups mantém todos", () => {
    const l = [backup(horas(1)), backup(horas(30)), backup(horas(80))];
    const plano = planejarRotacao(l, { agora: AGORA });
    expect(plano.apagar).toEqual([]);
    expect(nomes(plano.manter)).toEqual(nomes(l));
  });

  it("mantém os N mais recentes e TUDO dos últimos 7 dias; apaga o resto", () => {
    // 3 backups por dia, de hoje até 13 dias atrás, sempre às 15h, 11h e 7h.
    const l: BackupDaRotacao[] = [];
    for (let d = 0; d < 14; d++) {
      for (const h of [15, 11, 7]) l.push(backup(new Date(2026, 9, 30 - d, h, 0, 0)));
    }
    const plano = planejarRotacao(l, { agora: AGORA, recentes: 3, dias: 7 });
    const mantidos = new Set(plano.manter.map((b) => b.nome));
    // todos os 21 dos últimos 7 dias ficam (os 3 mais recentes já estão entre eles)
    for (let d = 0; d < 7; d++) {
      for (const h of [15, 11, 7]) {
        expect(mantidos.has(nomeDe(new Date(2026, 9, 30 - d, h, 0, 0)))).toBe(true);
      }
    }
    // 7 dias atrás e além só ficariam pelos N recentes: com N = 3 saem todos
    for (const h of [15, 11, 7]) {
      expect(mantidos.has(nomeDe(new Date(2026, 9, 30 - 7, h, 0, 0)))).toBe(false);
    }
    expect(plano.manter.length + plano.apagar.length).toBe(l.length);
    expect(plano.manter.length).toBe(21);
  });

  it("com N maior que a janela, guarda os N mais novos mesmo fora dos 7 dias", () => {
    const l = Array.from({ length: 20 }, (_, i) => backup(new Date(2026, 9, 30 - i * 2, 12, 0, 0)));
    const plano = planejarRotacao(l, { agora: AGORA, recentes: 10 });
    expect(nomes(plano.manter)).toEqual(nomes(l.slice(0, 10)));
  });

  it("o dia é o dia local, não o UTC", () => {
    // 23h50 e 00h10 locais, dias diferentes mesmo a 20 minutos um do outro.
    const antes = backup(new Date(2026, 9, 28, 23, 50, 0));
    const depois = backup(new Date(2026, 9, 29, 0, 10, 0));
    const plano = planejarRotacao([antes, depois], { agora: AGORA, recentes: 1, dias: 7 });
    expect(plano.apagar).toEqual([]);
  });

  it("sempre mantém o conferido mais recente, mesmo fora das janelas", () => {
    const velho = backup(new Date(2026, 8, 1, 10, 0, 0), "bom");
    const recentes = Array.from({ length: 12 }, (_, i) => backup(horas(i + 1), "ruim"));
    const plano = planejarRotacao([velho, ...recentes], { agora: AGORA, recentes: 10, dias: 7 });
    expect(plano.manter.map((b) => b.nome)).toContain(velho.nome);
  });

  it("nunca apaga o que ainda não foi conferido", () => {
    const l = Array.from({ length: 30 }, (_, i) =>
      backup(horas(i * 24 + 1), i % 2 ? "nao-conferido" : "bom"),
    );
    const plano = planejarRotacao(l, { agora: AGORA, recentes: 2, dias: 1 });
    expect(plano.apagar.filter((b) => b.estado === "nao-conferido")).toEqual([]);
  });

  it("sem nenhum backup bom, não apaga nada", () => {
    const l = Array.from({ length: 30 }, (_, i) => backup(horas(i * 5 + 1), "ruim"));
    expect(planejarRotacao(l, { agora: AGORA, recentes: 2 }).apagar).toEqual([]);
  });

  it("recusa configuração perigosa", () => {
    expect(() => planejarRotacao([], { agora: AGORA, recentes: 0 })).toThrow(/pelo menos 1/);
    expect(() => planejarRotacao([], { agora: AGORA, recentes: 1.5 })).toThrow(/pelo menos 1/);
    expect(() => planejarRotacao([], { agora: AGORA, dias: -1 })).toThrow(/dias/);
  });

  it("recusa nomes repetidos (não dá para saber qual é qual)", () => {
    const b = backup(horas(1));
    expect(() => planejarRotacao([b, { ...b }], { agora: AGORA })).toThrow(/repetido/);
  });

  it("recusa data inválida (não apaga o bom de data válida em favor de um 'bom' sem data)", () => {
    const ruins = Array.from({ length: 15 }, (_, i) => backup(horas(i + 1), "ruim"));
    const bomVelho = backup(new Date(2026, 7, 1, 10, 0, 0));
    const invalido: BackupDaRotacao = { nome: "zzz-v1.tar.gz", data: new Date("x"), estado: "bom" };
    expect(() =>
      planejarRotacao([...ruins, bomVelho, invalido], { agora: AGORA, recentes: 10 }),
    ).toThrow(/data inválida/);
  });

  it("não muda a lista recebida", () => {
    const l = [backup(horas(50)), backup(horas(1))];
    const copia = JSON.stringify(l);
    planejarRotacao(l, { agora: AGORA, recentes: 1 });
    expect(JSON.stringify(l)).toBe(copia);
  });

  it("propriedade: em 3000 sequências aleatórias, as garantias valem sempre", () => {
    const estados: EstadoDoBackup[] = ["bom", "ruim", "nao-conferido"];
    for (let semente = 1; semente <= 3000; semente++) {
      const r = prng(semente);
      const total = Math.floor(r() * 40);
      const l: BackupDaRotacao[] = [];
      const usados = new Set<string>();
      for (let i = 0; i < total; i++) {
        const b = backup(
          new Date(AGORA.getTime() - Math.floor(r() * 20 * 86_400_000)),
          estados[Math.floor(r() * 3)],
        );
        if (!usados.has(b.nome)) {
          usados.add(b.nome);
          l.push(b);
        }
      }
      const recentes = 1 + Math.floor(r() * 12);
      const dias = Math.floor(r() * 9);
      // Em ~1 de cada 8 sequências entra um backup de data inválida: o plano tem de recusar a lista inteira.
      if (r() < 0.125) {
        const invalido: BackupDaRotacao = {
          nome: "zzz-v1.tar.gz",
          data: new Date("x"),
          estado: "bom",
        };
        expect(
          () => planejarRotacao([...l, invalido], { agora: AGORA, recentes, dias }),
          `semente ${semente} (data inválida)`,
        ).toThrow(/data inválida/);
      }
      const plano = planejarRotacao(l, { agora: AGORA, recentes, dias });
      const ctx = `semente ${semente}`;

      // partição exata: nada some nem se repete
      expect(nomes([...plano.manter, ...plano.apagar]), ctx).toEqual(nomes(l));
      expect(
        plano.manter.filter((b) => plano.apagar.includes(b)),
        ctx,
      ).toEqual([]);

      const bons = l
        .filter((b) => b.estado === "bom")
        .sort((a, b) => b.data.getTime() - a.data.getTime());
      // sobra ≥ 1 bom se existia algum, e o mais recente nunca é apagado
      if (bons.length > 0) {
        expect(plano.manter.filter((b) => b.estado === "bom").length, ctx).toBeGreaterThanOrEqual(
          1,
        );
        expect(
          plano.manter.some(
            (b) => b.estado === "bom" && b.data.getTime() === primeiro(bons).data.getTime(),
          ),
          ctx,
        ).toBe(true);
      } else {
        expect(plano.apagar, ctx).toEqual([]);
      }
      // nunca apaga o que não foi conferido
      expect(
        plano.apagar.some((b) => b.estado === "nao-conferido"),
        ctx,
      ).toBe(false);
      // os N mais recentes ficam
      const porData = [...l].sort(
        (a, b) => b.data.getTime() - a.data.getTime() || (a.nome < b.nome ? 1 : -1),
      );
      const mantidos = new Set(plano.manter.map((b) => b.nome));
      if (bons.length > 0)
        for (const b of porData.slice(0, recentes)) expect(mantidos.has(b.nome), ctx).toBe(true);
      // todo backup dos últimos `dias` dias fica
      for (let d = 0; d < dias; d++) {
        const ini = new Date(2026, 9, 30 - d).getTime();
        const fim = new Date(2026, 9, 31 - d).getTime();
        const doDia = porData.filter((b) => b.data.getTime() >= ini && b.data.getTime() < fim);
        if (bons.length > 0)
          for (const b of doDia) expect(mantidos.has(b.nome), ctx).toBe(true);
      }
    }
  }, 60_000);
});

/** Cria arquivos de verdade (conteúdo qualquer) para a aplicação apagar. */
function criarArquivos(dir: string, l: BackupDaRotacao[]): void {
  for (const b of l) writeFileSync(join(dir, b.nome), b.nome);
}

describe("aplicarRotacao", () => {
  const sempreBom = async (): Promise<boolean> => true;

  function cenario(): { dir: string; lista: BackupDaRotacao[] } {
    const dir = pasta();
    const lista = Array.from({ length: 15 }, (_, i) =>
      backup(new Date(2026, 9, 30 - i * 3, 12, 0, 0)),
    );
    criarArquivos(dir, lista);
    return { dir, lista };
  }

  it("simular devolve o resultado sem apagar nada", async () => {
    const { dir, lista } = cenario();
    const plano = planejarRotacao(lista, { agora: AGORA, recentes: 3, dias: 1 });
    expect(plano.apagar.length).toBeGreaterThan(0);
    const r = await aplicarRotacao(dir, plano, { simular: true, conferir: sempreBom });
    expect(nomes(r.apagados)).toEqual(nomes(plano.apagar));
    expect(readdirSync(dir).length).toBe(lista.length);
  });

  it("apaga só o que o plano manda, um a um", async () => {
    const { dir, lista } = cenario();
    const plano = planejarRotacao(lista, { agora: AGORA, recentes: 3, dias: 1 });
    const r = await aplicarRotacao(dir, plano, { conferir: sempreBom });
    expect(r.falhas).toEqual([]);
    expect(readdirSync(dir).sort()).toEqual(nomes(plano.manter));
  });

  it("não apaga nada se o único bom que sobra não passa na conferência de agora", async () => {
    const { dir, lista } = cenario();
    const plano = planejarRotacao(lista, { agora: AGORA, recentes: 1, dias: 0 });
    await expect(aplicarRotacao(dir, plano, { conferir: async () => false })).rejects.toThrow(
      /nenhum backup bom/i,
    );
    expect(readdirSync(dir).length).toBe(lista.length);
  });

  it("aceita se um bom mais velho ainda confere", async () => {
    const { dir, lista } = cenario();
    const plano = planejarRotacao(lista, { agora: AGORA, recentes: 2, dias: 0 });
    const segundo = plano.manter
      .map((b) => b.nome)
      .sort()
      .at(-1);
    const r = await aplicarRotacao(dir, plano, { conferir: async (_d, b) => b.nome !== segundo });
    expect(r.apagados.length).toBe(plano.apagar.length);
  });

  it("com pacote real: o único bom corrompido entre o plano e a aplicação → nada é apagado", async () => {
    const dir = pasta();
    const mundo = gerarMundo({ tamanho: "1MB" });
    pastas.push(mundo);
    const bom = backup(new Date(2026, 9, 1, 10, 0, 0));
    const caminho = join(dir, bom.nome);
    const criado = await criarPacote(mundo, caminho, { versao: 1, epoca: 1 });
    const ruins = Array.from({ length: 5 }, (_, i) =>
      backup(new Date(2026, 9, 20 + i, 9, 0, 0), "ruim"),
    );
    criarArquivos(dir, ruins);
    const lista = [{ ...bom, sha256: criado.sha256 }, ...ruins];
    const plano = planejarRotacao(lista, { agora: AGORA, recentes: 1, dias: 0 });
    expect(plano.manter.map((b) => b.nome)).toContain(bom.nome);
    expect(plano.apagar.length).toBe(4);

    // O pacote bom confere antes...
    expect(await conferirPacote(dir, primeiro(lista))).toBe(true);
    // ...e é corrompido depois do plano (um byte no meio do arquivo .tar.gz).
    const { openSync, writeSync, closeSync } = await import("node:fs");
    const fd = openSync(caminho, "r+");
    writeSync(fd, Buffer.from([0xff, 0xfe, 0xfd, 0xfc]), 0, 4, 100);
    closeSync(fd);
    await expect(aplicarRotacao(dir, plano)).rejects.toThrow(/nenhum backup bom/i);
    expect(readdirSync(dir).length).toBe(1 + ruins.length);
  }, 60_000);

  it("conferirPacote: sem sha256 conhecido não é bom; hash errado também não", async () => {
    const dir = pasta();
    const mundo = gerarMundo({ tamanho: "1MB" });
    pastas.push(mundo);
    const bom = backup(new Date(2026, 9, 1, 10, 0, 0));
    const criado = await criarPacote(mundo, join(dir, bom.nome), { versao: 1, epoca: 1 });
    expect(await conferirPacote(dir, bom)).toBe(false);
    expect(await conferirPacote(dir, { ...bom, sha256: "0".repeat(64) })).toBe(false);
    expect(await conferirPacote(dir, { ...bom, sha256: criado.sha256 })).toBe(true);
  }, 60_000);

  it("nunca apaga arquivo estranho, link, pasta ou nome fora do padrão", async () => {
    const dir = pasta();
    const fora = pasta();
    const alvo = join(fora, "importante.txt");
    writeFileSync(alvo, "x");
    const bons = Array.from({ length: 3 }, (_, i) => backup(new Date(2026, 9, 29 - i, 9, 0, 0)));
    criarArquivos(dir, bons);
    const velho = backup(new Date(2026, 8, 1, 9, 0, 0));
    const comoLink = backup(new Date(2026, 8, 2, 9, 0, 0));
    const comoPasta = backup(new Date(2026, 8, 3, 9, 0, 0));
    writeFileSync(join(dir, velho.nome), "v");
    symlinkSync(alvo, join(dir, comoLink.nome));
    mkdirSync(join(dir, comoPasta.nome));
    const estranho: BackupDaRotacao = {
      nome: "meu-mundo.tar.gz",
      data: new Date(2026, 8, 4),
      estado: "bom",
    };
    const traversal: BackupDaRotacao = {
      nome: "../x-v1.tar.gz",
      data: new Date(2026, 8, 5),
      estado: "bom",
    };
    writeFileSync(join(dir, estranho.nome), "e");
    const plano = {
      manter: bons,
      apagar: [velho, comoLink, comoPasta, estranho, traversal],
    };
    const r = await aplicarRotacao(dir, plano, { conferir: sempreBom });
    expect(nomes(r.apagados)).toEqual([velho.nome]);
    expect(nomes(r.ignorados)).toEqual(nomes([comoLink, comoPasta, estranho, traversal]));
    expect(existsSync(alvo)).toBe(true);
    expect(existsSync(join(dir, comoLink.nome))).toBe(true);
    expect(existsSync(join(dir, comoPasta.nome))).toBe(true);
    expect(existsSync(join(dir, estranho.nome))).toBe(true);
    expect(existsSync(join(dir, velho.nome))).toBe(false);
  });

  it("um link (ou nome fora do padrão) não conta como o bom que fica: nada é apagado", async () => {
    const dir = pasta();
    const fora = pasta();
    const real = backup(new Date(2026, 9, 1, 10, 0, 0));
    const comoLink = backup(new Date(2026, 9, 29, 9, 0, 0));
    const estranho: BackupDaRotacao = {
      nome: "meu-mundo.tar.gz",
      data: new Date(2026, 9, 28),
      estado: "bom",
    };
    writeFileSync(join(fora, "real"), "x");
    symlinkSync(join(fora, "real"), join(dir, comoLink.nome));
    writeFileSync(join(dir, estranho.nome), "e");
    const velhos = Array.from({ length: 3 }, (_, i) =>
      backup(new Date(2026, 8, 1 + i, 9, 0, 0), "ruim"),
    );
    criarArquivos(dir, [...velhos]);
    // A conferência "aprovaria" qualquer coisa (como o abrirPacote, que seguiria o link); o guarda tem de vir antes.
    const plano = { manter: [comoLink, estranho], apagar: velhos };
    await expect(aplicarRotacao(dir, plano, { conferir: sempreBom })).rejects.toThrow(
      /nenhum backup bom/i,
    );
    expect(readdirSync(dir).length).toBe(2 + velhos.length);
    // com o arquivo real mantido, a rotação segue normalmente
    writeFileSync(join(dir, real.nome), "r");
    const ok = await aplicarRotacao(
      dir,
      { manter: [comoLink, real], apagar: velhos },
      { conferir: sempreBom },
    );
    expect(ok.apagados.length).toBe(velhos.length);
  });

  it("recusa plano adulterado: apagar o que também está em manter, ou o não conferido", async () => {
    const dir = pasta();
    const a = backup(new Date(2026, 9, 29, 9, 0, 0));
    const b = backup(new Date(2026, 9, 28, 9, 0, 0), "nao-conferido");
    criarArquivos(dir, [a, b]);
    await expect(
      aplicarRotacao(dir, { manter: [a], apagar: [a] }, { conferir: sempreBom }),
    ).rejects.toThrow(/incoerente/);
    await expect(
      aplicarRotacao(dir, { manter: [a], apagar: [b] }, { conferir: sempreBom }),
    ).rejects.toThrow(/incoerente/);
    await expect(
      aplicarRotacao(dir, { manter: [b], apagar: [] }, { conferir: sempreBom }),
    ).rejects.toThrow(/incoerente/);
    expect(readdirSync(dir).length).toBe(2);
  });
});
