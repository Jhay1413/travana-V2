import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { newQuoteRepository } from "./quote.repository";
import { db } from "../../config/database";
import { passengers, quote, transaction as transactionTable } from "@shared/schema";
import type { InsertQuote } from "@shared/schema";
import { agentProfileRepository } from "../agent-profile/agent-profile.repository";
import {
  truncateAll, makeOrg, makeBranch, makeUser, makeTransaction, makeClient, makePackageType,
  makeQuote, makePassenger,
} from "../../test/factories";

function scope(over: Record<string, unknown>) {
  return { branchId: null, userId: null, orgRoles: [], ...over } as never;
}

const TRUSTED = { orgId: null } as const;

let orgA: { id: string };
let orgB: { id: string };
let branchA1: { id: string };
let branchA2: { id: string };
let agentUser: { id: string };
let txnA1: { id: string }; // branchA1
let txnA2: { id: string }; // branchA2
let txnB: { id: string }; // orgB

beforeEach(async () => {
  await truncateAll();
  orgA = await makeOrg();
  orgB = await makeOrg();
  branchA1 = await makeBranch(orgA.id);
  branchA2 = await makeBranch(orgA.id);
  agentUser = await makeUser();
  txnA1 = await makeTransaction({ user_id: agentUser.id, org_id: orgA.id, branch_id: branchA1.id });
  txnA2 = await makeTransaction({ user_id: agentUser.id, org_id: orgA.id, branch_id: branchA2.id });
  txnB = await makeTransaction({ user_id: agentUser.id, org_id: orgB.id, branch_id: null });
});

describe("newQuoteRepository.findById — soft delete", () => {
  it("returns a live quote", async () => {
    const q = await makeQuote({ transaction_id: txnA1.id });
    expect((await newQuoteRepository.findById(q.id))?.id).toBe(q.id);
  });

  it("hides a soft-deleted quote (deleted_at set)", async () => {
    const q = await makeQuote({ transaction_id: txnA1.id, deleted_at: new Date() });
    expect(await newQuoteRepository.findById(q.id)).toBeUndefined();
  });
});

describe("newQuoteRepository.findCurrentPrimary / flipPrimary", () => {
  it("counts a legacy NULL isQuoteCopy row as the main quote and ignores copies and soft-deleted rows", async () => {
    await makeQuote({ transaction_id: txnA1.id, isQuoteCopy: true });
    await makeQuote({ transaction_id: txnA1.id, isQuoteCopy: false, deleted_at: new Date() });
    expect(await newQuoteRepository.findCurrentPrimary(txnA1.id)).toBeUndefined();

    const legacy = await makeQuote({ transaction_id: txnA1.id, isQuoteCopy: null });
    expect((await newQuoteRepository.findCurrentPrimary(txnA1.id))?.id).toBe(legacy.id);
    expect(await newQuoteRepository.findCurrentPrimary(txnA1.id, legacy.id)).toBeUndefined();
  });

  it("prefers a live main over a lost one when a legacy deal has both, whatever the insert order", async () => {
    await makeQuote({ transaction_id: txnA1.id, isQuoteCopy: false, quote_status: "lost", date_created: new Date("2026-01-01T00:00:00Z") });
    const live = await makeQuote({ transaction_id: txnA1.id, isQuoteCopy: null, quote_status: "in_play", date_created: new Date("2026-02-01T00:00:00Z") });
    expect((await newQuoteRepository.findCurrentPrimary(txnA1.id))?.id).toBe(live.id);
  });

  it("flipPrimary leaves exactly one main: a lost main is demoted when a new copy is promoted", async () => {
    const dead = await makeQuote({ transaction_id: txnA1.id, isQuoteCopy: false, quote_status: "lost" });
    const fresh = await makeQuote({ transaction_id: txnA1.id, isQuoteCopy: true });
    await newQuoteRepository.flipPrimary(fresh.id, dead.id);
    expect((await newQuoteRepository.findCurrentPrimary(txnA1.id))?.id).toBe(fresh.id);
    const rows = await db.select().from(quote).where(eq(quote.transaction_id, txnA1.id));
    expect(rows.filter((r) => r.isQuoteCopy !== true).map((r) => r.id)).toEqual([fresh.id]);
  });
});

