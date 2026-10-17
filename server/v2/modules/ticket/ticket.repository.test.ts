import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { ticketRepository } from "./ticket.repository";
import { resetCapture, renderWhere, setRows, whereCalls, orderByCalls } from "../../test/capture-db";
import type { Scope } from "../../utils/scope";

const AGENT: Scope = {
  orgId: "org1",
  branchId: "b1",
  orgRole: "agent",
  orgRoles: ["agent"],
  userId: "u1",
  branchType: "shop",
  ownsHomeworkerBranch: false,
};

const OWN_HOMEWORKER: Scope = {
  ...AGENT,
  orgRole: "homeworker",
  orgRoles: ["homeworker"],
  branchId: "hw1",
  userId: "hw",
  branchType: "homeworker",
  ownsHomeworkerBranch: true,
};

beforeEach(() => resetCapture());

describe("ticketRepository partition", () => {
  it("excludes homeworker branches for shop staff", async () => {
    await ticketRepository.findById("t1", AGENT, "u1");
    expect(renderWhere(0).text).toContain('"tickets"."branch_id" NOT IN (SELECT');
  });

  it("homeworker: own branch OR a legacy NULL-branch ticket they created or are assigned", async () => {
    await ticketRepository.findById("t1", OWN_HOMEWORKER, "hw");
    const r = renderWhere(0);
    expect(r.text).toContain('"tickets"."branch_id" = $');
    expect(r.text).toContain('"tickets"."branch_id" is null');
    expect(r.text).toContain('"tickets"."assigned_to"');
    expect(r.params).toEqual(expect.arrayContaining(["hw1", "hw"]));
  });

  it("does not add the NULL-branch arm for shop staff", async () => {
    await ticketRepository.findById("t1", AGENT, "u1");
    expect(renderWhere(0).text).not.toMatch(/"tickets"."branch_id" is null and/i);
  });

  it("org_admin gets no partition", async () => {
    await ticketRepository.findById("t1", { ...AGENT, orgRole: "org_admin", orgRoles: ["org_admin"] }, "u1");
    expect(renderWhere(0).text).not.toContain("NOT IN (SELECT");
  });
});

describe("ticketRepository.findByIdScoped", () => {
  it("agent read: org AND (assignee OR creator)", async () => {
    await ticketRepository.findByIdScoped("t1", AGENT);
    const r = renderWhere(0);
    expect(r.text).toContain('"tickets"."org_id" = $');
    expect(r.text).toContain('"tickets"."assigned_to" = $');
    expect(r.text).toContain('"tickets"."user_id" = $');
    expect(r.text).toContain('"tickets"."branch_id" NOT IN (SELECT');
    expect(r.params).toEqual(expect.arrayContaining(["t1", "org1", "u1"]));
  });

  it("agent delete: creator only (no assignee arm)", async () => {
    await ticketRepository.findByIdScoped("t1", AGENT, "delete");
    const r = renderWhere(0);
    expect(r.text).toContain('"tickets"."user_id" = $');
    expect(r.text).not.toContain('"tickets"."assigned_to"');
  });

  it("branch_manager is pinned to their branch", async () => {
    await ticketRepository.findByIdScoped("t1", { ...AGENT, orgRole: "branch_manager", orgRoles: ["branch_manager"] });
    const r = renderWhere(0);
    expect(r.text).toContain('"tickets"."branch_id" = $');
    expect(r.params).toEqual(expect.arrayContaining(["b1"]));
    expect(r.text).not.toContain('"tickets"."assigned_to"');
  });

  it("org_admin is org-wide with no partition", async () => {
    await ticketRepository.findByIdScoped("t1", { ...AGENT, orgRole: "org_admin", orgRoles: ["org_admin"] });
    const r = renderWhere(0);
    expect(r.text).toContain('"tickets"."org_id" = $');
    expect(r.text).not.toContain("NOT IN (SELECT");
    expect(r.text).not.toContain('"tickets"."assigned_to"');
  });

  it("platform_admin has no org restriction", async () => {
    await ticketRepository.findByIdScoped("t1", { ...AGENT, orgId: "", orgRole: "platform_admin", orgRoles: ["platform_admin"] });
    expect(renderWhere(0).text).not.toContain("org_id");
  });

  it("trusted scope ({ orgId: null }) is unrestricted", async () => {
    await ticketRepository.findByIdScoped("t1", { orgId: null });
    const r = renderWhere(0);
    expect(r.text).not.toContain("org_id");
    expect(r.params).toEqual(["t1"]);
  });

  it("homeworker: own branch AND creator-or-assignee (with the legacy NULL-branch arm)", async () => {
    await ticketRepository.findByIdScoped("t1", OWN_HOMEWORKER);
    const r = renderWhere(0);
    expect(r.text).toContain('"tickets"."branch_id" = $');
    expect(r.text).toContain('"tickets"."branch_id" is null');
    expect(r.text).toContain('"tickets"."assigned_to"');
    expect(r.params).toEqual(expect.arrayContaining(["hw1", "hw"]));
  });

  it("returns the first row or undefined", async () => {
    setRows([{ id: "t1" }]);
    await expect(ticketRepository.findByIdScoped("t1", AGENT)).resolves.toEqual({ id: "t1" });
    setRows([]);
    await expect(ticketRepository.findByIdScoped("t1", AGENT)).resolves.toBeUndefined();
  });
});

