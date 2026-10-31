import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // O app importa o núcleo pelo nome do pacote (dist); nos testes vale o código-fonte, sem precisar de build.
    alias: [
      {
        find: /^@sabrehosting\/nucleo\/(.*)$/,
        replacement: fileURLToPath(new URL("./packages/nucleo/src/$1.ts", import.meta.url)),
      },
    ],
  },
  test: {
    include: [
      "{apps,packages,services}/*/src/**/*.test.ts",
      "packages/*/test/**/*.test.ts",
      "tests/**/*.test.ts",
    ],
  },
});
