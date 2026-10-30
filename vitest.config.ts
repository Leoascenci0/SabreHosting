import { defineConfig } from "vitest/config";

export default defineConfig({
  test: { include: ["{apps,packages,services}/*/src/**/*.test.ts", "tests/**/*.test.ts"] },
});
