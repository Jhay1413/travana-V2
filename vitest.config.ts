import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    // Client tests cover pure logic only (parsers/mappers), so the node
    // environment above is enough — no jsdom needed.
    include: ["server/**/*.test.ts", "shared/**/*.test.ts", "client/**/*.test.ts"],
    // Integration tests need a live Postgres — run them via `npm run test:integration`.
    exclude: ["**/node_modules/**", "**/*.integration.test.ts"],
  },
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
      "@": fileURLToPath(new URL("./client/src", import.meta.url)),
    },
  },
});