describe("newQuoteRepository.createReplacingDeadPrimary", () => {
  const WINDOW = { from: new Date("2026-10-01T00:00:00Z"), to: new Date("2026-11-01T00:00:00Z") };
  const IN_WINDOW = new Date("2026-10-15T12:00:00Z");

  async function lostDeal(isActive: boolean, deadStatus: "lost" | "archived" = "lost") {
    const client = await makeClient({ orgId: orgA.id });
    const txn = await makeTransaction({ user_id: agentUser.id, org_id: orgA.id, branch_id: branchA1.id, client_id: client.id, status: "on_quote", is_active: isActive });
    const dead = await makeQuote({ transaction_id: txn.id, isQuoteCopy: false, quote_status: deadStatus, is_active: isActive, date_created: new Date("2026-01-05T00:00:00Z") });
    const pkg = await makePackageType();
    const data = (): InsertQuote => ({
      transaction_id: txn.id, holiday_type_id: pkg.id, travel_date: "2026-12-01", quote_type: "package", quote_status: "quoted", date_created: IN_WINDOW,
    });
    return { txn, dead, data };
  }
  const counts = () => agentProfileRepository.getQuoteWindowCounts({ orgId: orgA.id, userId: agentUser.id }, WINDOW);
  const mains = async (txnId: string) =>
    (await db.select().from(quote).where(eq(quote.transaction_id, txnId))).filter((r) => r.isQuoteCopy !== true).map((r) => r.id);

  it("inserts the quote, swaps the main and reactivates an inactive deal, so active-deal reports count it", async () => {
    const { txn, dead, data } = await lostDeal(false);
    // Inactive deal: the agent profile's active-deal scope does not see the new quote.
    expect(await counts()).toEqual({ quotesSent: 0, quotedDeals: 0 });

    const { quote: fresh, promoted } = await newQuoteRepository.createReplacingDeadPrimary(data(), dead.id, txn.id);

    expect(promoted).toBe(true);
    expect(fresh.isQuoteCopy).toBe(false);
    expect(await mains(txn.id)).toEqual([fresh.id]);
    const [t] = await db.select().from(transactionTable).where(eq(transactionTable.id, txn.id));
    expect(t).toMatchObject({ is_active: true, status: "on_quote" });
    // The dead quote keeps its own state (still lost).
    const [d] = await db.select().from(quote).where(eq(quote.id, dead.id));
    expect(d).toMatchObject({ quote_status: "lost", is_active: false, isQuoteCopy: true });
    expect(await counts()).toEqual({ quotesSent: 1, quotedDeals: 1 });
  });

  it("without a reactivate id the deal's active flag is left alone", async () => {
    const { txn, dead, data } = await lostDeal(false);
    await newQuoteRepository.createReplacingDeadPrimary(data(), dead.id);
    const [t] = await db.select().from(transactionTable).where(eq(transactionTable.id, txn.id));
    expect(t.is_active).toBe(false);
  });

  it("an already-active deal stays active and only the main changes", async () => {
    const { txn, dead, data } = await lostDeal(true);
    const { quote: fresh } = await newQuoteRepository.createReplacingDeadPrimary(data(), dead.id, txn.id);
    const [t] = await db.select().from(transactionTable).where(eq(transactionTable.id, txn.id));
    expect(t.is_active).toBe(true);
    expect((await newQuoteRepository.findCurrentPrimary(txn.id))?.id).toBe(fresh.id);
  });

  it("two concurrent takeovers of the same dead main leave exactly one main; the loser stays a copy and does not reactivate", async () => {
    const { txn, dead, data } = await lostDeal(false);
    const results = await Promise.all([
      newQuoteRepository.createReplacingDeadPrimary(data(), dead.id, txn.id),
      newQuoteRepository.createReplacingDeadPrimary(data(), dead.id, txn.id),
    ]);
    expect(results.filter((r) => r.promoted)).toHaveLength(1);
    const winner = results.find((r) => r.promoted)!;
    const loser = results.find((r) => !r.promoted)!;
    expect(await mains(txn.id)).toEqual([winner.quote.id]);
    expect(loser.quote.isQuoteCopy).toBe(true);
    expect((await db.select().from(quote).where(eq(quote.transaction_id, txn.id)))).toHaveLength(3);
  });

  it("when the main is no longer dead (revived or replaced), the new quote stays a copy and the deal is untouched", async () => {
    const { txn, dead, data } = await lostDeal(false);
    await db.update(quote).set({ quote_status: "quoted" }).where(eq(quote.id, dead.id));
    const { quote: fresh, promoted } = await newQuoteRepository.createReplacingDeadPrimary(data(), dead.id, txn.id);
    expect(promoted).toBe(false);
    expect(fresh.isQuoteCopy).toBe(true);
    expect(await mains(txn.id)).toEqual([dead.id]);
    const [t] = await db.select().from(transactionTable).where(eq(transactionTable.id, txn.id));
    expect(t.is_active).toBe(false);
  });

  it("rolls the insert back when the takeover fails", async () => {
    const { txn, dead } = await lostDeal(false);
    await expect(
      newQuoteRepository.createReplacingDeadPrimary(
        // Bad holiday type: the insert itself fails, nothing is written.
        { transaction_id: txn.id, holiday_type_id: "00000000-0000-0000-0000-000000000000", travel_date: "2026-12-01", quote_type: "package" },
        dead.id,
        txn.id,
      ),
    ).rejects.toThrow();
    expect((await db.select().from(quote).where(eq(quote.transaction_id, txn.id)))).toHaveLength(1);
  });
});

