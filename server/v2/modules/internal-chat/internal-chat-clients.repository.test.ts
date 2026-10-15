import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { internalChatClientsRepository } from "./internal-chat-clients.repository";
import { resetCapture, renderWhere, whereCalls } from "../../test/capture-db";
import type { Scope } from "../../utils/scope";

const AGENT: Scope = {
  orgId: "org1", branchId: "b1", orgRole: "agent", orgRoles: ["agent"],
  userId: "u1", branchType: "shop", ownsHomeworkerBranch: false,
};

beforeEach(() => resetCapture());

const texts = () => whereCalls.map((_, i) => renderWhere(i).text);

describe("internalChatClientsRepository deal queries apply the partition", () => {
  it("getClientPipelineCounts excludes homeworker-branch deals for shop staff", async () => {
    await internalChatClientsRepository.getClientPipelineCounts("c1", "org1", AGENT).catch(() => undefined);
    expect(texts().length).toBeGreaterThan(0);
    expect(texts().every((t) => t.includes('"transaction"."branch_id" NOT IN (SELECT'))).toBe(true);
  });

  it.each([
    ["getClientEnquiryDetails"],
    ["getClientQuoteDetails"],
    ["getClientBookingDetails"],
  ] as const)("%s excludes homeworker-branch deals for shop staff", async (method) => {
    await internalChatClientsRepository[method]("c1", "org1", AGENT).catch(() => undefined);
    expect(texts().some((t) => t.includes('"transaction"."branch_id" NOT IN (SELECT'))).toBe(true);
  });

  it("without a partitionScope the queries stay org + client only", async () => {
    await internalChatClientsRepository.getClientPipelineCounts("c1", "org1").catch(() => undefined);
    expect(texts().some((t) => t.includes("NOT IN (SELECT"))).toBe(false);
  });
});
