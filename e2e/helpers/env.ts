import path from "node:path";
import { fileURLToPath } from "node:url";
import { FAKE_CONNEXA_EMAIL, FAKE_CONNEXA_PASSWORD, assertSafeServerEnv } from "./safety-guard";

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
/**
 * The two-host run (npm run test:e2e:hosts, playwright.hosts.config.ts): the same machinery on its own port, with the app
 * also told to serve the customer portal from its own host name. Set by helpers/two-hosts-flag.ts, and handed on to the
 * server process by buildServerEnv. The main suite never sets it and stays single-host on 5055.
 */
export const TWO_HOSTS = process.env.E2E_TWO_HOSTS === "1";
export const E2E_PORT = TWO_HOSTS ? 5057 : 5055;
export const BASE_URL = `http://localhost:${E2E_PORT}`;
/** Chromium resolves any *.localhost name to this machine, so no DNS or hosts-file entry is needed. */
export const PORTAL_HOSTNAME = "portal.localhost";
export const PORTAL_ORIGIN = `http://${PORTAL_HOSTNAME}:${E2E_PORT}`;
/** Where the loopback fake of the SMS and WhatsApp providers listens (helpers/fake-providers.ts). */
export const FAKE_PROVIDERS_PORT = 5056;
export const FAKE_PROVIDERS_URL = `http://127.0.0.1:${FAKE_PROVIDERS_PORT}`;

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
    // The SMS provider is the loopback fake, with a fake login (the only one the safety guard accepts). The fake
    // answers 401 until a spec arms it, so nothing is ever delivered unless a spec asks for it.
    CONNEXA_BASE_URL: `${FAKE_PROVIDERS_URL}/connexa`,
    CONNEXA_EMAIL: FAKE_CONNEXA_EMAIL,
    CONNEXA_PASSWORD: FAKE_CONNEXA_PASSWORD,
    // Links in automatic messages need a site address (a message with no address in front of its link is not sent).
    PUBLIC_BASE_URL: BASE_URL,
    // Emails are only printed to the server log. RESEND_API_KEY is deliberately never set.
    EMAIL_PROVIDER: "console",
    E2E_OUTBOUND_LOG: OUTBOUND_LOG,
    E2E_OUTBOUND_CANARY: CANARY_FILE,
    // The two-host run only: the portal and public quote page live on their own host name (same server, same port).
    ...(TWO_HOSTS ? { PORTAL_BASE_URL: PORTAL_ORIGIN, E2E_TWO_HOSTS: "1" } : {}),
  };
  assertSafeServerEnv(env);
  return env;
}
