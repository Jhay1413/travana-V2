import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { taskRepository } from "./task.repository";
import { resetCapture, renderWhere } from "../../test/capture-db";
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
