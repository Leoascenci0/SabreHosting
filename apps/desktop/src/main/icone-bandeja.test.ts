import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const pasta = new URL("../../recursos/icone/", import.meta.url);
const ASSINATURA_PNG = "89504e470d0a1a0a";

describe("ícone da bandeja", () => {
  it.each([16, 24, 32, 48])("bandeja-%i.png existe e tem %i x %i px", (lado) => {
    const png = readFileSync(new URL(`bandeja-${lado}.png`, pasta));
    expect(png.subarray(0, 8).toString("hex")).toBe(ASSINATURA_PNG);
    expect(png.readUInt32BE(16)).toBe(lado);
    expect(png.readUInt32BE(20)).toBe(lado);
  });

  it("principal.ts carrega todos os tamanhos da bandeja", () => {
    const fonte = readFileSync(new URL("../main/principal.ts", import.meta.url), "utf8");
    expect(fonte).toContain("bandeja-${lado}.png");
    for (const par of ["1, 16", "1.5, 24", "2, 32", "3, 48"]) expect(fonte).toContain(`[${par}]`);
  });
});
