import { describe, expect, it } from "vitest";
import { nomeDoPacote } from "./exemplo.js";

describe("cartorio", () => {
  it("responde o nome do pacote", () => {
    expect(nomeDoPacote()).toBe("cartorio");
  });
});
