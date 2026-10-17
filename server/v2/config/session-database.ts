import { Pool } from "pg";

/**
 * The database that holds the express-session `sessions` table. It can differ
 * from the app pool (DATABASE_URL) when NEON_DATABASE_URL is set, so anything
 * that reads or deletes sessions must go through this pool, never `db`.
 */
export const SESSION_DB_URL = process.env.NEON_DATABASE_URL || process.env.DATABASE_URL;

export const sessionDb = new Pool({
  connectionString: SESSION_DB_URL,
  max: 10,
  idleTimeoutMillis: 60 * 1000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
});

sessionDb.on("error", (err) => {
  console.warn("[session-db] idle client error:", err.message);
});
