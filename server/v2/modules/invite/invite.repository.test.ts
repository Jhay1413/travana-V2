import { describe, it, expect, vi, beforeEach } from "vitest";
import { branches, branchMembers, user } from "@shared/schema";

// Rows each delete reports back via .returning(), keyed by table; tests override per case.
const deleteRows = new Map<unknown, unknown[]>();
// Email returned by the user update inside finaliseAcceptedInvite.
let updatedEmail = "ada@x.com";
const whereCalls: Array<{ table: unknown; cond: unknown }> = [];

// Records every tx write in order so the tests can assert on table order and values.
const ops: Array<{ op: "update" | "delete"; table: unknown; values?: unknown }> = [];

function makeTx() {
  return {
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: unknown) => {
        ops.push({ op: "update", table, values });
        return {
          where: vi.fn((cond: unknown) => {
            whereCalls.push({ table, cond });
            return Object.assign(Promise.resolve([{}]), { returning: vi.fn(() => Promise.resolve([{ email: updatedEmail }])) });
          }),
        };
      }),
    })),
    delete: vi.fn((table: unknown) => {
      ops.push({ op: "delete", table });
      return {
        where: vi.fn((cond: unknown) => {
          whereCalls.push({ table, cond });
          return Object.assign(Promise.resolve(), {
            returning: vi.fn(() => Promise.resolve(deleteRows.get(table) ?? [{ id: "x" }])),
          });
        }),
      };
    }),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ kind: "subquery" })) })) })),
  };
}

vi.mock("../../config/database", () => ({
  db: {
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<void>) => cb(makeTx())),
  },
}));

import { PgDialect } from "drizzle-orm/pg-core";
import { inviteRepository } from "./invite.repository";

const dialect = new PgDialect();

beforeEach(() => {
  vi.clearAllMocks();
  ops.length = 0;
  deleteRows.clear();
  whereCalls.length = 0;
  updatedEmail = "ada@x.com";
});

describe("inviteRepository.finaliseAcceptedInvite", () => {
  it("activates the membership then renames the owned homeworker branch to the full name", async () => {
    await inviteRepository.finaliseAcceptedInvite("u1", "o1", { name: "Ada Lovelace", firstName: "Ada" });

    const tables = ops.map((o) => o.table);
    expect(tables).toEqual([user, branchMembers, branches]);
    expect(ops[1].values).toEqual({ isActive: true });
    expect(ops[2].values).toEqual({ name: "Ada Lovelace" });
  });

  it("only renames a branch that still carries the invite-time placeholder (displayName is preserved)", async () => {
    updatedEmail = "Ada@X.com";
    await inviteRepository.finaliseAcceptedInvite("u1", "o1", { name: "Ada Lovelace" });

    const rename = whereCalls.find((c) => c.table === branches);
    expect(rename).toBeDefined();
    const text = dialect.sqlToQuery(rename!.cond as never);
    expect(text.sql).toContain("\"branches\".\"name\" = $");
    expect(text.params).toContain("ada");
  });

  it("keeps the existing branch name when no usable name is given", async () => {
    await inviteRepository.finaliseAcceptedInvite("u1", "o1", { name: "   " });

    expect(ops.map((o) => o.table)).toEqual([user, branchMembers]);
  });
});

describe("inviteRepository.deletePendingUserWithBranch", () => {
  it("deletes the user (memberships and roles cascade) first, then the empty branch", async () => {
    await inviteRepository.deletePendingUserWithBranch("u1", "o1", "hb1");

    expect(ops.map((o) => [o.op, o.table])).toEqual([
      ["delete", user],
      ["delete", branches],
    ]);
  });

  it("guards the branch delete with NOT EXISTS on branch_members", async () => {
    await inviteRepository.deletePendingUserWithBranch("u1", "o1", "hb1");

    const branchDelete = whereCalls.find((c) => c.table === branches);
    const text = dialect.sqlToQuery(branchDelete!.cond as never).sql;
    expect(text.toLowerCase()).toContain("not exists");
  });

  it("409s and writes nothing further when the user row was already gone (race: accepted/revoked)", async () => {
    deleteRows.set(user, []);

    await expect(inviteRepository.deletePendingUserWithBranch("u1", "o1", "hb1")).rejects.toMatchObject({ statusCode: 409 });
    expect(ops.some((o) => o.table === branches)).toBe(false);
  });

  it("409s (rolling back) when another member still references the branch", async () => {
    deleteRows.set(branches, []);

    await expect(inviteRepository.deletePendingUserWithBranch("u1", "o1", "hb1")).rejects.toMatchObject({ statusCode: 409 });
  });
});
