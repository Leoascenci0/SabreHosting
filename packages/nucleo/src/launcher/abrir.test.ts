import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { abrirJogo } from "./abrir.js";
import { idDaInstancia } from "./instancia.js";

const base = {
  exe: "C:\\Prism\\prismlauncher.exe",
  idInstancia: "SabreHosting - Amigos",
  endereco: "10.0.0.5:25565",
  pastaInstancias: "C:\\Prism\\instances",
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

describe("abrirJogo: pasta do marcador e id são da MESMA instância", () => {
  let raiz: string | undefined;
  afterEach(() => raiz && rmSync(raiz, { recursive: true, force: true }));

  function prismFalso(instanciasComMarcador: string[]): string {
    raiz = mkdtempSync(join(tmpdir(), "sabre-abrir-"));
    for (const id of instanciasComMarcador) {
      const pasta = join(raiz, id, "SabreHosting");
      mkdirSync(pasta, { recursive: true });
      writeFileSync(join(pasta, ".sabrehosting.json"), JSON.stringify({ app: "SabreHosting" }));
    }
    return raiz;
  }

  it("o marcador procurado é <pastaInstancias>/<id>/SabreHosting", async () => {
    const temMarcador = vi.fn().mockResolvedValue(true);
    await abrirJogo({ ...base, exec: vi.fn().mockResolvedValue(""), temMarcador });
    expect(temMarcador).toHaveBeenCalledWith(
      join(base.pastaInstancias, base.idInstancia, "SabreHosting"),
    );
  });

  it("abre quando o id é o da instância que tem o marcador", async () => {
    const id = idDaInstancia("Amigos");
    const exec = vi.fn().mockResolvedValue("");
    const r = await abrirJogo({
      ...base,
      pastaInstancias: prismFalso([id]),
      idInstancia: id,
      exec,
    });
    expect(r).toEqual({ ok: true });
    expect(exec).toHaveBeenCalledOnce();
  });

  it("recusa o id de OUTRA instância do amigo (marcador só na do grupo)", async () => {
    const exec = vi.fn();
    const pastaInstancias = prismFalso([idDaInstancia("Amigos")]);
    mkdirSync(join(pastaInstancias, "Minha instância"), { recursive: true });
    const r = await abrirJogo({ ...base, pastaInstancias, idInstancia: "Minha instância", exec });
    expect(r.ok).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });

  it("id com .. não sai da pasta de instâncias para achar um marcador", async () => {
    const exec = vi.fn();
    const pastaInstancias = prismFalso([idDaInstancia("Amigos")]);
    const r = await abrirJogo({
      ...base,
      pastaInstancias: join(pastaInstancias, idDaInstancia("Amigos")),
      idInstancia: "..",
      exec,
    });
    expect(r.ok).toBe(false);
    expect(exec).not.toHaveBeenCalled();
  });
});

describe("idDaInstancia", () => {
  it("é o nome 'SabreHosting — <grupo>' como nome de pasta do Windows", () => {
    expect(idDaInstancia("Amigos do Eliel")).toBe("SabreHosting — Amigos do Eliel");
    expect(idDaInstancia('Os:"Brabos"')).toBe("SabreHosting — OsBrabos");
  });
});
