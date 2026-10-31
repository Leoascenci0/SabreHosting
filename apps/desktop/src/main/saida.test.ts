import { describe, expect, it } from "vitest";
import { precisaEncerrarAntesDeSair } from "./saida.js";

const base = {
  podeSair: false,
  encerrando: false,
  servidorMinecraftAtivo: false,
  servindoArquivos: false,
};

describe("precisaEncerrarAntesDeSair (syncmel-1.11b)", () => {
  it("servidor de arquivos de pé conta mesmo sem servidor Minecraft ativo", () => {
    expect(precisaEncerrarAntesDeSair({ ...base, servindoArquivos: true })).toBe(true);
  });
  it("servidor Minecraft ativo ou saída em andamento contam", () => {
    expect(precisaEncerrarAntesDeSair({ ...base, servidorMinecraftAtivo: true })).toBe(true);
    expect(precisaEncerrarAntesDeSair({ ...base, encerrando: true })).toBe(true);
  });
  it("nada a encerrar, ou já liberado para sair: deixa fechar", () => {
    expect(precisaEncerrarAntesDeSair(base)).toBe(false);
    expect(precisaEncerrarAntesDeSair({ ...base, podeSair: true, servindoArquivos: true })).toBe(
      false,
    );
  });
});
