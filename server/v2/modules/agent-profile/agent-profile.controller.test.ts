import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./agent-profile.service", () => ({
  agentProfileService: { getHeader: vi.fn(), getPerformance: vi.fn(), getMonthly: vi.fn(), getBiggestDeals: vi.fn() },
}));
vi.mock("./agent-profile.activity.service", () => ({
  agentProfileActivityService: { getWeek: vi.fn(), getTraining: vi.fn(), getPayouts: vi.fn() },
}));

import { agentProfileController } from "./agent-profile.controller";
import { agentProfileService } from "./agent-profile.service";
import { agentProfileActivityService } from "./agent-profile.activity.service";

function req(query: Record<string, unknown> = {}, params: Record<string, unknown> = { userId: " u1 " }) {
  return {
    query,
    params,
    body: {},
    orgId: "o1",
    branchId: "b1",
    orgRole: "branch_manager",
    orgRoles: ["branch_manager"],
    user: { authType: "password", userId: "viewer" },
  } as never;
}

function mockRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const scopeMatcher = expect.objectContaining({ orgId: "o1", branchId: "b1", orgRole: "branch_manager" });

beforeEach(() => vi.clearAllMocks());

describe("agentProfileController", () => {
  it("getHeader passes the trimmed id and wraps the data in the success envelope", async () => {
    const data = { user: { id: "u1" } };
    vi.mocked(agentProfileService.getHeader).mockResolvedValue(data as never);
    const res = mockRes();

    await agentProfileController.getHeader(req(), res as never, vi.fn());

    expect(agentProfileService.getHeader).toHaveBeenCalledWith(scopeMatcher, "u1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: expect.any(String), data });
  });

  it("getPerformance forwards the window", async () => {
    vi.mocked(agentProfileService.getPerformance).mockResolvedValue({} as never);
    await agentProfileController.getPerformance(req({ from: "2026-10-01", to: "2026-10-20" }), mockRes() as never, vi.fn());
    expect(agentProfileService.getPerformance).toHaveBeenCalledWith(scopeMatcher, "u1", "2026-10-01", "2026-10-20");
  });

  it("getMonthly converts the year string to a number, and leaves it undefined when absent", async () => {
    vi.mocked(agentProfileService.getMonthly).mockResolvedValue({} as never);
    await agentProfileController.getMonthly(req({ year: "2025" }), mockRes() as never, vi.fn());
    expect(agentProfileService.getMonthly).toHaveBeenLastCalledWith(scopeMatcher, "u1", 2025);
    await agentProfileController.getMonthly(req({}), mockRes() as never, vi.fn());
    expect(agentProfileService.getMonthly).toHaveBeenLastCalledWith(scopeMatcher, "u1", undefined);
  });

  it("getBiggestDeals converts the limit string to a number", async () => {
    vi.mocked(agentProfileService.getBiggestDeals).mockResolvedValue({ rows: [] } as never);
    await agentProfileController.getBiggestDeals(req({ limit: "10" }), mockRes() as never, vi.fn());
    expect(agentProfileService.getBiggestDeals).toHaveBeenLastCalledWith(scopeMatcher, "u1", 10);
    await agentProfileController.getBiggestDeals(req({}), mockRes() as never, vi.fn());
    expect(agentProfileService.getBiggestDeals).toHaveBeenLastCalledWith(scopeMatcher, "u1", undefined);
  });

  it("getWeek, getTraining and getPayouts go to the activity service", async () => {
    vi.mocked(agentProfileActivityService.getWeek).mockResolvedValue({} as never);
    vi.mocked(agentProfileActivityService.getTraining).mockResolvedValue({} as never);
    vi.mocked(agentProfileActivityService.getPayouts).mockResolvedValue({} as never);

    await agentProfileController.getWeek(req({ start: "2026-10-19" }), mockRes() as never, vi.fn());
    await agentProfileController.getTraining(req(), mockRes() as never, vi.fn());
    await agentProfileController.getPayouts(req(), mockRes() as never, vi.fn());

    expect(agentProfileActivityService.getWeek).toHaveBeenCalledWith(scopeMatcher, "u1", "2026-10-19");
    expect(agentProfileActivityService.getTraining).toHaveBeenCalledWith(scopeMatcher, "u1");
    expect(agentProfileActivityService.getPayouts).toHaveBeenCalledWith(scopeMatcher, "u1");
  });

  it("hands service errors to next", async () => {
    const boom = new Error("nope");
    vi.mocked(agentProfileService.getHeader).mockRejectedValue(boom);
    const next = vi.fn();

    await agentProfileController.getHeader(req(), mockRes() as never, next);
    await new Promise((r) => setImmediate(r));

    expect(next).toHaveBeenCalledWith(boom);
  });
});
