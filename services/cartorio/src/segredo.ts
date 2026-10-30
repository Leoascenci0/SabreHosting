import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/** Token de PC ou código de convite: 32 bytes aleatórios. Só o dono vê; o cartório guarda o hash. */
export function gerarSegredo(): string {
  return randomBytes(32).toString("base64url");
}

/** SHA-256 basta: o segredo tem 256 bits de entropia, então não há o que adivinhar (dispensa scrypt). */
export function hashSegredo(segredo: string): string {
  return createHash("sha256").update(segredo).digest("hex");
}

/** Compara em tempo constante (pelo hash, que tem tamanho fixo). */
export function iguais(a: string, b: string): boolean {
  return timingSafeEqual(Buffer.from(hashSegredo(a), "hex"), Buffer.from(hashSegredo(b), "hex"));
}
