import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// Disposable Postgres from docker-compose.test.yml. Override with TEST_DATABASE_URL.
const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgres://postgres:postgres@localhost:55432/travana_test";

export default defineConfig({
  test: {
    environment: "node",
    globals: true,
    include: ["server/**/*.integration.test.ts"],
    // Pushes shared/schema.ts into the test DB once before any test runs.
    globalSetup: ["./server/v2/test/integration-global-setup.ts"],
    // config/database.ts reads DATABASE_URL at import — set it for the workers.
    env: { DATABASE_URL: TEST_DATABASE_URL },
    // One DB, shared across files: run serially so TRUNCATE in one file can't
    // race another file's rows.
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
      "@": fileURLToPath(new URL("./client/src", import.meta.url)),
    },
  },
});
