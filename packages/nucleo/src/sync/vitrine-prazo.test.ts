import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("../backup/pacote.js", () => ({
  abrirPacote: () => new Promise(() => {}), // publicação que nunca termina
}));

import { criarVitrine } from "./vitrine.js";

describe("vitrine.fechar com publicação longa (syncmel-1.12 f)", () => {
  afterEach(() => vi.useRealTimers());

  it("não espera para sempre: passado o prazo curto, fecha (a pasta v-* sobra para a limpeza do arranque)", async () => {
    vi.useFakeTimers();
    const base = mkdtempSync(join(tmpdir(), "sabre-vit-prazo-"));
    try {
      const vitrine = criarVitrine(join(base, "vitrine"));
      void vitrine.publicar(join(base, "p.zip"), "0".repeat(64));
      await vi.advanceTimersByTimeAsync(0);
      let fechou = false;
      const fechando = vitrine.fechar().then(() => (fechou = true));
      await vi.advanceTimersByTimeAsync(2_000);
      expect(fechou).toBe(false); // ainda dentro do prazo
      await vi.advanceTimersByTimeAsync(1_500);
      await fechando;
      expect(fechou).toBe(true);
      expect(await vitrine.publicar("x", "y")).toBe(false); // fechada não publica mais
    } finally {
      rmSync(base, { recursive: true, force: true });
    }
  });
});
