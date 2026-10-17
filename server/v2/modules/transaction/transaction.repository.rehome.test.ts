import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";

const updates: Array<{ table: unknown; set: Record<string, unknown>; where: unknown }> = [];

vi.mock("../../config/database", () => {
  const tx = {
    update: (table: unknown) => ({
      set: (set: Record<string, unknown>) => ({
        where: (where: unknown) => {
          updates.push({ table, set, where });
          return { returning: async () => [{ id: "t1" }] };
        },
      }),
    }),
  };
  return { db: { transaction: async (cb: (t: typeof tx) => unknown) => cb(tx) } };
});

import { transactionRepository } from "./transaction.repository";
import { transaction, tasks, tickets } from "@shared/schema";
import type { Scope } from "../../utils/scope";

const ADMIN: Scope = {
  orgId: "org1", branchId: null, orgRole: "org_admin", orgRoles: ["org_admin"],
  userId: "a", branchType: null, ownsHomeworkerBranch: false,
};
const dialect = new PgDialect();

beforeEach(() => {
  updates.length = 0;
});

describe("transactionRepository.updateAndRehome", () => {
  it("updates the deal, its tasks and its tickets with the new branch in one transaction", async () => {
    const result = await transactionRepository.updateAndRehome("t1", { user_id: "hw" }, ADMIN, "hw1");
    expect(result).toEqual({ id: "t1" });
    expect(updates.map((u) => u.table)).toEqual([transaction, tasks, tickets]);
    expect(updates[0].set).toMatchObject({ user_id: "hw", branch_id: "hw1" });
    expect(updates[1].set).toEqual({ branchId: "hw1" });
    expect(updates[2].set).toEqual({ branchId: "hw1" });
    const taskWhere = dialect.sqlToQuery(updates[1].where as SQL);
    expect(taskWhere.sql).toContain('"tasks"."entity_type"');
    expect(taskWhere.sql).toContain("SELECT");
  });
});
