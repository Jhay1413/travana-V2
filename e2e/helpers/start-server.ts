/**
 * Starts the app server for the E2E suite. Used as Playwright's webServer command.
 *
 * - Runs `tsx server/index.ts` WITHOUT --env-file, so the server process never loads .env.
 *   Caveat: the Vite middleware inside it still reads VITE_* values from .env and exposes
 *   them to the browser bundle; those are client-side config, not server secrets.
 * - Passes an explicit, allow-listed environment (see buildServerEnv), never process.env.
 * - Refuses to start unless the safety guard passes.
 */
import { spawn } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildServerEnv } from "./env";
import { assertSafeServerEnv } from "./safety-guard";

const root = fileURLToPath(new URL("../..", import.meta.url));
const require = createRequire(import.meta.url);

function main(): void {
  const env = buildServerEnv();
  assertSafeServerEnv(env);

  const tsxCli = require.resolve("tsx/cli");
  // The outbound block is preloaded so it is in place before any application code runs.
  const preload = pathToFileURL(fileURLToPath(new URL("./block-outbound-preload.ts", import.meta.url))).href;
  const child = spawn(process.execPath, [tsxCli, "--import", preload, "server/index.ts"], {
    cwd: root,
    env,
    stdio: "inherit",
  });

  const stop = () => {
    if (!child.killed) child.kill();
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  process.on("exit", stop);
  child.on("exit", (code) => process.exit(code ?? 0));
}

main();
