import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { ticketRepository } from "./ticket.repository";
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
