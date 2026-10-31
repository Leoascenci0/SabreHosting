import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, truncateSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { nomeDoBackup } from "@sabrehosting/nucleo/backup/agendador";
import { criarPacote } from "@sabrehosting/nucleo/backup/pacote";
import { marcarBackup } from "@sabrehosting/nucleo/backup/rotacao-pasta";
import { gerarMundo } from "../../../../packages/nucleo/test/ajuda/mundos.js";
import { criarRotacaoBackups, type DepsRotacao } from "./rotacao-backups.js";

const AGORA = new Date(2026, 9, 30, 15, 0, 0);
const nomeEm = (diasAtras: number): string =>
  nomeDoBackup(new Date(2026, 9, 30 - diasAtras, 12, 0, 0), 1);

let raiz: string;
let modelo: { caminho: string; sha256: string };
beforeAll(async () => {
  raiz = mkdtempSync(join(tmpdir(), "sabre-rotapp-"));
  const mundo = gerarMundo({ tamanho: "1MB" }); // mundo inventado, nunca o dos amigos
  const caminho = join(raiz, "modelo.tar.gz");
  modelo = { caminho, sha256: (await criarPacote(mundo, caminho, { versao: 1, epoca: 1 })).sha256 };
  rmSync(mundo, { recursive: true, force: true });
});
afterAll(() => rmSync(raiz, { recursive: true, force: true }));

function pastaVazia(): string {
  const p = join(mkdtempSync(join(raiz, "c-")), "backups");
  mkdirSync(p);
  return p;
}
const pacotes = (p: string): string[] =>
  readdirSync(p)
    .filter((n) => n.endsWith(".tar.gz"))
    .sort();

/** Simula a agenda: chega um backup bom por vez, do mais velho ao mais novo (como `aoConcluir`). */
async function chegarEmOrdem(pasta: string, deps: Partial<DepsRotacao>, nomes: string[]) {
  const rot = criarRotacaoBackups({
    pastaBackups: () => pasta,
    quantosGuardar: () => 3,
    agora: () => AGORA,
    ...deps,
  });
  for (const n of [...nomes].reverse()) {
    copyFileSync(modelo.caminho, join(pasta, n));
    await rot.aoBackupBom({ caminho: join(pasta, n), sha256: modelo.sha256 });
  }
  return rot;
}

describe("rotação ligada ao app", () => {
  // 12 backups, um a cada 2 dias; dentro dos 7 dias: 0, 2, 4 e 6 dias atrás.
  const nomes = Array.from({ length: 12 }, (_, i) => nomeEm(i * 2));

  it("quantosGuardar=3: sobram os 3 mais novos + a janela dos 7 dias; o resto some", async () => {
    const pasta = pastaVazia();
    await chegarEmOrdem(pasta, { quantosGuardar: () => 3 }, nomes);
    expect(pacotes(pasta)).toEqual(nomes.slice(0, 4).sort());
  });

  it("quantosGuardar=6: o valor salvo muda quantos ficam", async () => {
    const pasta = pastaVazia();
    await chegarEmOrdem(pasta, { quantosGuardar: () => 6 }, nomes);
    expect(pacotes(pasta)).toEqual(nomes.slice(0, 6).sort());
  });

  it("backup bom que acabou de chegar nunca é apagado, mesmo com quantosGuardar=1", async () => {
    const pasta = pastaVazia();
    await chegarEmOrdem(pasta, { quantosGuardar: () => 1 }, nomes);
    expect(pacotes(pasta)).toContain(nomes[0]);
  });

  it("não roda durante restauração nem sem pasta", async () => {
    const pasta = pastaVazia();
    const avisos: string[] = [];
    const ocupada = await chegarEmOrdem(
      pasta,
      { ocupado: () => true, aoAvisar: (t) => avisos.push(t) },
      nomes,
    );
    expect(pacotes(pasta).length).toBe(12);
    expect(await ocupada.rodar()).toBeUndefined();
    const sem = criarRotacaoBackups({ pastaBackups: () => undefined, quantosGuardar: () => 3 });
    expect(await sem.rodar()).toBeUndefined();
    await sem.aoBackupBom({ caminho: "/x/y.tar.gz", sha256: modelo.sha256 });
  });

  it("duas rotações ao mesmo tempo: a segunda pula (S-06)", async () => {
    const pasta = pastaVazia();
    let chamadas = 0;
    let soltar!: () => void;
    const rot = criarRotacaoBackups({
      pastaBackups: () => pasta,
      quantosGuardar: () => 3,
      rotacionar: async () => {
        chamadas++;
        await new Promise<void>((ok) => (soltar = ok));
        return { apagados: [], ignorados: [], falhas: [] };
      },
    });
    const a = rot.rodar();
    expect(await rot.rodar()).toBeUndefined();
    soltar();
    await a;
    expect(chamadas).toBe(1);
    void rot.rodar();
    expect(chamadas).toBe(2); // libera de novo depois que a primeira termina
  });

  it("nenhum bom passou na conferência: vira aviso e nada é apagado", async () => {
    const pasta = pastaVazia();
    const avisos: string[] = [];
    const velhos = Array.from({ length: 6 }, (_, i) => nomeEm(10 + i));
    for (const n of velhos) {
      copyFileSync(modelo.caminho, join(pasta, n));
      marcarBackup(pasta, n, "bom", modelo.sha256);
      truncateSync(join(pasta, n), 100); // corrompido depois de marcado
    }
    const rot = criarRotacaoBackups({
      pastaBackups: () => pasta,
      quantosGuardar: () => 1,
      agora: () => AGORA,
      aoAvisar: (t) => avisos.push(t),
    });
    expect(await rot.rodar()).toBeUndefined();
    expect(pacotes(pasta)).toEqual([...velhos].sort());
    expect(avisos.join(" ")).toMatch(/Não apaguei backups antigos/);
  });
});
