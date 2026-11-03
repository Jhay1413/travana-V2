/**
 * Runs once before the suite, in this order:
 *   1. safety guard (before anything touches a database)
 *   2. push shared/schema.ts into the disposable test database (drizzle-kit push --force)
 *   3. wipe tenant data and sessions, then seed the plans
 *   4. start the app server (e2e/helpers/start-server.ts) and wait until it answers
 *   5. warm Vite's dependency optimiser so no test sees a mid-run page reload
 *
 * The server is started here and not through Playwright's `webServer` option because
 * that option starts the server BEFORE global setup, i.e. before the schema exists.
 */
import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { createWriteStream, existsSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";
import { BASE_URL, BROWSER_LOG, CANARY_FILE, E2E_STATE_DIR, OUTBOUND_LOG, TEST_DATABASE_URL, buildServerEnv } from "./helpers/env";
import { BROWSER_ARGS, installBrowserGuard } from "./helpers/browser-guard";
import { formatRunViolations, readOutboundAttempts, readRunViolations } from "./helpers/outbound-report";
import { assertSafeDatabaseUrl, assertSafeServerEnv } from "./helpers/safety-guard";

const root = fileURLToPath(new URL("..", import.meta.url));
const require = createRequire(import.meta.url);
const SERVER_START_TIMEOUT_MS = 180_000;

/**
 * Stops the run before it starts if an earlier run left violations behind. Never deletes them: they are
 * the evidence of what that run tried to reach.
 */
function refuseIfLeftoverViolations(): void {
  const left = [OUTBOUND_LOG, BROWSER_LOG].filter((f) => existsSync(f) && readOutboundAttempts(f).length > 0);
  if (left.length === 0) return;
  throw new Error(
    `An earlier run left outbound violations behind:\n  ${left.join("\n  ")}\n` +
      "Read them (each line is one JSON object: host, port, stack) to see what was attempted. Once you have dealt with it, " +
      `delete the files (or the folder ${E2E_STATE_DIR}) and run again. They are not cleared automatically.`,
  );
}

function pushSchema(env: Record<string, string>): void {
  // drizzle-kit does not export its bin, so resolve it by path.
  const bin = path.join(root, "node_modules", "drizzle-kit", "bin.cjs");
  try {
    execFileSync(process.execPath, [bin, "push", "--force"], { cwd: root, env, stdio: "inherit" });
  } catch (err) {
    throw new Error(
      `Could not push the schema to ${TEST_DATABASE_URL}. Is the test database up?  npm run db:test:up\n${(err as Error).message}`,
    );
  }
}

async function waitForServer(child: ChildProcess, exited: () => boolean): Promise<void> {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (exited()) throw new Error("The E2E server exited before it was ready. See test-results/e2e-server.log");
    try {
      // Any HTTP answer will do; an anonymous caller gets 401.
      await fetch(`${BASE_URL}/api/auth/user`);
      return;
    } catch {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
  child.kill();
  throw new Error(`The E2E server did not answer on ${BASE_URL} within ${SERVER_START_TIMEOUT_MS / 1000}s`);
}

function killTree(child: ChildProcess): void {
  if (child.pid === undefined || child.exitCode !== null) return;
  if (process.platform === "win32") {
    try {
      execFileSync("taskkill", ["/pid", String(child.pid), "/T", "/F"], { stdio: "ignore" });
    } catch {
      // already gone
    }
  } else {
    try {
      process.kill(-child.pid, "SIGTERM"); // the whole process group (started detached)
    } catch {
      child.kill("SIGTERM");
    }
  }
}

/** Load each public page once so Vite optimises its dependencies now, not during a test. */
async function warmUpClient(): Promise<void> {
  const browser = await chromium.launch({ args: BROWSER_ARGS });
  try {
    const context = await browser.newContext({ baseURL: BASE_URL });
    // Same guard as the tests: no request leaves the machine, even while warming up.
    await installBrowserGuard(context);
    const page = await context.newPage();
    for (const url of ["/", "/signup", "/verify-email?email=warm@e2e.test", "/accept-invite?token=warm", "/pipeline"]) {
      await page.goto(url, { waitUntil: "load" });
      await page.locator("h1, h2").first().waitFor({ timeout: 120_000 });
    }
  } finally {
    await browser.close();
  }
}

export default async function globalSetup(): Promise<() => Promise<void>> {
  // 1. Guard first. Throws (and aborts the run) unless this is the local test database.
  assertSafeDatabaseUrl(TEST_DATABASE_URL, "TEST_DATABASE_URL");
  const env = buildServerEnv();
  assertSafeServerEnv(env);

  // 2. Schema. Same approach as server/v2/test/integration-global-setup.ts, with the explicit env.
  //    Imported only now so no connection opens before the guard has run.
  const seed = await import("./helpers/seed");
  await seed.ensureExtensions();
  pushSchema(env);

  // 3. Data.
  await seed.resetDatabase();
  seed.seedPlans();
  await seed.seedReferenceData();
  // Nothing in the seed may hold a SendSeven / WhatsApp / mailbox login.
  await seed.assertNoMessagingConfig();

  // 4. Server. Refuse to run against a server that is already there (a leftover from an earlier run would
  //    be tested instead of the one with the outbound block).
  const alreadyUp = await fetch(`${BASE_URL}/api/auth/user`).then(() => true, () => false);
  if (alreadyUp) throw new Error(`Something already answers on ${BASE_URL}. Stop the leftover E2E server first.`);
  mkdirSync(path.join(root, "test-results"), { recursive: true });
  mkdirSync(E2E_STATE_DIR, { recursive: true });
  refuseIfLeftoverViolations();
  rmSync(CANARY_FILE, { force: true }); // not evidence of anything: rewritten by the server on every start
  const log = createWriteStream(path.join(root, "test-results", "e2e-server.log"));
  const child = spawn(process.execPath, [require.resolve("tsx/cli"), "e2e/helpers/start-server.ts"], {
    cwd: root,
    env, // already the guarded, allow-listed environment
    stdio: ["ignore", "pipe", "pipe"],
    detached: process.platform !== "win32",
  });
  child.stdout?.pipe(log, { end: false });
  child.stderr?.pipe(log, { end: false });
  let exited = false;
  child.on("exit", () => {
    exited = true;
  });

  try {
    await waitForServer(child, () => exited);
    // 5. Warm-up.
    await warmUpClient();
  } catch (err) {
    killTree(child);
    throw err;
  }

  return async () => {
    killTree(child);
    await new Promise<void>((resolve) => log.end(resolve));
    const problems: string[] = [];
    // 1. The outbound check comes first, so nothing below can skip it.
    const serverLogText = readFileSync(path.join(root, "test-results", "e2e-server.log"), "utf8");
    const violations = formatRunViolations(readRunViolations(serverLogText));
    const bar = "!".repeat(70);
    if (violations) problems.push(`\n${bar}\nOUTBOUND VIOLATIONS DURING THE E2E RUN\n${violations}\n${bar}`);
    // 2. After the whole run, still no messaging settings anywhere in the database.
    try {
      await seed.assertNoMessagingConfig();
    } catch (err) {
      problems.push((err as Error).message);
    } finally {
      try {
        await seed.closeDb();
      } catch (err) {
        problems.push(`Closing the database pool failed: ${(err as Error).message}`);
      }
    }
    if (problems.length > 0) throw new Error(problems.join("\n"));
  };
}
