import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { branchMembers, clientTable, tasks, tickets, transaction, user } from "@shared/schema";

// A drizzle instance over a pool that never connects: enough to build (and render) the
// correlated sub-queries in organization-member-removal.sql.ts without touching a database.
vi.mock("../../config/database", async () => {
  const { drizzle } = await import("drizzle-orm/node-postgres");
  const { Pool } = await import("pg");
  const realLooking = drizzle(new Pool({ connectionString: "postgres://nobody:none@127.0.0.1:1/none" }));
  return {
    db: Object.assign(realLooking, {
      transaction: vi.fn(),
    }),
  };
});

import { db } from "../../config/database";
import { organizationMemberRemovalRepository } from "./organization-member-removal.repository";
import { activeClientCond, openDealCond, openTaskCond, openTicketCond } from "./organization-member-removal.sql";

const dialect = new PgDialect();
const render = (cond: Parameters<PgDialect["sqlToQuery"]>[0]) => dialect.sqlToQuery(cond);

describe("open-work predicates", () => {
  it("open deal: active, enquiry not Lost/deleted or quote not copy/deleted/lost, booked excluded", () => {
    const { sql, params } = render(openDealCond("org1", "u1"));
    expect(sql).toContain('"transaction"."org_id" = $1');
    expect(sql).toContain('"transaction"."user_id" = $2');
    expect(params.slice(0, 2)).toEqual(["org1", "u1"]);
    expect(sql).toContain("IS NOT FALSE");
    expect(sql).toContain("IS DISTINCT FROM 'LOST'");
    expect(sql).toContain("IS DISTINCT FROM 'lost'");
    expect(sql).toContain('"deleted_at" is null');
    expect(params).toContain("on_enquiry");
    expect(params).toContain("on_quote");
    expect(params).not.toContain("on_booking");
  });

  it("open task: not completed, own org or legacy null org", () => {
    const { sql, params } = render(openTaskCond("org1", "u1"));
    expect(sql).toContain("IS NOT TRUE");
    expect(sql).toContain('"tasks"."org_id" is null');
    expect(params).toEqual(["u1", "org1"]);
  });

  it("open ticket: assigned to the user, this org, Open or In Progress only", () => {
    const { params } = render(openTicketCond("org1", "u1"));
    expect(params).toEqual(["u1", "org1", "Open", "In Progress"]);
  });

  it("active client: created by the user, this org, status active", () => {
    const { params } = render(activeClientCond("org1", "u1"));
    expect(params).toEqual(["u1", "org1", "active"]);
  });
});

// ---------------------------------------------------------------------------
// reassignAndDeactivate against a recording transaction
// ---------------------------------------------------------------------------

interface UpdateCall { table: unknown; values: Record<string, unknown> }

function fakeTx(opts: { deals: Array<{ id: string }>; deactivated: number }) {
  const calls: UpdateCall[] = [];
  const tx = {
    update: vi.fn((table: unknown) => ({
      set: vi.fn((values: Record<string, unknown>) => {
        calls.push({ table, values });
        const rows =
          table === transaction ? opts.deals
          : table === user ? Array.from({ length: opts.deactivated }, () => ({ id: "u1" }))
          : table === tasks && "userId" in values ? [{ id: "t1" }, { id: "t2" }]
          : table === tickets && "assignedTo" in values ? [{ id: "k1" }]
          : table === clientTable ? [{ id: "c1" }, { id: "c2" }, { id: "c3" }]
          : [];
        return { where: vi.fn(() => Object.assign(Promise.resolve(undefined), { returning: vi.fn(async () => rows) })) };
      }),
    })),
  };
  return { tx, calls };
}

beforeEach(() => vi.clearAllMocks());

describe("organizationMemberRemovalRepository.reassignAndDeactivate", () => {
  const base = { orgId: "o1", userId: "u1", banReason: "Removed by Alex" };

  it("moves deals (into the new owner's branch), re-homes linked tasks/tickets, then tasks, tickets, clients, then deactivates", async () => {
    const { tx, calls } = fakeTx({ deals: [{ id: "d1" }, { id: "d2" }], deactivated: 1 });
    vi.mocked(db.transaction).mockImplementation((async (cb: (t: unknown) => unknown) => cb(tx)) as never);

    const moved = await organizationMemberRemovalRepository.reassignAndDeactivate({
      ...base, newOwnerId: "u9", newOwnerBranchId: "b9",
    });

    expect(moved).toEqual({ openDeals: 2, openTasks: 2, openTickets: 1, clients: 3 });
    expect(calls.map((c) => c.table)).toEqual([
      transaction, tasks, tickets, tasks, tickets, clientTable, user, branchMembers,
    ]);
    expect(calls[0].values).toEqual({ user_id: "u9", branch_id: "b9" });
    expect(calls[1].values).toEqual({ branchId: "b9" });
    expect(calls[2].values).toEqual({ branchId: "b9" });
    expect(calls[3].values).toEqual({ userId: "u9" });
    expect(calls[4].values).toMatchObject({ assignedTo: "u9" });
    expect(calls[5].values).toEqual({ createdBy: "u9" });
    expect(calls[6].values).toMatchObject({ banned: true, banReason: "Removed by Alex", resetToken: null, resetTokenExpiry: null });
    expect(calls[7].values).toEqual({ isActive: false });
  });

  it("only deactivates when there is nothing to hand over", async () => {
    const { tx, calls } = fakeTx({ deals: [], deactivated: 1 });
    vi.mocked(db.transaction).mockImplementation((async (cb: (t: unknown) => unknown) => cb(tx)) as never);

    const moved = await organizationMemberRemovalRepository.reassignAndDeactivate({
      ...base, newOwnerId: null, newOwnerBranchId: null,
    });

    expect(moved).toEqual({ openDeals: 0, openTasks: 0, openTickets: 0, clients: 0 });
    expect(calls.map((c) => c.table)).toEqual([user, branchMembers]);
  });

  it("throws 409 inside the transaction when the member was already removed (so everything rolls back)", async () => {
    const { tx, calls } = fakeTx({ deals: [{ id: "d1" }], deactivated: 0 });
    vi.mocked(db.transaction).mockImplementation((async (cb: (t: unknown) => unknown) => cb(tx)) as never);

    await expect(
      organizationMemberRemovalRepository.reassignAndDeactivate({ ...base, newOwnerId: "u9", newOwnerBranchId: "b9" }),
    ).rejects.toMatchObject({ statusCode: 409 });
    // Memberships are never touched once the deactivation guard fails.
    expect(calls.map((c) => c.table)).not.toContain(branchMembers);
  });

  it("runs every statement on the transaction handle, never on the global db", async () => {
    const { tx } = fakeTx({ deals: [], deactivated: 1 });
    vi.mocked(db.transaction).mockImplementation((async (cb: (t: unknown) => unknown) => cb(tx)) as never);
    const globalUpdate = vi.spyOn(db, "update");

    await organizationMemberRemovalRepository.reassignAndDeactivate({ ...base, newOwnerId: null, newOwnerBranchId: null });

    expect(globalUpdate).not.toHaveBeenCalled();
    expect(db.transaction).toHaveBeenCalledOnce();
  });
});
