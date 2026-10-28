import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { taskRepository } from "./task.repository";
import { resetCapture, renderWhere, setRows } from "../../test/capture-db";
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

describe("taskRepository partition", () => {
  it("excludes homeworker branches for shop staff", async () => {
    await taskRepository.findById("t1", AGENT);
    expect(renderWhere(0).text).toContain('"tasks"."branch_id" NOT IN (SELECT');
  });

  it("lets an own-branch homeworker also see their legacy NULL-branch tasks", async () => {
    await taskRepository.findById("t1", OWN_HOMEWORKER);
    const r = renderWhere(0);
    expect(r.text).toContain('"tasks"."branch_id" is null');
    expect(r.params).toEqual(expect.arrayContaining(["hw1", "hw"]));
  });

  it("does not add the NULL-branch arm for shop staff", async () => {
    await taskRepository.findById("t1", AGENT);
    expect(renderWhere(0).text).not.toMatch(/"tasks"."branch_id" is null and/i);
  });
});

describe("entity-scoped task reads (Q1)", () => {
  it("findByEntity applies no task-level partition or owner filter", async () => {
    resetCapture();
    await taskRepository.findByEntity("quote", "q1", OWN_HOMEWORKER);
    const t = renderWhere(0).text;
    expect(t).not.toContain("NOT IN (SELECT");
    expect(t).not.toContain('"tasks"."user_id"');
    expect(t).not.toContain('"tasks"."branch_id"');
  });

  it("entityInScope hides a homeworker's deal from shop staff", async () => {
    resetCapture();
    await taskRepository.entityInScope("enquiry", "e1", AGENT);
    expect(renderWhere(0).text).toContain('"transaction"."branch_id" NOT IN (SELECT');
  });

  it("entityInScope hides a homeworker's client from shop staff and pins an own-branch homeworker", async () => {
    resetCapture();
    await taskRepository.entityInScope("client", "c1", AGENT);
    expect(renderWhere(0).text).toContain('"client_table"."branch_id" NOT IN (SELECT');
    resetCapture();
    await taskRepository.entityInScope("transaction", "t1", OWN_HOMEWORKER);
    expect(renderWhere(0).params).toEqual(expect.arrayContaining(["hw1", "hw"]));
  });

  it("entityInScope fails closed for unknown entity types", async () => {
    expect(await taskRepository.entityInScope("homeworker_payout_statement", "x", AGENT)).toBe(false);
  });
});

describe("taskRepository.findByClient", () => {
  it("matches the client itself or any of its deal ids, with only the org-level task scope", async () => {
    resetCapture();
    setRows([{ id: "d1" }]);
    await taskRepository.findByClient("c1", OWN_HOMEWORKER);
    // 3 deal-id lookups (quote, booking, enquiry) then the tasks query.
    const r = renderWhere(3);
    expect(r.text).toContain('"tasks"."entity_type" =');
    expect(r.text).toContain('"tasks"."entity_id" in');
    expect(r.params).toEqual(expect.arrayContaining(["client", "c1", "d1"]));
    expect(r.text).toContain('"tasks"."org_id"');
    expect(r.text).not.toContain("NOT IN (SELECT");
    expect(r.text).not.toContain('"tasks"."user_id"');
  });

  it("applies the transaction org and partition scope to the deal-id lookups", async () => {
    resetCapture();
    setRows([]);
    await taskRepository.findByClient("c1", AGENT);
    for (const i of [0, 1, 2]) {
      const r = renderWhere(i);
      expect(r.text).toContain('"transaction"."org_id"');
      expect(r.text).toContain('"transaction"."branch_id" NOT IN (SELECT');
    }
    resetCapture();
    setRows([]);
    await taskRepository.findByClient("c1", OWN_HOMEWORKER);
    expect(renderWhere(0).params).toEqual(expect.arrayContaining(["org1", "hw1"]));
  });

  it("falls back to the client-only match when it has no deals", async () => {
    resetCapture();
    setRows([]);
    await taskRepository.findByClient("c1", AGENT);
    const r = renderWhere(3);
    expect(r.text).not.toContain('"tasks"."entity_id" in');
    expect(r.params).toEqual(expect.arrayContaining(["client", "c1"]));
  });
});

describe("task write scope (taskWritableConds)", () => {
  it("update/findById/toggle/remove for an agent: own task OR visible entity", async () => {
    for (const run of [
      () => taskRepository.update("t1", { title: "x" }, AGENT),
      () => taskRepository.findById("t1", AGENT),
      () => taskRepository.toggleComplete("t1", AGENT),
      () => taskRepository.remove("t1", AGENT),
    ]) {
      resetCapture();
      await run();
      const r = renderWhere(0);
      expect(r.text).toContain(" or ");
      expect(r.text).toContain('"tasks"."user_id" = ');
      expect(r.text).toContain('"tasks"."entity_id" IN (SELECT "quote_table"."id"::text');
      expect(r.text).toContain('"transaction"."org_id"');
      expect(r.params).toEqual(expect.arrayContaining(["t1", "org1", "u1"]));
    }
  });

  it("keeps admins on the normal scope (no entity arm, no user restriction)", async () => {
    resetCapture();
    await taskRepository.update("t1", { title: "x" }, { ...AGENT, orgRole: "org_admin", orgRoles: ["org_admin"] });
    const t = renderWhere(0).text;
    expect(t).not.toContain("SELECT");
    expect(t).not.toContain('"tasks"."user_id"');
  });

  it("homeworkers only gain deals they own via the transaction partition", async () => {
    resetCapture();
    await taskRepository.remove("t1", OWN_HOMEWORKER);
    expect(renderWhere(0).params).toEqual(expect.arrayContaining(["hw1", "hw"]));
  });
});
