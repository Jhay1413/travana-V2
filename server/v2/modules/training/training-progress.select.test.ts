import { describe, it, expect, vi } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const selects: Array<Record<string, SQL>> = [];

vi.mock("../../config/database", () => {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  for (const k of ["from", "innerJoin", "leftJoin", "where", "groupBy", "orderBy"]) chain[k] = self;
  chain.then = (resolve: (v: unknown) => unknown) => Promise.resolve([]).then(resolve);
  return { db: { select: (fields: Record<string, SQL>) => { selects.push(fields); return chain; } } };
});

import { trainingProgressRepository } from "./training-progress.repository";

describe("listEnrollmentDetailsByUser lesson counts", () => {
  it("count required lessons only, like listEnrollmentsByUser", async () => {
    await trainingProgressRepository.listEnrollmentDetailsByUser("u1", "o1");
    const dialect = new PgDialect();
    const total = dialect.sqlToQuery(selects[0].lessonsTotal).sql;
    const done = dialect.sqlToQuery(selects[0].lessonsCompleted).sql;
    expect(total).toContain('filter (where "training_lesson"."is_required")');
    expect(done).toContain('"training_lesson"."is_required" and "training_lesson_progress"."completed"');
  });
});
