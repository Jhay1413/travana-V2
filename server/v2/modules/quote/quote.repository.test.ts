import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { newQuoteRepository } from "./quote.repository";
import { resetCapture, renderWhere, renderHaving, havingCalls } from "../../test/capture-db";
import type { SocialStatus } from "./quote.types";
import type { Scope } from "../../utils/scope";

const TRUSTED = { orgId: null } as const;

beforeEach(() => resetCapture());

describe("newQuoteRepository.findFreeQuotesPaginated - socialStatus filter", () => {
  async function whereFor(socialStatus?: SocialStatus): Promise<string> {
    await newQuoteRepository.findFreeQuotesPaginated(0, 12, false, "none", "", "", "", TRUSTED, false, false, "all", [], socialStatus);
    return renderWhere(0).text;
  }

  it("draft renders an onlySocialsId IS NULL check against travel_deal", async () => {
    const text = await whereFor("draft");
    expect(text).toContain('"onlySocialsId" IS NULL');
    expect(text).toContain("EXISTS");
  });

  it("posted renders a < comparison on postSchedule (or NULL)", async () => {
    const text = await whereFor("posted");
    expect(text).toContain('"postSchedule" < now()');
    expect(text).toContain('"postSchedule" IS NULL');
    expect(text).toContain('"onlySocialsId" IS NOT NULL');
  });

  it("scheduled renders a >= comparison on postSchedule", async () => {
    expect(await whereFor("scheduled")).toContain('"postSchedule" >= now()');
  });

  it("not_generated renders NOT EXISTS over travel_deal", async () => {
    expect(await whereFor("not_generated")).toContain("NOT EXISTS");
  });

  it("adds no status predicate when socialStatus is omitted", async () => {
    const text = await whereFor(undefined);
    expect(text).not.toContain('"onlySocialsId" IS NULL');
    expect(text).not.toContain('"postSchedule" <');
  });
});

describe("newQuoteRepository.countFreeQuotesBySocialStatus", () => {
  it("uses the free-list base conditions and applies the search filter", async () => {
    await newQuoteRepository.countFreeQuotesBySocialStatus("Rome", [], TRUSTED);
    const { text, params } = renderWhere(0);
    expect(text).toContain('"isFreeQuote"');
    expect(text).toContain('"not_for_social"');
    expect(params).toContain("%rome%");
  });

  it("returns zeroed counts when the query yields no row", async () => {
    const counts = await newQuoteRepository.countFreeQuotesBySocialStatus("", [], TRUSTED);
    expect(counts).toEqual({ total: 0, not_generated: 0, draft: 0, scheduled: 0, posted: 0 });
  });
});

describe("free-quote scoping with a real Scope", () => {
  const SCOPE: Scope = {
    orgId: "org1", branchId: "b1", orgRole: "agent", orgRoles: ["agent"],
    userId: "u1", branchType: "shop", ownsHomeworkerBranch: false,
  };

  it("countFreeQuotesBySocialStatus filters by org and branch partition", async () => {
    await newQuoteRepository.countFreeQuotesBySocialStatus("", [], SCOPE);
    const { text, params } = renderWhere(0);
    expect(text).toContain("org_id");
    expect(text).toContain("branch_id");
    expect(params).toContain("org1");
  });

  it("findFreeQuotesPaginated with socialStatus draft filters by org and branch partition", async () => {
    await newQuoteRepository.findFreeQuotesPaginated(0, 12, false, "none", "", "", "", SCOPE, false, false, "all", [], "draft");
    const { text, params } = renderWhere(0);
    expect(text).toContain('"onlySocialsId" IS NULL');
    expect(text).toContain("org_id");
    expect(text).toContain("branch_id");
    expect(params).toContain("org1");
  });
});

describe("newQuoteRepository.findRecentClientEngagement - period HAVING", () => {
  it("renders >= and < on max(viewed_at) for a bounded range", async () => {
    await newQuoteRepository.findRecentClientEngagement({
      orgId: "o1",
      viewedFrom: new Date("2026-10-14T23:00:00Z"),
      viewedBefore: new Date("2026-10-15T23:00:00Z"),
    });
    const { text, params } = renderHaving(0);
    expect(text).toContain("max(");
    expect(text).toContain(">=");
    expect(text).toContain("<");
    expect(params).toEqual(["2026-10-14T23:00:00.000Z", "2026-10-15T23:00:00.000Z"]);
  });

  it("adds no HAVING when no period bounds are given", async () => {
    await newQuoteRepository.findRecentClientEngagement({ orgId: "o1" });
    expect(havingCalls).toHaveLength(1);
    expect(havingCalls[0]).toBeUndefined();
  });
});
