import { describe, it, expect, beforeEach, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const captured: { values?: Record<string, unknown>; set?: Record<string, unknown>; fail?: unknown } = {};

vi.mock("../../config/database", () => {
  const chain = {
    insert: () => chain,
    values: (v: Record<string, unknown>) => { captured.values = v; return chain; },
    onConflictDoUpdate: (c: { set: Record<string, unknown> }) => { captured.set = c.set; return chain; },
    returning: async () => {
      if (captured.fail) throw captured.fail;
      return [{ completed: true }];
    },
  };
  return { db: chain };
});

import { departuresRepository } from "./departures.repository";

const stamp = { by: "u1", byName: "Ann", at: new Date("2026-10-20T10:00:00Z"), what: "x" };
const dialect = new PgDialect();

beforeEach(() => {
  captured.values = undefined;
  captured.set = undefined;
  captured.fail = undefined;
});

describe("upsertCheck", () => {
  it("completing is computed from the four columns in the same statement, and never inserted true", async () => {
    await departuresRepository.upsertCheck("o1", "bk1", { completed: true }, stamp);
    expect(captured.values?.completed).toBe(false);
    const text = dialect.sqlToQuery(captured.set?.completed as SQL).sql;
    expect(text).toContain('"check_in" AND');
    expect(text).toContain('"tickets_in_house" AND');
    expect(text).toContain('"passport_info" AND');
    expect(text).toContain('"tickets_pick_up"');
  });

  it("other patches are written as given", async () => {
    await departuresRepository.upsertCheck("o1", "bk1", { fullyPaid: true }, stamp);
    expect(captured.values).toMatchObject({ fullyPaid: true });
    expect(captured.set).toMatchObject({ fullyPaid: true });
    expect(captured.set).not.toHaveProperty("completed");
  });

  it("a missing table gives a clear error", async () => {
    captured.fail = { code: "42P01" };
    await expect(departuresRepository.upsertCheck("o1", "bk1", { checkIn: true }, stamp)).rejects.toMatchObject({
      message: "Departures table not migrated yet",
      statusCode: 500,
    });
  });
});
