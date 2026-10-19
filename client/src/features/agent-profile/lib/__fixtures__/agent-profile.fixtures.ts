import type { AgentProfileHeader, AgentProfilePerformance } from "../../types";

/** Shared test fixtures. Not imported by app code. */
export function makeHeader(over: Partial<AgentProfileHeader> = {}): AgentProfileHeader {
  return {
    user: { id: "u1", name: "Tina Baker", firstName: "Tina", lastName: "Baker", email: "tina@example.com", phone: "07700 900123", image: null },
    organisationName: "Tinas Travel Deals",
    roles: ["agent"],
    primaryRole: "agent",
    branches: [
      { id: "b1", name: "Leeds", branchType: "shop", openingPattern: "mon-fri", orgRole: "agent", isActive: true, joinedAt: "2024-03-12" },
    ],
    isSuspended: false,
    isHomeworker: false,
    homeworker: null,
    startedAt: "2024-03-12",
    startedAtSource: "hr",
    openDeals: 4,
    biggestDeal: null,
    bestMonth: null,
    lifetimeProfit: 52000,
    viewer: { isAdmin: true, canSeePay: true, comparatorScope: "organisation", comparatorLabel: "Tinas Travel Deals" },
    ...over,
  };
}

export function makePerformance(over: Partial<AgentProfilePerformance> = {}): AgentProfilePerformance {
  return {
    window: { from: "2026-10-01", to: "2026-11-01" },
    profit: 2000,
    bookings: 4,
    sales: 20000,
    ppb: 500,
    quotesSent: 20,
    quotedDeals: 10,
    quoteViews: 30,
    closeRate: 40,
    commissionRate: 10,
    comparator: { scope: "organisation", label: "Tinas Travel Deals", profit: 8000, bookings: 20, sales: 100000, avgCommissionRate: 7.41 },
    ...over,
  };
}
