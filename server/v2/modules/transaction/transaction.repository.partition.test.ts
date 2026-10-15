import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { transactionRepository } from "./transaction.repository";
import { resetCapture, renderWhere, whereCalls } from "../../test/capture-db";
import type { Scope } from "../../utils/scope";

const SHOP_AGENT: Scope = {
  orgId: "org1",
  branchId: "b1",
  orgRole: "agent",
  orgRoles: ["agent"],
  userId: "u1",
  branchType: "shop",
  ownsHomeworkerBranch: false,
};
const SMM: Scope = { ...SHOP_AGENT, orgRole: "social_media_manager", orgRoles: ["social_media_manager"] };
const OWN_HOMEWORKER: Scope = {
  ...SHOP_AGENT,
  orgRole: "homeworker",
  orgRoles: ["homeworker"],
  branchId: "hw1",
  userId: "hw",
  branchType: "homeworker",
  ownsHomeworkerBranch: true,
};
const ORG_ADMIN: Scope = { ...SHOP_AGENT, orgRole: "org_admin", orgRoles: ["org_admin"] };

const EXCLUDE = '"transaction"."branch_id" NOT IN (SELECT';

beforeEach(() => resetCapture());

const allWheres = () => whereCalls.map((_, i) => renderWhere(i));

describe("transaction repository private scope builder applies the partition", () => {
  const calls: Array<[string, (s: Scope) => Promise<unknown>]> = [
    ["findByIdScopedForWrite", (s) => transactionRepository.findByIdScopedForWrite("t1", s)],
    ["update", (s) => transactionRepository.update("t1", {}, s)],
    ["remove", (s) => transactionRepository.remove("t1", s)],
    ["findAllLightweight", (s) => transactionRepository.findAllLightweight(s)],
    ["getStats", (s) => transactionRepository.getStats(s)],
    ["findAll", (s) => transactionRepository.findAll(s, {})],
    ["findPipelineByStatus", (s) => transactionRepository.findPipelineByStatus(s, "enquiry", 1, 10)],
  ];

  it.each(calls)("%s: shop agent excludes homeworker branches", async (_name, run) => {
    await run(SHOP_AGENT);
    expect(allWheres().some((w) => w.text.includes(EXCLUDE))).toBe(true);
  });

  it.each(calls)("%s: social_media_manager excludes homeworker branches", async (_name, run) => {
    await run(SMM);
    expect(allWheres().some((w) => w.text.includes(EXCLUDE))).toBe(true);
  });

  it.each(calls)("%s: own-branch homeworker is pinned to branch and own rows", async (_name, run) => {
    await run(OWN_HOMEWORKER);
    expect(allWheres().some((w) => w.params.includes("hw1") && w.params.includes("hw"))).toBe(true);
  });

  it.each(calls)("%s: org_admin gets no partition", async (_name, run) => {
    await run(ORG_ADMIN);
    expect(allWheres().some((w) => w.text.includes("NOT IN (SELECT"))).toBe(false);
  });
});