describe("newQuoteRepository.findLostSiblings - only main quotes count", () => {
  it("ignores a lost copy (a demoted main) but still reports a lost main", async () => {
    const txn = await makeTransaction({ user_id: agentUser.id, org_id: orgA.id, branch_id: branchA1.id });
    const current = await makeQuote({ transaction_id: txn.id, isQuoteCopy: false });
    await makeQuote({ transaction_id: txn.id, isQuoteCopy: true, quote_status: "lost" });
    expect(await newQuoteRepository.findLostSiblings(txn.id, current.id)).toEqual([]);

    const lostMain = await makeQuote({ transaction_id: txn.id, isQuoteCopy: null, quote_status: "lost" });
    expect((await newQuoteRepository.findLostSiblings(txn.id, current.id)).map((r) => r.id)).toEqual([lostMain.id]);
  });
});

describe("newQuoteRepository.quoteInScope", () => {
  it("an agent sees quotes anywhere in its org but not another org", async () => {
    const q1 = await makeQuote({ transaction_id: txnA1.id });
    const q2 = await makeQuote({ transaction_id: txnA2.id });
    const qOtherOrg = await makeQuote({ transaction_id: txnB.id });

    const s = scope({ orgId: orgA.id, orgRole: "agent", branchId: branchA1.id });
    expect(await newQuoteRepository.quoteInScope(q1.id, s)).toBe(true);
    expect(await newQuoteRepository.quoteInScope(q2.id, s)).toBe(true); // other branch, same org
    expect(await newQuoteRepository.quoteInScope(qOtherOrg.id, s)).toBe(false);
  });
});

describe("newQuoteRepository.findByTransactionId — scope filtered", () => {
  it("returns the transaction's quotes for an in-scope caller and none for out-of-scope", async () => {
    await makeQuote({ transaction_id: txnA1.id });
    await makeQuote({ transaction_id: txnA1.id });

    const inScope = scope({ orgId: orgA.id, orgRole: "agent", branchId: branchA1.id });
    const outScope = scope({ orgId: orgB.id, orgRole: "agent", branchId: null }); // other org

    expect(await newQuoteRepository.findByTransactionId(txnA1.id, inScope)).toHaveLength(2);
    expect(await newQuoteRepository.findByTransactionId(txnA1.id, outScope)).toHaveLength(0);
  });

  it("excludes soft-deleted quotes", async () => {
    await makeQuote({ transaction_id: txnA1.id });
    await makeQuote({ transaction_id: txnA1.id, deleted_at: new Date() });

    expect(await newQuoteRepository.findByTransactionId(txnA1.id, TRUSTED)).toHaveLength(1);
  });
});

describe("newQuoteRepository.findByStatus", () => {
  it("returns only quotes matching the requested status", async () => {
    await makeQuote({ transaction_id: txnA1.id, quote_status: "quoted" });
    await makeQuote({ transaction_id: txnA1.id, quote_status: "in_play" });

    const quoted = await newQuoteRepository.findByStatus("quoted", TRUSTED);
    expect(quoted).toHaveLength(1);
    expect(quoted[0].quote_status).toBe("quoted");
  });
});

describe("newQuoteRepository.replaceChildPassengers", () => {
  async function childAgesFor(quoteId: string): Promise<number[]> {
    const rows = await db.select().from(passengers).where(eq(passengers.quote_id, quoteId));
    return rows.filter((r) => r.type === "child").map((r) => r.age).sort((a, b) => a - b);
  }

  it("replaces existing child passengers and leaves adults untouched", async () => {
    const q = await makeQuote({ transaction_id: txnA1.id });
    await makePassenger({ quote_id: q.id, type: "adult", age: 30 });
    await makePassenger({ quote_id: q.id, type: "child", age: 2 });
    await makePassenger({ quote_id: q.id, type: "child", age: 4 });

    await newQuoteRepository.replaceChildPassengers(q.id, "quote", [5, 8]);

    expect(await childAgesFor(q.id)).toEqual([5, 8]);
    // the adult passenger survives
    const all = await db.select().from(passengers).where(eq(passengers.quote_id, q.id));
    expect(all.some((p) => p.type === "adult" && p.age === 30)).toBe(true);
  });

  it("clears all children when given an empty list", async () => {
    const q = await makeQuote({ transaction_id: txnA1.id });
    await makePassenger({ quote_id: q.id, type: "child", age: 6 });

    await newQuoteRepository.replaceChildPassengers(q.id, "quote", []);

    expect(await childAgesFor(q.id)).toEqual([]);
  });
});

describe("newQuoteRepository.findWithDetails", () => {
  it("returns the quote with holiday_type_name and empty child collections", async () => {
    const q = await makeQuote({ transaction_id: txnA1.id, title: "Spain Break" });

    const details = await newQuoteRepository.findWithDetails(q.id);

    expect(details).toBeDefined();
    expect(details!.title).toBe("Spain Break");
    expect(details!.holiday_type_name).toBe("Package");
    expect(details!.flights).toEqual([]);
  });

  it("returns undefined for an unknown id", async () => {
    expect(await newQuoteRepository.findWithDetails("00000000-0000-0000-0000-000000000000")).toBeUndefined();
  });
});
