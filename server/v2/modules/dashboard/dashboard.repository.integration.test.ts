import { describe, it, expect, beforeEach } from "vitest";
import { dashboardRepository } from "./dashboard.repository";
import {
  truncateAll, makeOrg, makeUser, makeClient, makeTransaction, makeQuote,
} from "../../test/factories";

// Shared fixture:
//   clientA → orgA, clientB → orgB
//   t1 on_enquiry (A), t2 on_quote (A), t3 on_booking (B), t4 on_booking is_test (B)
//   q1 on t2 sales 1000, q2 on t3 sales 2000, q4 on t4 sales 9999 (is_test → excluded)
let orgA: { id: string };
let orgB: { id: string };

beforeEach(async () => {
  await truncateAll();
  orgA = await makeOrg();
  orgB = await makeOrg();
  const agent = await makeUser();
  const clientA = await makeClient({ orgId: orgA.id });
  const clientB = await makeClient({ orgId: orgB.id });

  const t1 = await makeTransaction({ user_id: agent.id, org_id: orgA.id, client_id: clientA.id, status: "on_enquiry" });
  const t2 = await makeTransaction({ user_id: agent.id, org_id: orgA.id, client_id: clientA.id, status: "on_quote" });
  const t3 = await makeTransaction({ user_id: agent.id, org_id: orgB.id, client_id: clientB.id, status: "on_booking" });
  const t4 = await makeTransaction({ user_id: agent.id, org_id: orgB.id, client_id: clientB.id, status: "on_booking", is_test: true });
  void t1;

  await makeQuote({ transaction_id: t2.id, sales_price: "1000" });
  await makeQuote({ transaction_id: t3.id, sales_price: "2000" });
  await makeQuote({ transaction_id: t4.id, sales_price: "9999" }); // on a test txn → excluded
});

describe("dashboardRepository.getStats — unscoped (whole platform)", () => {
  it("aggregates clients, status-filtered transactions, quotes and revenue", async () => {
    const stats = await dashboardRepository.getStats(null);

    expect(stats.totalClients).toBe(2);
    // test transaction t4 excluded from the funnel counts
    expect(stats.totalTransactions).toBe(3);
    expect(stats.enquiryCount).toBe(1);
    expect(stats.quotedCount).toBe(1);
    expect(stats.bookedCount).toBe(1);
    // q4 sits on a test transaction → excluded from quote + revenue stats
    expect(stats.totalQuotes).toBe(2);
    expect(stats.totalRevenue).toBe(3000); // 1000 + 2000
    expect(stats.avgDealSize).toBe(1500);
  });
});

describe("dashboardRepository.getStats — scoped to one org", () => {
  it("counts only that org's clients, transactions and quotes", async () => {
    const stats = await dashboardRepository.getStats(orgA.id);

    expect(stats.totalClients).toBe(1); // only clientA
    expect(stats.totalTransactions).toBe(2); // t1 + t2
    expect(stats.enquiryCount).toBe(1);
    expect(stats.quotedCount).toBe(1);
    expect(stats.bookedCount).toBe(0); // t3 is orgB
    expect(stats.totalQuotes).toBe(1); // q1 only
    expect(stats.totalRevenue).toBe(1000);
    expect(stats.avgDealSize).toBe(1000);
  });
});
