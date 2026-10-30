import { createHash } from "node:crypto";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hashDoArquivo } from "./hash.js";

describe("hashDoArquivo", () => {
  it("calcula SHA-256 por padrão e aceita outro algoritmo", async () => {
    const pasta = mkdtempSync(join(tmpdir(), "sabre-hash-"));
    try {
      const arquivo = join(pasta, "a.bin");
      writeFileSync(arquivo, "mundo");
      expect(await hashDoArquivo(arquivo)).toBe(createHash("sha256").update("mundo").digest("hex"));
      expect(await hashDoArquivo(arquivo, "sha1")).toBe(
        createHash("sha1").update("mundo").digest("hex"),
      );
    } finally {
      rmSync(pasta, { recursive: true, force: true });
    }
  });
});
