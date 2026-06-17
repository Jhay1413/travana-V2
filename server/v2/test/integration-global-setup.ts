import { execSync } from "node:child_process";
import { Client } from "pg";

const TEST_DATABASE_URL =
  process.env.TEST_DATABASE_URL || "postgres://postgres:postgres@localhost:55432/travana_test";

// Runs once before the integration suite. Verifies the disposable Postgres is
// reachable, then pushes shared/schema.ts into it via drizzle-kit.
export async function setup() {
  const client = new Client({ connectionString: TEST_DATABASE_URL, connectionTimeoutMillis: 4000 });
  try {
    await client.connect();
    await client.end();
  } catch (err) {
    throw new Error(
      `Cannot reach the test Postgres at ${TEST_DATABASE_URL}.\n` +
        `Start it first:  npm run db:test:up\n` +
        `Underlying error: ${(err as Error).message}`,
    );
  }

  // `push` syncs the live schema straight into the empty DB — no migration files
  // needed. --force skips the interactive data-loss prompts (the DB is empty).
  execSync("npx drizzle-kit push --force", {
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
