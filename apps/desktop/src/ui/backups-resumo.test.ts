import { describe, expect, it } from "vitest";
import { resumoDeBackups } from "./backups-resumo.js";

const AGORA = Date.parse("2026-11-02T15:00:00");
const h = (horas: number): string => new Date(AGORA - horas * 3_600_000).toISOString();
const MB = 1024 * 1024;

describe("resumoDeBackups", () => {
  it("conta, acha o mais recente (em qualquer ordem) e soma o tamanho", () => {
    const r = resumoDeBackups(
      [
        { criadoEm: h(5), tamanho: 2 * MB },
        { criadoEm: h(2), tamanho: 3 * MB },
        { criadoEm: h(30), tamanho: 1 * MB },
      ],
      AGORA,
      10,
    );
    expect(r.quantos).toBe("3");
    expect(r.ultimo).toBe("há 2 horas");
    expect(r.espaco).toBe("6 MB");
    expect(r.proximo).toBe("a cada 10 min");
    expect(r.proximoRazao).toBe("Só com o servidor pronto.");
  });

  it("sem backups ou sem intervalo mostra '—' com a razão", () => {
    const r = resumoDeBackups([], AGORA, undefined);
    expect(r.quantos).toBe("0");
    expect(r.ultimo).toBe("—");
    expect(r.ultimoRazao).toBe("Ainda não há backups neste PC.");
    expect(r.espaco).toBe("—");
    expect(r.proximo).toBe("—");
    expect(r.proximoRazao).toMatch(/Configurações › Backups/);
  });

  it("data inválida não vira número inventado", () => {
    const r = resumoDeBackups([{ criadoEm: "lixo", tamanho: 512 }], AGORA, 15);
    expect(r.ultimo).toBe("—");
    expect(r.ultimoRazao).toMatch(/data/);
    expect(r.espaco).toBe("1 KB");
  });
});
