import { describe, it, expect, beforeEach } from "vitest";
import { eq } from "drizzle-orm";
import { newQuoteRepository } from "./quote.repository";
import { db } from "../../config/database";
import { passengers } from "@shared/schema";
import {
  truncateAll, makeOrg, makeBranch, makeUser, makeTransaction,
  makeQuote, makePassenger,
} from "../../test/factories";

function scope(over: Record<string, unknown>) {
  return { branchId: null, userId: null, orgRoles: [], ...over } as never;
}

const TRUSTED = { orgId: null } as const;

let orgA: { id: string };
let branchA1: { id: string };
let branchA2: { id: string };
let agentUser: { id: string };
let txnA1: { id: string }; // branchA1
let txnA2: { id: string }; // branchA2

beforeEach(async () => {
  await truncateAll();
  orgA = await makeOrg();
  branchA1 = await makeBranch(orgA.id);
  branchA2 = await makeBranch(orgA.id);
  agentUser = await makeUser();
  txnA1 = await makeTransaction({ user_id: agentUser.id, org_id: orgA.id, branch_id: branchA1.id });
  txnA2 = await makeTransaction({ user_id: agentUser.id, org_id: orgA.id, branch_id: branchA2.id });
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

describe("newQuoteRepository.quoteInScope", () => {
  it("an agent sees a quote in its branch but not another branch", async () => {
    const q1 = await makeQuote({ transaction_id: txnA1.id });
    const q2 = await makeQuote({ transaction_id: txnA2.id });

    const s = scope({ orgId: orgA.id, orgRole: "agent", branchId: branchA1.id });
    expect(await newQuoteRepository.quoteInScope(q1.id, s)).toBe(true);
    expect(await newQuoteRepository.quoteInScope(q2.id, s)).toBe(false);
  });
});

describe("newQuoteRepository.findByTransactionId — scope filtered", () => {
  it("returns the transaction's quotes for an in-scope caller and none for out-of-scope", async () => {
    await makeQuote({ transaction_id: txnA1.id });
    await makeQuote({ transaction_id: txnA1.id });

    const inScope = scope({ orgId: orgA.id, orgRole: "agent", branchId: branchA1.id });
    const outScope = scope({ orgId: orgA.id, orgRole: "agent", branchId: branchA2.id });

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
    await makeQuote({ transaction_id: txnA1.id, quote_status: "QUOTE_IN_PROGRESS" });
    await makeQuote({ transaction_id: txnA1.id, quote_status: "WON" });

    const inProgress = await newQuoteRepository.findByStatus("QUOTE_IN_PROGRESS", TRUSTED);
    expect(inProgress).toHaveLength(1);
    expect(inProgress[0].quote_status).toBe("QUOTE_IN_PROGRESS");
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
