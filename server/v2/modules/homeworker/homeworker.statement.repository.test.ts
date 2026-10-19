import { describe, it, expect, vi, beforeEach } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import { auditLog, homeworkerPayoutStatement } from "@shared/schema";

const selectCalls: Array<{ fields: Record<string, SQL>; from?: SQL; where?: SQL; orderBy?: unknown[] }> = [];
let selectRows: unknown[] = [];
const inserts: Array<{ table: unknown; values: Record<string, unknown> }> = [];
let insertError: unknown = null;

function selectChain(fields: Record<string, SQL>) {
  const call: (typeof selectCalls)[number] = { fields };
  selectCalls.push(call);
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  chain.from = (src: SQL) => {
    call.from = src;
    return chain;
  };
  chain.innerJoin = self;
  chain.leftJoin = self;
  chain.limit = self;
  chain.where = (cond: SQL) => {
    call.where = cond;
    return chain;
  };
  chain.orderBy = (...cols: unknown[]) => {
    call.orderBy = cols;
    return chain;
  };
  chain.then = (resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(selectRows).then(resolve, reject);
  return chain;
}

function makeTx() {
  return {
    insert: vi.fn((table: unknown) => ({
      values: vi.fn((values: Record<string, unknown>) => {
        if (insertError) throw insertError;
        inserts.push({ table, values });
        return { returning: vi.fn(() => Promise.resolve([{ id: "st1", ...values }])), then: undefined };
      }),
    })),
  };
}

vi.mock("../../config/database", () => ({
  db: {
    select: vi.fn((fields: Record<string, SQL>) => selectChain(fields)),
    transaction: vi.fn(async (cb: (tx: unknown) => Promise<unknown>) => cb(makeTx())),
  },
}));
vi.mock("../branch-member/branch-member.repository", () => ({ branchMemberRepository: { setActiveForUser: vi.fn() } }));

import { homeworkerRepository } from "./homeworker.repository";

const dialect = new PgDialect();
const render = (q: SQL) => {
  const r = dialect.sqlToQuery(q);
  return { text: r.sql.replace(/\s+/g, " "), params: r.params };
};

beforeEach(() => {
  selectCalls.length = 0;
  inserts.length = 0;
  selectRows = [];
  insertError = null;
});

describe("homeworkerRepository.getStatementTotals", () => {
  it("selects clamped, rounded gross and the SQL-computed shares", async () => {
    selectRows = [{ gross: "100.00", homeworkerShare: "70.00", orgShare: "30.00", bookingCount: 3 }];

    const totals = await homeworkerRepository.getStatementTotals("o1", "hb1", "2026-03-01", "2026-04-01", "70.00");

    expect(totals).toEqual({ gross: "100.00", homeworkerShare: "70.00", orgShare: "30.00", bookingCount: 3 });
    const { fields, from } = selectCalls[0];
    // The gross lives once in the derived table; the select list only references s.g.
    expect(render(fields.gross).text).toBe("CAST(s.g AS TEXT)");
    const gross = render(from as SQL).text;
    expect(gross).toContain("GREATEST");
    expect(gross).toContain("ROUND");
    expect(gross).toContain('"booking_table"."discounts"');
    expect(gross).toContain('"booking_table"."service_charge"');
    expect(gross).toContain('FROM "booking_upsell"');
    expect(gross).toContain('"booking_upsell"."added_at" >=');
    expect(gross).toContain('"booking_table"."package_commission"');
    const share = render(fields.homeworkerShare);
    expect(share.text).toContain("ROUND(s.g * CAST(");
    expect(share.text).toContain("/ 100, 2)");
    expect(share.params).toContain("70.00");
    expect(render(fields.orgShare).text).toContain("(s.g - ROUND(s.g");

    // The scoping lives inside the scalar subqueries of the derived gross.
    expect(gross).toContain('COALESCE("transaction"."is_test", false) = false');
    expect(gross).toContain('"booking_table"."date_created" >=');
    expect(gross).toContain('"booking_table"."date_created" <');
    expect(render(from as SQL).params).toEqual(expect.arrayContaining(["o1", "hb1", true]));
    expect(render(fields.bookingCount).text).toContain("COUNT(");
  });

  it("returns zeroes when no row comes back", async () => {
    selectRows = [];

    await expect(homeworkerRepository.getStatementTotals("o1", "hb1", "2026-03-01", "2026-04-01", "50")).resolves.toEqual({
      gross: "0.00",
      homeworkerShare: "0.00",
      orgShare: "0.00",
      bookingCount: 0,
    });
  });
});

describe("homeworkerRepository.findStatement / findOverlappingStatement", () => {
  it("findStatement matches the exact period (start AND end) on the branch", async () => {
    selectRows = [{ id: "st1" }];

    await expect(homeworkerRepository.findStatement("hb1", "2026-03-01", "2026-04-01")).resolves.toEqual({ id: "st1" });

    const cond = render(selectCalls[0].where as SQL);
    expect(cond.text).toContain('"homeworker_payout_statement"."branch_id" =');
    expect(cond.text).toContain('"homeworker_payout_statement"."period_start" =');
    expect(cond.text).toContain('"homeworker_payout_statement"."period_end" =');
    expect(cond.params).toEqual(["hb1", "2026-03-01", "2026-04-01"]);
  });

  it("findOverlappingStatement uses period_start < to AND period_end > from", async () => {
    selectRows = [];

    await expect(homeworkerRepository.findOverlappingStatement("hb1", "2026-03-01", "2026-04-01")).resolves.toBeNull();

    const cond = render(selectCalls[0].where as SQL);
    expect(cond.text).toContain('"period_start" <');
    expect(cond.text).toContain('"period_end" >');
    expect(cond.params).toEqual(["hb1", "2026-04-01", "2026-03-01"]);
  });
});

describe("homeworkerRepository.getStatementLines", () => {
  it("returns one row per booking with exact money columns, ordered by date then id", async () => {
    selectRows = [{ bookingId: "bk1" }];

    const lines = await homeworkerRepository.getStatementLines("o1", "hb1", "2026-03-01", "2026-04-01");

    expect(lines).toEqual([{ bookingId: "bk1" }]);
    const { fields, where, orderBy } = selectCalls[0];
    expect(Object.keys(fields)).toEqual([
      "bookingId", "transactionId", "clientName", "dateCreated", "commission", "discounts", "serviceCharge", "net",
    ]);
    expect(render(fields.net).text).toContain('- COALESCE(CAST("booking_table"."discounts"');
    expect(render(fields.net).text).not.toContain("booking_upsell");
    const cond = render(where as SQL).text;
    expect(cond).toContain('"transaction"."branch_id" =');
    expect(cond).toContain('COALESCE("transaction"."is_test", false) = false');
    expect(cond).toContain('"booking_table"."date_created" >=');
    expect(orderBy).toHaveLength(2);
  });
});

describe("homeworkerRepository.getStatementUpsellLines", () => {
  it("returns upsells added in the window on any booking of the branch, filtered by added_at not date_created", async () => {
    selectRows = [{ bookingId: "bk1", amount: "30.00" }];

    const rows = await homeworkerRepository.getStatementUpsellLines("o1", "hb1", "2026-03-01", "2026-04-01");

    expect(rows).toEqual([{ bookingId: "bk1", amount: "30.00" }]);
    const { fields, where, orderBy } = selectCalls[0];
    expect(Object.keys(fields)).toEqual(["bookingId", "transactionId", "clientName", "addedAt", "upsellType", "amount"]);
    const cond = render(where as SQL);
    expect(cond.text).toContain('"booking_upsell"."added_at" >=');
    expect(cond.text).toContain('"booking_upsell"."added_at" <');
    expect(cond.text).toContain('"booking_upsell"."is_active" =');
    expect(cond.text).not.toContain("date_created");
    expect(cond.text).toContain('COALESCE("transaction"."is_test", false) = false');
    expect(cond.params).toEqual(expect.arrayContaining(["o1", "hb1"]));
    expect(orderBy).toHaveLength(2);
  });
});

describe("homeworkerRepository.insertStatement", () => {
  const record = {
    orgId: "o1",
    branchId: "hb1",
    userId: "hw1",
    periodStart: "2026-03-01",
    periodEnd: "2026-04-01",
    grossProfit: "100.00",
    sharePercent: "70.00",
    homeworkerShare: "70.00",
    orgShare: "30.00",
    periodEndInclusive: "2026-03-31",
    finalisedBy: "admin1",
    auditName: null,
  };

  it("stores a final statement and its audit row in one transaction", async () => {
    const result = await homeworkerRepository.insertStatement(record);

    expect(inserts.map((i) => i.table)).toEqual([homeworkerPayoutStatement, auditLog]);
    expect(inserts[0].values).toMatchObject({
      status: "final",
      finalisedBy: "admin1",
      grossProfit: "100.00",
      homeworkerShare: "70.00",
      orgShare: "30.00",
    });
    expect(inserts[0].values.finalisedAt).toBeInstanceOf(Date);
    expect(inserts[0].values.updatedAt).toBeInstanceOf(Date);
    expect(inserts[1].values).toMatchObject({
      action: "homeworker.statement.finalise",
      entityType: "homeworker_payout_statement",
      entityId: "st1",
      performedBy: "admin1",
      entityTitle: "2026-03-01 to 2026-03-31",
    });
    expect(inserts[1].values.entityData).toMatchObject({
      branchId: "hb1",
      userId: "hw1",
      periodStart: "2026-03-01",
      periodEnd: "2026-04-01",
      periodEndInclusive: "2026-03-31",
      periodEndNote: "exclusive end stored",
      grossProfit: "100.00",
    });
    expect(result.status).toBe("created");
    expect(result.status === "created" && result.row.id).toBe("st1");
  });

  it("reports a unique-constraint violation as a duplicate result (the service throws the 409)", async () => {
    insertError = Object.assign(new Error("dup"), { code: "23505" });

    await expect(homeworkerRepository.insertStatement(record)).resolves.toEqual({ status: "duplicate" });
  });

  it("also recognises 23505 nested in err.cause (driver-wrapped errors)", async () => {
    insertError = Object.assign(new Error("Failed query"), { cause: { code: "23505" } });

    await expect(homeworkerRepository.insertStatement(record)).resolves.toEqual({ status: "duplicate" });
  });

  it("rethrows other errors unchanged", async () => {
    insertError = new Error("boom");

    await expect(homeworkerRepository.insertStatement(record)).rejects.toThrow("boom");
  });
});

describe("homeworkerRepository.listStatementsByBranch", () => {
  it("is scoped to the org and branch, newest period first", async () => {
    selectRows = [{ id: "st1" }];

    const rows = await homeworkerRepository.listStatementsByBranch("o1", "hb1", 12);

    expect(rows).toEqual([{ id: "st1" }]);
    const call = selectCalls[0];
    const where = render(call.where as SQL);
    expect(where.text).toContain('"homeworker_payout_statement"."org_id" = ');
    expect(where.text).toContain('"homeworker_payout_statement"."branch_id" = ');
    expect(where.params).toEqual(expect.arrayContaining(["o1", "hb1"]));
    expect(call.orderBy).toHaveLength(1);
  });
});
