import { EventEmitter } from "node:events";
import { describe, expect, it, vi } from "vitest";
import { criarAgendaBackups, type ServidorObservado } from "./agenda-backups.js";

class Falso extends EventEmitter implements ServidorObservado {
  estado = "subindo";
  mudar(estado: string): void {
    this.estado = estado;
    this.emit("estado", { estado });
  }
}
const vazio = () => new Promise((ok) => setImmediate(ok));

function montar(intervalo = 10) {
  const eventos: string[] = [];
  let min = intervalo;
  const agenda = criarAgendaBackups<Falso>({
    intervaloMin: () => min,
    iniciar: async (_s, m) => {
      eventos.push(`liga ${m}`);
      return { parar: async () => void eventos.push(`para ${m}`) };
    },
    aoAvisar: (t) => void eventos.push(`aviso: ${t}`),
  });
  return { agenda, eventos, definir: (m: number) => (min = m) };
}

describe("agenda de backups", () => {
  it("só liga quando o servidor fica pronto, com o intervalo salvo", async () => {
    const { agenda, eventos } = montar(15);
    const s = new Falso();
    agenda.observar(s);
    await vazio();
    expect(eventos).toEqual([]); // subindo: nada de backup
    s.mudar("pronto");
    await vazio();
    expect(eventos).toEqual(["liga 15"]);
    expect(agenda.ativa()).toBe(true);
  });

  it.each(["parando", "parado", "caiu"])("para quando o servidor vai para '%s'", async (fim) => {
    const { agenda, eventos } = montar();
    const s = new Falso();
    agenda.observar(s);
    s.mudar("pronto");
    await vazio();
    s.mudar(fim);
    await vazio();
    expect(eventos).toEqual(["liga 10", "para 10"]);
    expect(agenda.ativa()).toBe(false);
  });

  it("reagendar recomeça com o novo intervalo; sem servidor pronto não faz nada", async () => {
    const { agenda, eventos, definir } = montar();
    agenda.reagendar();
    await vazio();
    expect(eventos).toEqual([]);
    const s = new Falso();
    agenda.observar(s);
    s.mudar("pronto");
    await vazio();
    definir(30);
    agenda.reagendar();
    await vazio();
    expect(eventos).toEqual(["liga 10", "para 10", "liga 30"]);
  });

  it("servidor que já nasce pronto liga na hora", async () => {
    const { agenda, eventos } = montar();
    const s = new Falso();
    s.estado = "pronto";
    agenda.observar(s);
    await vazio();
    expect(eventos).toEqual(["liga 10"]);
  });

  it("parar enquanto o agendador ainda estava sendo preparado não deixa agenda órfã", async () => {
    const eventos: string[] = [];
    let liberar: () => void = () => undefined;
    const agenda = criarAgendaBackups<Falso>({
      intervaloMin: () => 10,
      iniciar: async () => {
        await new Promise<void>((ok) => (liberar = ok));
        return { parar: async () => void eventos.push("para") };
      },
    });
    const s = new Falso();
    agenda.observar(s);
    s.mudar("pronto");
    await vazio();
    s.mudar("parando");
    liberar();
    await vazio();
    await vazio();
    expect(eventos).toEqual(["para"]);
    expect(agenda.ativa()).toBe(false);
  });

  it("dois reagendar seguidos com backup em curso deixam um só agendador ativo", async () => {
    const vivos = new Set<number>();
    let n = 0;
    const soltar: (() => void)[] = [];
    let intervalo = 10;
    const agenda = criarAgendaBackups<Falso>({
      intervaloMin: () => intervalo,
      iniciar: async () => {
        const id = ++n;
        vivos.add(id);
        return {
          parar: () =>
            new Promise<void>((ok) => {
              // O backup em curso demora para terminar; só então o relógio morre.
              soltar.push(() => (vivos.delete(id), ok()));
            }),
        };
      },
    });
    const s = new Falso();
    agenda.observar(s);
    s.mudar("pronto");
    await vazio();
    intervalo = 20;
    agenda.reagendar();
    intervalo = 30;
    agenda.reagendar();
    await vazio();
    while (soltar.length > 0) {
      soltar.shift()?.();
      await vazio();
    }
    await vazio();
    while (soltar.length > 0) {
      soltar.shift()?.();
      await vazio();
    }
    expect(vivos.size).toBe(1);
    expect(agenda.ativa()).toBe(true);
  });

  it("falha ao preparar vira aviso, não derruba o app", async () => {
    const aviso = vi.fn();
    const agenda = criarAgendaBackups<Falso>({
      intervaloMin: () => 10,
      iniciar: async () => {
        throw new Error("sem pasta");
      },
      aoAvisar: aviso,
    });
    const s = new Falso();
    agenda.observar(s);
    s.mudar("pronto");
    await vazio();
    expect(aviso).toHaveBeenCalledWith(expect.stringContaining("sem pasta"));
  });
});

