import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { hashesDoMundo } from "../../test/ajuda/mundos.js";
import { MARCADOR_TROCA } from "../servidor/configurar.js";
import { recuperarTroca } from "../backup/restaurar.js";

const pastas: string[] = [];
afterEach(() => {
  for (const p of pastas.splice(0)) rmSync(p, { recursive: true, force: true });
});

function base() {
  const raiz = mkdtempSync(join(tmpdir(), "sabre-marc-"));
  pastas.push(raiz);
  const servidor = join(raiz, "servidor");
  const mundo = join(servidor, "mundo");
  mkdirSync(join(mundo, "region"), { recursive: true });
  writeFileSync(join(mundo, "level.dat"), "vivo");
  writeFileSync(join(mundo, "region", "r.0.0.mca"), "regiao");
  writeFileSync(join(servidor, "importante.txt"), "fora do mundo");
  writeFileSync(join(servidor, "server.properties"), "level-name=mundo\n");
  mkdirSync(join(servidor, "mods", "region"), { recursive: true });
  writeFileSync(join(servidor, "mods", "region", "r.0.0.mca"), "nao-e-mundo");
  return { raiz, servidor, mundo };
}
const marcar = (servidor: string, m: unknown) =>
  writeFileSync(join(servidor, MARCADOR_TROCA), JSON.stringify(m));

describe("marcador de reset adulterado (S-07): não apaga nada", () => {
  const casos: [string, (mundo: string, raiz: string) => unknown][] = [
    [
      "rel com ..",
      (mundo) => ({
        tipo: "reset",
        mundo,
        sufixo: "2026",
        fase: "trocando",
        arquivos: [{ rel: "../importante.txt", apagar: false }],
      }),
    ],
    [
      "rel absoluto",
      (mundo, raiz) => ({
        tipo: "reset",
        mundo,
        sufixo: "2026",
        fase: "trocando",
        arquivos: [{ rel: join(raiz, "x"), apagar: false }],
      }),
    ],
    [
      "rel fora do padrão",
      (mundo) => ({
        tipo: "reset",
        mundo,
        sufixo: "2026",
        fase: "trocando",
        arquivos: [{ rel: "level.dat", apagar: false }],
      }),
    ],
    [
      "sufixo com barra",
      (mundo) => ({
        tipo: "reset",
        mundo,
        sufixo: "../x",
        fase: "trocando",
        arquivos: [{ rel: "region/r.0.0.mca", apagar: false }],
      }),
    ],
    [
      "mundo fora da pasta do servidor",
      (_m, raiz) => ({
        tipo: "reset",
        mundo: raiz,
        sufixo: "2026",
        fase: "trocando",
        arquivos: [],
      }),
    ],
    [
      "fase desconhecida",
      (mundo) => ({ tipo: "reset", mundo, sufixo: "2026", fase: "xis", arquivos: [] }),
    ],
    [
      "arquivos não é lista",
      (mundo) => ({ tipo: "reset", mundo, sufixo: "2026", fase: "trocando", arquivos: "x" }),
    ],
  ];
  for (const [nome, f] of casos) {
    it(nome, async () => {
      const { raiz, servidor, mundo } = base();
      const antes = hashesDoMundo(raiz);
      marcar(servidor, f(mundo, raiz));
      const depois = hashesDoMundo(raiz);
      await expect(recuperarTroca(servidor)).rejects.toThrow(/aviso da troca/);
      const apos = hashesDoMundo(raiz);
      expect(apos).toEqual(depois); // nada mudou nem sumiu; o marcador fica
      expect(Object.keys(apos)).toEqual(expect.arrayContaining(Object.keys(antes)));
    });
  }

  it("mundo forjado: outra pasta filha do servidor (mods) não é obedecida; nada é renomeado nem apagado", async () => {
    const { servidor } = base();
    const mods = join(servidor, "mods");
    const antes = hashesDoMundo(servidor);
    for (const fase of ["trocando", "concluido"]) {
      marcar(servidor, {
        tipo: "reset",
        mundo: mods,
        sufixo: "2026",
        fase,
        arquivos: [{ rel: "region/r.0.0.mca", apagar: true }],
      });
      await expect(recuperarTroca(servidor)).rejects.toThrow(/aviso da troca/);
    }
    const depois = Object.fromEntries(
      Object.entries(hashesDoMundo(servidor)).filter(([c]) => c !== MARCADOR_TROCA),
    );
    expect(depois).toEqual(antes);
  });

  it("level-name do server.properties com barra ou ponto vira 'world' (mundo de nome mundo é recusado)", async () => {
    const { servidor, mundo } = base();
    writeFileSync(join(servidor, "server.properties"), "level-name=../mundo\n");
    marcar(servidor, { tipo: "reset", mundo, sufixo: "2026", fase: "concluido", arquivos: [] });
    await expect(recuperarTroca(servidor)).rejects.toThrow(/aviso da troca/);
  });

  it("marcador legítimo sem mundo nem .antigo: erro, nada apagado", async () => {
    const { servidor, mundo } = base();
    rmSync(join(mundo, "region", "r.0.0.mca"));
    marcar(servidor, {
      tipo: "reset",
      mundo,
      sufixo: "2026",
      fase: "trocando",
      arquivos: [{ rel: "region/r.0.0.mca", apagar: false }],
    });
    await expect(recuperarTroca(servidor)).rejects.toThrow();
    expect(hashesDoMundo(servidor)["mundo/level.dat"]).toBeDefined();
  });
});
