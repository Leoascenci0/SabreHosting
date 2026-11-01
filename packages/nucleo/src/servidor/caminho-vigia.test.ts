import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { caminhoDoVigia } from "./processo.js";

describe("caminhoDoVigia (appmel-1.22)", () => {
  it("dentro do app.asar vira app.asar.unpacked (Windows e Linux)", () => {
    expect(caminhoDoVigia("C:\\App\\resources\\app.asar\\node_modules\\x\\vigia.js")).toBe(
      "C:\\App\\resources\\app.asar.unpacked\\node_modules\\x\\vigia.js",
    );
    expect(caminhoDoVigia("/o/resources/app.asar/n/vigia.js")).toBe(
      "/o/resources/app.asar.unpacked/n/vigia.js",
    );
  });
  it("fora do app.asar não muda (inclui já-unpacked e nomes parecidos)", () => {
    for (const c of [
      "/dev/dist/servidor/vigia.js",
      "/o/resources/app.asar.unpacked/n/vigia.js",
      "/o/meu-app.asar/n/vigia.js",
      "/o/app.asarx/n/vigia.js",
    ]) {
      expect(caminhoDoVigia(c)).toBe(c);
    }
  });
  it("electron-builder.json desempacota vigia.js e o que ele importa (comandos.js)", () => {
    const json = JSON.parse(
      readFileSync(
        fileURLToPath(new URL("../../../../apps/desktop/electron-builder.json", import.meta.url)),
        "utf8",
      ),
    ) as { asarUnpack?: string[] };
    const lista = (json.asarUnpack ?? []).join(" ");
    expect(lista).toContain("vigia");
    expect(lista).toContain("comandos");
    expect(json.asarUnpack?.every((p) => p.includes("nucleo/dist/servidor/"))).toBe(true);
  });
});
