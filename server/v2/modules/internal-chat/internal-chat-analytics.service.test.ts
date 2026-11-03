import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./internal-chat-analytics.repository", () => ({
  internalChatAnalyticsRepository: {
    getPipelineStats: vi.fn().mockResolvedValue({ enquiries: 0, quotes: 0, bookings: 0 }),
  },
}));

import { internalChatAnalyticsService } from "./internal-chat-analytics.service";
import { internalChatAnalyticsRepository } from "./internal-chat-analytics.repository";
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

beforeEach(() => vi.clearAllMocks());

describe("internalChatAnalyticsService.getPipelineAnswer partitionScope", () => {
  it("passes the caller's full scope alongside the resolved level", async () => {
    await internalChatAnalyticsService.getPipelineAnswer(AGENT, "this_month");
    const arg = vi.mocked(internalChatAnalyticsRepository.getPipelineStats).mock.calls[0][0];
    expect(arg.resolvedScope).toMatchObject({ level: "own", userId: "u1", partitionScope: AGENT });
  });
});
