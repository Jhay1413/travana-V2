import { describe, it, expect, vi, beforeEach } from "vitest";
import type { SQL } from "drizzle-orm";

const state = vi.hoisted(() => ({ statements: [] as string[], failWithMissingColumn: false }));

vi.mock("../../config/database", () => {
  const { PgDialect: Dialect } = require("drizzle-orm/pg-core") as typeof import("drizzle-orm/pg-core");
  const dialect = new Dialect();
  return {
    db: {
      execute: async (query: SQL) => {
        const { sql: text } = dialect.sqlToQuery(query);
        state.statements.push(text);
        if (state.failWithMissingColumn && text.includes("source")) throw Object.assign(new Error('column "source" does not exist'), { code: "42703" });
        if (text.includes("count(*)")) return { rows: [{ n: 7 }] };
        return { rows: [] };
      },
    },
  };
});

import { portalLoginTokenRepository } from "./portal-login-token.repository";
import { MAGIC_LINK_TTL_MS, STAFF_LINK_TTL_HOURS } from "./portal-auth";

beforeEach(() => {
  state.statements.length = 0;
  state.failWithMissingColumn = false;
});

describe("staff-sent sign-in link lifetime", () => {
  it("is 48 hours, one named constant, and the text quotes the same number", () => {
    expect(STAFF_LINK_TTL_HOURS).toBe(48);
    expect(MAGIC_LINK_TTL_MS).toBe(48 * 60 * 60 * 1000);
  });
});

describe("portalLoginTokenRepository.create", () => {
  it("writes the source column when one is given", async () => {
    await portalLoginTokenRepository.create("c1", 1000, "staff");
    expect(state.statements).toHaveLength(1);
    expect(state.statements[0]).toContain("source");
  });
  it("still mints the code, without a source, when the source column is not in the database yet", async () => {
    state.failWithMissingColumn = true;
    const code = await portalLoginTokenRepository.create("c1", 1000, "staff");
    expect(code).toHaveLength(12);
    expect(state.statements).toHaveLength(2);
    expect(state.statements[1]).not.toContain("source");
  });
  it("leaves source out entirely when none is given (the old insert)", async () => {
    await portalLoginTokenRepository.create("c1", 1000);
    expect(state.statements[0]).not.toContain("source");
  });
  it("any other database error still fails", async () => {
    const { db } = await import("../../config/database");
    const spy = vi.spyOn(db, "execute").mockRejectedValueOnce(new Error("connection lost"));
    await expect(portalLoginTokenRepository.create("c1", 1000, "staff")).rejects.toThrow("connection lost");
    spy.mockRestore();
  });
});

describe("staff links: retiring the old ones and counting", () => {
  it("a new staff link retires only this client's unused staff-labelled codes", async () => {
    await portalLoginTokenRepository.retireStaffLinks("c1");
    expect(state.statements).toHaveLength(1);
    expect(state.statements[0]).toMatch(/update portal_login_tokens set used = true/);
    expect(state.statements[0]).toContain("client_id = $1");
    expect(state.statements[0]).toContain("source = 'staff'");
    expect(state.statements[0]).toContain("used = false");
  });
  it("is skipped quietly before the source column exists", async () => {
    state.failWithMissingColumn = true;
    await expect(portalLoginTokenRepository.retireStaffLinks("c1")).resolves.toBeUndefined();
  });
  it("any other database error still fails", async () => {
    const { db } = await import("../../config/database");
    const spy = vi.spyOn(db, "execute").mockRejectedValueOnce(new Error("connection lost"));
    await expect(portalLoginTokenRepository.retireStaffLinks("c1")).rejects.toThrow("connection lost");
    spy.mockRestore();
  });
  it("counts the staff-labelled codes since a moment, and throws when the column does not exist (so the caller can use the log)", async () => {
    expect(await portalLoginTokenRepository.countStaffLinksSince("c1", new Date())).toBe(7);
    expect(state.statements[0]).toContain("source = 'staff'");
    state.failWithMissingColumn = true;
    await expect(portalLoginTokenRepository.countStaffLinksSince("c1", new Date())).rejects.toMatchObject({ code: "42703" });
  });
});
