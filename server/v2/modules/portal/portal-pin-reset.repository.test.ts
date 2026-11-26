import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const executed = vi.hoisted(() => ({ statements: [] as string[], params: [] as unknown[][], counts: { email: 0, org: 0 } }));

vi.mock("../../config/database", () => {
  const { PgDialect: Dialect } = require("drizzle-orm/pg-core") as typeof import("drizzle-orm/pg-core");
  const dialect = new Dialect();
  const tx = {
    execute: async (query: SQL) => {
      const { sql: text, params } = dialect.sqlToQuery(query);
      executed.statements.push(text);
      executed.params.push(params);
      if (text.includes("count(*)") && text.includes("lower(c.email)")) return { rows: [{ n: executed.counts.email }] };
      if (text.includes("count(*)")) return { rows: [{ n: executed.counts.org }] };
      return { rows: [] };
    },
  };
  return { db: { transaction: async (cb: (t: typeof tx) => Promise<unknown>) => cb(tx) } };
});

import { portalPinResetRepository } from "./portal-pin-reset.repository";
import { buildLoginTokenInsert } from "./portal-login-token.repository";

const dialect = new PgDialect();
const input = { clientId: "c1", orgId: "o1", email: "Sam@Example.com", since: new Date("2030-01-01T00:00:00Z"), maxPerEmail: 3, maxPerOrg: 20, ttlMs: 3_600_000 };

beforeEach(() => {
  executed.statements.length = 0;
  executed.params.length = 0;
  executed.counts.email = 0;
  executed.counts.org = 0;
});

describe("reserveLink", () => {
  it("takes the agency's advisory lock first, counts, then inserts the pin_reset token, all in one transaction", async () => {
    const r = await portalPinResetRepository.reserveLink(input);
    expect(r.reserved).toBe(true);
    expect(executed.statements[0]).toContain("pg_advisory_xact_lock");
    expect(executed.params[0]).toEqual(["portal_pin_reset:o1"]);
    expect(executed.statements[1]).toContain("count(*)");
    expect(executed.statements[2]).toContain("count(*)");
    expect(executed.statements[3]).toContain("insert into portal_login_tokens");
    expect(executed.statements[3]).toContain("source");
    expect(executed.params[3]).toContain("pin_reset");
    expect(executed.statements).toHaveLength(4);
  });

  it("counts the email within the agency (never across agencies), lower-cased", async () => {
    await portalPinResetRepository.reserveLink(input);
    expect(executed.statements[1]).toContain("c.org_id =");
    expect(executed.params[1]).toContain("o1");
    expect(executed.params[1]).toContain("sam@example.com");
  });

  it("at the per-email cap: no insert", async () => {
    executed.counts.email = 3;
    expect(await portalPinResetRepository.reserveLink(input)).toEqual({ reserved: false, reason: "email_cap" });
    expect(executed.statements.some((s) => s.includes("insert into"))).toBe(false);
  });

  it("at the per-agency cap: no insert", async () => {
    executed.counts.org = 20;
    expect(await portalPinResetRepository.reserveLink(input)).toEqual({ reserved: false, reason: "org_cap" });
    expect(executed.statements.some((s) => s.includes("insert into"))).toBe(false);
  });

  it("one under each cap still reserves", async () => {
    executed.counts.email = 2;
    executed.counts.org = 19;
    expect((await portalPinResetRepository.reserveLink(input)).reserved).toBe(true);
  });
});

describe("buildLoginTokenInsert", () => {
  const expiresAt = new Date("2030-01-01T01:00:00Z");

  it("the staff-sent path never mentions the source column (works before it exists)", () => {
    const q = dialect.sqlToQuery(buildLoginTokenInsert("CODE", "c1", expiresAt));
    expect(q.sql).not.toContain("source");
    expect(q.sql).toContain("(code, client_id, expires_at)");
  });

  it("the pin-reset path names source", () => {
    const q = dialect.sqlToQuery(buildLoginTokenInsert("CODE", "c1", expiresAt, "pin_reset"));
    expect(q.sql).toContain("(code, client_id, expires_at, source)");
    expect(q.params).toContain("pin_reset");
  });
});
