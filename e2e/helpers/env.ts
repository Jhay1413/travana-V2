import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertSafeServerEnv } from "./safety-guard";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));
/**
 * Violation logs live OUTSIDE Playwright's outputDir (test-results/), which Playwright empties at the start of a run.
 * Never deleted automatically: a non-empty log from a crashed run stops the next run (see global-setup.ts).
 */
export const E2E_STATE_DIR = path.join(repoRoot, "e2e-results");
/** Every connection or browser start the server tries to make outside this machine is appended here (see block-outbound.ts). */
export const OUTBOUND_LOG = path.join(E2E_STATE_DIR, "outbound-blocked.log");
/** Every request the test browser tried to send outside the test server (browser-guard.ts), same line format. */
export const BROWSER_LOG = path.join(E2E_STATE_DIR, "browser-violations.log");
/** Written by the server's preload: proof that a refused canary connection really was refused. Not a violation. */
export const CANARY_FILE = path.join(E2E_STATE_DIR, "outbound-canary.json");

/** The disposable Postgres from docker-compose.test.yml. Fixed on purpose: the guard rejects anything else. */
export const TEST_DATABASE_URL = "postgres://postgres:postgres@localhost:55432/travana_test";
export const E2E_PORT = 5055;
export const BASE_URL = `http://localhost:${E2E_PORT}`;

/**
 * Only these variables are copied from the parent environment into the server
 * (compared case-insensitively; Windows spells it "Path"). Nothing else leaks in.
 */
const INHERITED_ALLOW_LIST = [
  "PATH",
  "PATHEXT",
  "SYSTEMROOT",
  "WINDIR",
  "COMSPEC",
  "TEMP",
  "TMP",
  "TMPDIR",
  "HOME",
  "USERPROFILE",
  "HOMEDRIVE",
  "HOMEPATH",
  "APPDATA",
  "LOCALAPPDATA",
  "PROGRAMFILES",
  "PROGRAMDATA",
  "NUMBER_OF_PROCESSORS",
  "PROCESSOR_ARCHITECTURE",
  "OS",
  "LANG",
  "TZ",
];

export function pickInherited(parent: Record<string, string | undefined>): Record<string, string> {
  const allowed = new Set(INHERITED_ALLOW_LIST);
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(parent)) {
    if (value !== undefined && allowed.has(key.toUpperCase())) out[key] = value;
  }
  return out;
}

/** Explicit environment for the app server (and drizzle-kit). Never starts from process.env wholesale. */
export function buildServerEnv(parent: Record<string, string | undefined> = process.env): Record<string, string> {
  const env: Record<string, string> = {
    ...pickInherited(parent),
    NODE_ENV: "development",
    DATABASE_URL: TEST_DATABASE_URL,
    NEON_DATABASE_URL: TEST_DATABASE_URL,
    SESSION_SECRET: "e2e-session-secret-not-a-real-secret",
    EMAIL_ENCRYPTION_KEY: "e2e-encryption-key-not-a-real-secret",
    PORT: String(E2E_PORT),
    // Emails are only printed to the server log. RESEND_API_KEY is deliberately never set.
    EMAIL_PROVIDER: "console",
    E2E_OUTBOUND_LOG: OUTBOUND_LOG,
    E2E_OUTBOUND_CANARY: CANARY_FILE,
  };
  assertSafeServerEnv(env);
  return env;
}