describe("histórico longo no backup agendado (drive-1.1a)", () => {
  it("copia o backup bom; pasta que some só vira aviso e o backup local fica intacto", async () => {
    const { mkdirSync, mkdtempSync, writeFileSync, readdirSync, rmSync } = await import("node:fs");
    const { tmpdir } = await import("node:os");
    const { join } = await import("node:path");
    const { createHash } = await import("node:crypto");
    const { copiarAoConcluir } = await import("./agenda-backups.js");
    const { criarAvisoHistorico } = await import("./aviso-historico.js");
    const { PASTA_NAO_ENCONTRADA } = await import("@sabrehosting/nucleo/backup/destinos/pasta");
    const local = mkdtempSync(join(tmpdir(), "sabre-ag-local-"));
    const drive = mkdtempSync(join(tmpdir(), "sabre-ag-drive-"));
    const nome = "2026-10-31T10-00-00-000Z-v1.tar.gz";
    const caminho = join(local, nome);
    writeFileSync(caminho, "pacote de teste");
    const feito = { caminho, sha256: createHash("sha256").update("pacote de teste").digest("hex") };
    const avisos: string[] = [];
    let pasta: string | undefined = drive;
    const visivel = criarAvisoHistorico();
    const o = {
      avisoHistorico: visivel,
      pastaBackups: local,
      historicoLongo: () => pasta,
      aoAvisar: (t: string) => void avisos.push(t),
    };
    await copiarAoConcluir(o, feito);
    expect(readdirSync(drive)).toEqual([nome]);
    expect(avisos).toEqual([]);
    expect(visivel.ler()).toBeUndefined();
    rmSync(drive, { recursive: true }); // a pasta some entre um backup e o outro
    await copiarAoConcluir(o, feito); // não lança
    expect(avisos).toHaveLength(1);
    expect(avisos[0]).toBe(PASTA_NAO_ENCONTRADA);
    expect(visivel.ler()).toBe(PASTA_NAO_ENCONTRADA); // a tela de Backups lê daqui (ajuste 4)
    expect(readdirSync(local)).toEqual([nome]);
    // Destino que CONTÉM a pasta do mundo é recusado pelo gancho (S-07) e vira aviso, sem copiar nada.
    const raiz = mkdtempSync(join(tmpdir(), "sabre-ag-raiz-"));
    const mundo = join(raiz, "mundo");
    mkdirSync(mundo);
    pasta = raiz;
    avisos.length = 0;
    await copiarAoConcluir({ ...o, pastaDoMundo: mundo }, feito);
    expect(avisos[0]).toMatch(/nem ficar dentro/i);
    expect(readdirSync(raiz)).toEqual(["mundo"]);
    rmSync(raiz, { recursive: true });
    pasta = undefined; // desligado: nada acontece e o aviso antigo some
    await copiarAoConcluir(o, feito);
    expect(avisos).toHaveLength(1);
    expect(visivel.ler()).toBeUndefined();
    rmSync(local, { recursive: true });
  });
});
