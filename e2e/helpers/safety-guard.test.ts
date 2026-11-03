import { describe, expect, it } from "vitest";
import { buildServerEnv, pickInherited, TEST_DATABASE_URL } from "./env";
import {
  FORBIDDEN_ENV_NAMES,
  SafetyGuardError,
  assertNoForbiddenEnv,
  assertSafeDatabaseUrl,
  assertSafeServerEnv,
  assertTestDatabaseName,
} from "./safety-guard";

describe("assertSafeDatabaseUrl", () => {
  it("accepts the docker-compose test database", () => {
    expect(() => assertSafeDatabaseUrl(TEST_DATABASE_URL)).not.toThrow();
  });

  it("accepts 127.0.0.1 on port 55432", () => {
    expect(() => assertSafeDatabaseUrl("postgres://u:p@127.0.0.1:55432/x")).not.toThrow();
  });

  it("rejects a missing url", () => {
    expect(() => assertSafeDatabaseUrl(undefined)).toThrow(SafetyGuardError);
  });

  it("rejects a url that does not parse", () => {
    expect(() => assertSafeDatabaseUrl("not a url")).toThrow(/not a valid URL/);
  });

  it("rejects a remote host", () => {
    expect(() => assertSafeDatabaseUrl("postgres://u:p@ep-cool-123.neon.tech:55432/x")).toThrow(/not localhost/);
  });

  it("rejects a host that merely starts with localhost", () => {
    expect(() => assertSafeDatabaseUrl("postgres://u:p@localhost.evil.com:55432/x")).toThrow(/not localhost/);
  });

  it("rejects localhost on another port", () => {
    expect(() => assertSafeDatabaseUrl("postgres://u:p@localhost:5432/x")).toThrow(/port "5432"/);
  });

  it("rejects localhost with no explicit port", () => {
    expect(() => assertSafeDatabaseUrl("postgres://u:p@localhost/x")).toThrow(/\(default\)/);
  });

  it("rejects a non-postgres protocol", () => {
    expect(() => assertSafeDatabaseUrl("http://localhost:55432/x")).toThrow(/postgres/);
  });
});

describe("assertTestDatabaseName", () => {
  it("accepts travana_test", () => {
    expect(() => assertTestDatabaseName("travana_test")).not.toThrow();
  });

  it.each(["postgres", "travana", "travana_test2", "", undefined, null])("rejects %s", (name) => {
    expect(() => assertTestDatabaseName(name)).toThrow(SafetyGuardError);
  });
});

describe("assertNoForbiddenEnv", () => {
  it("passes when none of the credentials are set", () => {
    expect(() => assertNoForbiddenEnv({ PATH: "/bin", NODE_ENV: "development" })).not.toThrow();
  });

  it.each(FORBIDDEN_ENV_NAMES)("rejects %s", (name) => {
    expect(() => assertNoForbiddenEnv({ [name]: "x" })).toThrow(name);
  });

  it("rejects a forbidden name even with an empty value", () => {
    expect(() => assertNoForbiddenEnv({ OPENAI_API_KEY: "" })).toThrow(/OPENAI_API_KEY/);
  });

  it("matches the name case-insensitively (Windows env)", () => {
    expect(() => assertNoForbiddenEnv({ resend_api_key: "x" })).toThrow(/RESEND_API_KEY/);
  });

  it("lists every offender", () => {
    expect(() => assertNoForbiddenEnv({ FAL_KEY: "1", CONNEXA_EMAIL: "2" })).toThrow(/CONNEXA_EMAIL, FAL_KEY/);
  });
});

describe("assertSafeServerEnv", () => {
  const good = { DATABASE_URL: TEST_DATABASE_URL, NEON_DATABASE_URL: TEST_DATABASE_URL, EMAIL_PROVIDER: "console" };

  it("passes for the test database and no credentials", () => {
    expect(() => assertSafeServerEnv(good)).not.toThrow();
  });

  it("rejects a production-looking DATABASE_URL", () => {
    expect(() => assertSafeServerEnv({ ...good, DATABASE_URL: "postgres://u:p@db.neon.tech/prod" })).toThrow(SafetyGuardError);
  });

  it("rejects a bad NEON_DATABASE_URL (the session store reads it first)", () => {
    expect(() => assertSafeServerEnv({ ...good, NEON_DATABASE_URL: "postgres://u:p@db.neon.tech/prod" })).toThrow(/NEON_DATABASE_URL/);
  });

  it("rejects a real email provider, or none being set", () => {
    expect(() => assertSafeServerEnv({ ...good, EMAIL_PROVIDER: "resend" })).toThrow(/EMAIL_PROVIDER/);
    expect(() => assertSafeServerEnv({ DATABASE_URL: TEST_DATABASE_URL, NEON_DATABASE_URL: TEST_DATABASE_URL })).toThrow(/EMAIL_PROVIDER/);
  });

  it("rejects when NEON_DATABASE_URL is missing", () => {
    expect(() => assertSafeServerEnv({ DATABASE_URL: TEST_DATABASE_URL, EMAIL_PROVIDER: "console" })).toThrow(/NEON_DATABASE_URL/);
  });

  it("rejects a forbidden credential even when the urls are fine", () => {
    expect(() => assertSafeServerEnv({ ...good, SENDSEVEN_PLATFORM_TOKEN: "t" })).toThrow(/SENDSEVEN_PLATFORM_TOKEN/);
  });
});

describe("buildServerEnv", () => {
  const parent = {
    PATH: "/bin",
    SystemRoot: "C:\\Windows",
    DATABASE_URL: "postgres://u:p@prod.example.com/db",
    NEON_DATABASE_URL: "postgres://u:p@prod.example.com/db",
    SESSION_SECRET: "real-secret",
    SOME_OTHER_TOKEN: "leak-me",
  };

  it("points the server at the test database whatever the parent env says", () => {
    const env = buildServerEnv(parent);
    expect(env.DATABASE_URL).toBe(TEST_DATABASE_URL);
    expect(env.NEON_DATABASE_URL).toBe(TEST_DATABASE_URL);
  });

  it("does not inherit anything outside the allow-list", () => {
    const env = buildServerEnv(parent);
    expect(env.SOME_OTHER_TOKEN).toBeUndefined();
    expect(env.SESSION_SECRET).not.toBe("real-secret");
  });

  it("keeps the allow-listed system variables, whatever their case", () => {
    const env = buildServerEnv(parent);
    expect(env.PATH).toBe("/bin");
    expect(env.SystemRoot).toBe("C:\\Windows");
  });

  it("drops forbidden credentials found in the parent env instead of passing them on", () => {
    const env = buildServerEnv({ ...parent, OPENAI_API_KEY: "sk-real", RESEND_API_KEY: "re_real" });
    expect(env.OPENAI_API_KEY).toBeUndefined();
    expect(env.RESEND_API_KEY).toBeUndefined();
  });

  it("runs in development so cookies are not Secure and Vite middleware serves the client", () => {
    expect(buildServerEnv(parent).NODE_ENV).toBe("development");
  });

  it("pickInherited ignores undefined values", () => {
    expect(pickInherited({ PATH: undefined })).toEqual({});
  });
});
