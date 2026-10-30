import { describe, expect, it } from "vitest";
import { nomeDoPacote } from "./exemplo.js";

describe("desktop", () => {
  it("responde o nome do pacote", () => {
    expect(nomeDoPacote()).toBe("desktop");
  });
});
