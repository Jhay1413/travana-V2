import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

// Single shared pool for the whole server (the legacy server/config/database.ts
// re-exports this one), so v1 and v2 code never open two competing pools.
//
// Why these numbers: the database is a remote Neon pooler endpoint whose DNS
// name round-robins across several load-balancer IPs. From some networks only
// a subset of those IPs is reachable, so a NEW connection either succeeds in
// ~1.5-3s or hangs until the OS gives up (~21s on Windows) and pg reports
// "Connection terminated due to connection timeout" / "timeout exceeded when
// trying to connect". A short idle timeout made every page load after a brief
// pause reopen a dozen connections at once, each with that gamble. So: keep
// connections alive for a long time so they are reused, cap the pool, fail a
// stalled connect at 10s (a connect that has not completed by then never
// will), and warm the pool at startup with retries (see warmPool) so traffic
// runs on connections that already landed on a reachable IP.
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 15,
  idleTimeoutMillis: 10 * 60 * 1000,
  connectionTimeoutMillis: 10000,
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// An idle client can be dropped by the server/network; without a handler pg
// re-throws this as an uncaught error and takes the process down.
pool.on("error", (err) => {
  console.warn("[db] idle client error:", err.message);
});

/**
 * Opens `target` connections one at a time, retrying stalled attempts, and
 * keeps them in the pool so traffic starts against warm connections that are
 * known to work. Sequential on purpose so a bad attempt only costs one
 * connect timeout. Never throws — the pool still works if warm-up gives up,
 * it just warms lazily under traffic.
 */
export async function warmPool(target = pool.options.max ?? 15, maxAttempts = 60): Promise<void> {
  const held: Array<{ release: () => void }> = [];
  const started = Date.now();
  let attempts = 0;
  let failures = 0;
  while (held.length < target && attempts < maxAttempts) {
    attempts++;
    try {
      const client = await pool.connect();
      await client.query("select 1");
      held.push(client);
    } catch (err) {
      failures++;
      if (failures === 1) console.warn("[db] warm-up connect failed, retrying:", (err as Error).message);
    }
  }
  for (const client of held) client.release();
  console.log(
    `[db] pool warmed with ${held.length}/${target} connections in ${Date.now() - started}ms` +
      (failures ? ` (${failures} stalled connects retried)` : ""),
  );
}

export const db = drizzle(pool);
export { pool };
