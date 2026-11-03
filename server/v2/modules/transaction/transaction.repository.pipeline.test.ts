import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { transactionRepository } from "./transaction.repository";
import { resetCapture, renderWhere, whereCalls, orderByCalls } from "../../test/capture-db";
import { PgDialect } from "drizzle-orm/pg-core";
import type { SQL } from "drizzle-orm";
import type { Scope } from "../../utils/scope";

const SCOPE: Scope = {
  orgId: "org1",
  branchId: "b1",
  orgRole: "agent",
  orgRoles: ["agent"],
  userId: "u1",
  branchType: "shop",
  ownsHomeworkerBranch: false,
};

const dialect = new PgDialect();
const renderOrder = (i: number) => dialect.sqlToQuery(orderByCalls[i][0] as SQL).sql;

beforeEach(() => resetCapture());

describe("findPipelineByStatus filters", () => {
  it("adds no filter fragments when no filters are passed", async () => {
    await transactionRepository.findPipelineByStatus(SCOPE, "enquiry", 1, 10);
    const text = renderWhere(0).text;
    expect(text).not.toContain("ILIKE");
    expect(text).not.toContain("main_tour_operator_id");
    expect(text).not.toContain("GREATEST(");
  });

  it("ANDs filters onto the scope conditions without dropping them", async () => {
    await transactionRepository.findPipelineByStatus(SCOPE, "enquiry", 1, 10, undefined, undefined, undefined, undefined, undefined, {
      search: "paris",
      priorities: ["high"],
      tourOperatorIds: ["op1"],
      quick: "quiet_7",
    });
    const { text, params } = renderWhere(0);
    expect(text).toContain('"transaction"."branch_id" NOT IN (SELECT');
    expect(text).toContain("ILIKE");
    expect(text).toContain("main_tour_operator_id");
    expect(text).toContain("INTERVAL '7 days'");
    expect(params).toContain("%paris%");
    expect(params).toContain("high");
    expect(params).toContain("op1");
  });
});

describe("findPipelineByStatus ordering", () => {
  it("newest keeps created_at DESC", async () => {
    await transactionRepository.findPipelineByStatus(SCOPE, "quoted", 1, 10, undefined, undefined, "newest");
    expect(renderOrder(0)).toBe('"transaction"."created_at" DESC');
  });

  it("oldest keeps created_at ASC", async () => {
    await transactionRepository.findPipelineByStatus(SCOPE, "quoted", 1, 10, undefined, undefined, "oldest");
    expect(renderOrder(0)).toBe('"transaction"."created_at" ASC');
  });

  it("future column keeps its future-date ordering for the default sort", async () => {
    await transactionRepository.findPipelineByStatus(SCOPE, "future", 1, 10);
    expect(renderOrder(0)).toContain("future_deal_date");
  });

  it("latest_activity sorts by computed last activity, also on the future column", async () => {
    await transactionRepository.findPipelineByStatus(SCOPE, "future", 1, 10, undefined, undefined, "latest_activity");
    const order = renderOrder(0);
    expect(order).toContain("GREATEST(");
    expect(order).not.toContain("future_deal_date");
  });

  it("value_desc and name_asc use their SQL expressions", async () => {
    await transactionRepository.findPipelineByStatus(SCOPE, "quoted", 1, 10, undefined, undefined, "value_desc");
    await transactionRepository.findPipelineByStatus(SCOPE, "quoted", 1, 10, undefined, undefined, "name_asc");
    expect(renderOrder(0)).toContain("DESC NULLS LAST");
    expect(renderOrder(1)).toContain("LOWER(");
  });

  it("pins stay first when a pinned user is given", async () => {
    await transactionRepository.findPipelineByStatus(SCOPE, "quoted", 1, 10, undefined, undefined, "latest_activity", "u1");
    const order = renderOrder(0);
    expect(order.indexOf("IS NOT NULL DESC")).toBeGreaterThanOrEqual(0);
    expect(order.indexOf("IS NOT NULL DESC")).toBeLessThan(order.indexOf("GREATEST("));
  });
});

describe("totals", () => {
  it("returns zero totals for an empty column", async () => {
    const res = await transactionRepository.findPipelineByStatus(SCOPE, "quoted", 1, 10);
    expect(res).toMatchObject({ items: [], total: 0, totalValue: 0, totalProfit: 0, hasMore: false });
    expect(whereCalls.length).toBeGreaterThan(0);
  });

  it("runs the count and the page select for later pages too, with zero money totals", async () => {
    const res = await transactionRepository.findPipelineByStatus(SCOPE, "quoted", 2, 10);
    expect(res).toMatchObject({ page: 2, total: 0, totalValue: 0, totalProfit: 0 });
    expect(whereCalls).toHaveLength(2);
  });

  it("findPipelineCandidates also returns totals", async () => {
    const res = await transactionRepository.findPipelineCandidates(SCOPE, "quoted", undefined, undefined, 60);
    expect(res).toMatchObject({ total: 0, totalValue: 0, totalProfit: 0 });
  });
});

describe("countPipelineQuickByColumn", () => {
  it("queries the three open columns with the scope and filters applied", async () => {
    const rows = await transactionRepository.countPipelineQuickByColumn(SCOPE, undefined, undefined, { search: "x" });
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual({ all: 0, due_today: 0, no_task: 0, quiet_7: 0 });
    expect(whereCalls).toHaveLength(3);
    for (let i = 0; i < 3; i++) {
      expect(renderWhere(i).text).toContain('"transaction"."branch_id" NOT IN (SELECT');
      expect(renderWhere(i).params).toContain("%x%");
    }
  });
});
