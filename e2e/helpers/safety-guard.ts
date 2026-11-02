/**
 * Hard stops that keep the E2E suite away from anything real. Pure functions with no
 * imports, so they can be unit-tested by vitest and reused by the launcher and the
 * global setup. Every check throws; nothing here returns "maybe ok".
 */

/** The only database the suite may touch: docker-compose.test.yml (host 55432 -> container 5432). */
export const ALLOWED_DB_HOSTS = ["localhost", "127.0.0.1"] as const;
export const ALLOWED_DB_PORT = "55432";

/** Credentials that must never reach the E2E server (no real SendSeven, OpenAI, email, S3 ...). */
export const FORBIDDEN_ENV_NAMES = [
  "CONNEXA_EMAIL",
  "CONNEXA_PASSWORD",
  "CONVERSATIONS_API_TOKEN",
  "SENDSEVEN_PLATFORM_TOKEN",
  "ONLYSOCIAL_API_KEY",
  "OPENAI_API_KEY",
  "RESEND_API_KEY",
  "AWS_ACCESS_KEY_ID",
  "FACEBOOK_APP_SECRET",
  "FAL_KEY",
  // Not a credential, but it switches on real client texts (departure reminder sweep).
  // Listed so the guard refuses to start the server if it is present at all, even empty.
  "SMS_DEPARTURE_SWEEP_ENABLED",
] as const;

/** The only database name the suite may truncate. */
export const ALLOWED_DB_NAME = "travana_test";

/** Throws unless the name returned by `select current_database()` is the disposable test database. */
export function assertTestDatabaseName(name: string | undefined | null): void {
  if (name !== ALLOWED_DB_NAME) {
    throw new SafetyGuardError(`connected database is "${name ?? "(unknown)"}", not "${ALLOWED_DB_NAME}"; refusing to truncate`);
  }
}

export class SafetyGuardError extends Error {
  constructor(message: string) {
    super(`[e2e safety guard] ${message}`);
    this.name = "SafetyGuardError";
  }
}

/** Throws unless `url` is a postgres URL on localhost / 127.0.0.1 port 55432. */
export function assertSafeDatabaseUrl(url: string | undefined, label = "database url"): void {
  if (!url) throw new SafetyGuardError(`${label} is not set`);
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new SafetyGuardError(`${label} is not a valid URL`);
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") {
    throw new SafetyGuardError(`${label} must be a postgres:// URL`);
  }
  if (!(ALLOWED_DB_HOSTS as readonly string[]).includes(parsed.hostname)) {
    throw new SafetyGuardError(`${label} host "${parsed.hostname}" is not localhost / 127.0.0.1`);
  }
  if (parsed.port !== ALLOWED_DB_PORT) {
    throw new SafetyGuardError(`${label} port "${parsed.port || "(default)"}" is not ${ALLOWED_DB_PORT}`);
  }
}

/** Throws if any forbidden credential name is present (even with an empty value). */
export function assertNoForbiddenEnv(env: Record<string, string | undefined>): void {
  const present = FORBIDDEN_ENV_NAMES.filter((name) => Object.keys(env).some((k) => k.toUpperCase() === name));
  if (present.length > 0) {
    throw new SafetyGuardError(`forbidden credential variable(s) set in the server env: ${present.join(", ")}`);
  }
}

/** Throws unless emails go to the console only. */
export function assertConsoleEmail(env: Record<string, string | undefined>): void {
  if (env.EMAIL_PROVIDER !== "console") throw new SafetyGuardError("EMAIL_PROVIDER must be exactly \"console\" in the server env");
}

/** The full check run by the launcher and the global setup. */
export function assertSafeServerEnv(env: Record<string, string | undefined>): void {
  assertSafeDatabaseUrl(env.DATABASE_URL, "DATABASE_URL");
  assertSafeDatabaseUrl(env.NEON_DATABASE_URL, "NEON_DATABASE_URL");
  assertNoForbiddenEnv(env);
  assertConsoleEmail(env);
}
