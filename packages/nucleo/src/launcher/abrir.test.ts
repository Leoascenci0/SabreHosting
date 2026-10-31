import { describe, expect, it, vi } from "vitest";
import { abrirJogo } from "./abrir.js";

const base = {
  exe: "C:\\Prism\\prismlauncher.exe",
  idInstancia: "SabreHosting - Amigos",
  endereco: "10.0.0.5:25565",
  pastaMarcador: "C:\\Pasta\\SabreHosting",
};
const comMarcador = () => Promise.resolve(true);

describe("abrirJogo", () => {
  it("chama o Prism com a instância do grupo e o endereço, em lista de argumentos", async () => {
    const exec = vi.fn().mockResolvedValue("");
    const r = await abrirJogo({ ...base, exec, temMarcador: comMarcador });
    expect(r).toEqual({ ok: true });
    expect(exec).toHaveBeenCalledWith(base.exe, [
      "--launch",
      "SabreHosting - Amigos",
      "--server",
      "10.0.0.5:25565",
    ]);
  });

  it.each(["10.0.0.5:25565 --demo", "a;b:1", "host", "h:99999", "-x:1", "a b:25565", ""])(
    "recusa endereço inválido %j sem chamar o Prism",
    async (endereco) => {
      const exec = vi.fn();
      const r = await abrirJogo({ ...base, endereco, exec, temMarcador: comMarcador });
      expect(r.ok).toBe(false);
      expect(exec).not.toHaveBeenCalled();
    },
  );

  it.each(["../outra", "a/b", "a\\b", "", "-l"])("recusa id de instância %j", async (id) => {
    const exec = vi.fn();
    const r = await abrirJogo({ ...base, idInstancia: id, exec, temMarcador: comMarcador });
    expect(r.ok).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  it("não abre se a pasta não tem o marcador do SabreHosting", async () => {
    const exec = vi.fn();
    const r = await abrirJogo({ ...base, exec, temMarcador: () => Promise.resolve(false) });
    expect(r.ok).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  it("falha do Prism vira mensagem em português", async () => {
    const exec = vi.fn().mockRejectedValue(new Error("ENOENT"));
    const r = await abrirJogo({ ...base, exec, temMarcador: comMarcador });
    expect(r).toMatchObject({ ok: false });
    expect(r.ok === false && r.mensagem).toMatch(/Prism/);
  });
});

describe("abrirJogo sem executável injetado", () => {
  it("programa inexistente vira mensagem, sem derrubar", async () => {
    const r = await abrirJogo({ ...base, exe: "/nao/existe/prism", temMarcador: comMarcador });
    expect(r.ok).toBe(false);
  });
});