describe("ticketRepository.findHolidaySummaries", () => {
  it("runs no query for an empty id list", async () => {
    await expect(ticketRepository.findHolidaySummaries([])).resolves.toEqual({ transactions: [], quotes: [] });
    expect(whereCalls).toHaveLength(0);
  });

  it("filters the transaction query by id and the quote query to live primary non-free quotes", async () => {
    await ticketRepository.findHolidaySummaries(["x1", "x2"]);
    const a = renderWhere(0);
    expect(a.text).toContain('"transaction"."id" in ($');
    expect(a.params).toEqual(["x1", "x2"]);

    const b = renderWhere(1);
    expect(b.text).toContain('"quote_table"."transaction_id" in ($');
    expect(b.text).toContain('"quote_table"."deleted_at" is null');
    expect(b.text).toContain('"isQuoteCopy" IS NOT TRUE');
    expect(b.text).toContain('"isFreeQuote" IS NOT TRUE');
    expect(b.params).toEqual(["x1", "x2"]);
    expect(orderByCalls[0]).toHaveLength(3);
  });

  it("does not filter booking.deleted_at (it defaults to now())", async () => {
    await ticketRepository.findHolidaySummaries(["x1"]);
    expect(renderWhere(0).text).not.toContain("deleted_at");
  });
});

describe("ticketRepository.findHolidayLinkTarget", () => {
  it("looks the transaction up by id only", async () => {
    setRows([{ id: "x1", orgId: "org1", clientId: "c1" }]);
    await expect(ticketRepository.findHolidayLinkTarget("x1")).resolves.toEqual({ id: "x1", orgId: "org1", clientId: "c1" });
    expect(renderWhere(0).params).toContain("x1");
  });
});

describe("ticket scope fails closed for roles without wider reach", () => {
  it.each(["referral_agent", "social_media_manager", "mystery_role"] as const)(
    "%s: org AND creator-or-assignee, never org-wide",
    async (role) => {
      await ticketRepository.findByIdScoped("t1", { ...AGENT, orgRole: role as never, orgRoles: [role as never] });
      const r = renderWhere(0);
      expect(r.text).toContain('"tickets"."org_id" = $');
      expect(r.text).toContain('"tickets"."assigned_to" = $');
      expect(r.text).toContain('"tickets"."user_id" = $');
      expect(r.params).toEqual(expect.arrayContaining(["u1"]));
    },
  );

  it("branch_manager without a branch is limited to their own tickets", async () => {
    await ticketRepository.findByIdScoped("t1", { ...AGENT, orgRole: "branch_manager", orgRoles: ["branch_manager"], branchId: null });
    const r = renderWhere(0);
    expect(r.text).toContain('"tickets"."assigned_to" = $');
    expect(r.text).toContain('"tickets"."user_id" = $');
  });

  it("delete for those roles is creator-only", async () => {
    await ticketRepository.findByIdScoped("t1", { ...AGENT, orgRole: "social_media_manager", orgRoles: ["social_media_manager"] }, "delete");
    const r = renderWhere(0);
    expect(r.text).toContain('"tickets"."user_id" = $');
    expect(r.text).not.toContain('"tickets"."assigned_to"');
  });

  it("no user id matches nothing (false) instead of the whole org", async () => {
    await ticketRepository.findByIdScoped("t1", { ...AGENT, userId: null });
    expect(renderWhere(0).text).toContain("false");
  });

  it("branch_manager with a branch and org_admin stay unrestricted by creator", async () => {
    await ticketRepository.findByIdScoped("t1", { ...AGENT, orgRole: "branch_manager", orgRoles: ["branch_manager"] });
    expect(renderWhere(0).text).not.toContain('"tickets"."assigned_to"');
  });

  it("list modes: mine / raised / all keep their narrowing", async () => {
    await ticketRepository.findAll(AGENT, "u1", "mine");
    expect(renderWhere(0).text).toContain('"tickets"."assigned_to"');
    await ticketRepository.findAll(AGENT, "u1", "raised");
    expect(renderWhere(1).params).toEqual(expect.arrayContaining(["u1"]));
    await ticketRepository.findAll({ ...AGENT, orgRole: "org_admin", orgRoles: ["org_admin"] }, "u1", "all");
    expect(renderWhere(2).text).not.toContain('"tickets"."assigned_to"');
  });
});
