import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./dashboard.repository", () => ({
  dashboardRepository: { getAgentStats: vi.fn(), getMyProfit: vi.fn() },
}));

import { dashboardService } from "./dashboard.service";
import { dashboardRepository } from "./dashboard.repository";

beforeEach(() => vi.clearAllMocks());

describe("dashboardService.getAgentStats - London windows", () => {
  it("passes London-day UTC boundaries (BST) to the repository", async () => {
    vi.mocked(dashboardRepository.getAgentStats).mockResolvedValue({} as never);

    // Fri 16 Oct 2026 13:00 BST
    await dashboardService.getAgentStats("u1", new Date("2026-10-16T12:00:00Z"));

    expect(dashboardRepository.getAgentStats).toHaveBeenCalledWith("u1", {
      todayStart: new Date("2026-10-15T23:00:00Z"),
      weekStart: new Date("2026-10-11T23:00:00Z"),
      monthStart: new Date("2026-09-30T23:00:00Z"),
      monthEnd: new Date("2026-11-01T00:00:00Z"),
    });
  });

  it("uses GMT boundaries in winter", async () => {
    vi.mocked(dashboardRepository.getAgentStats).mockResolvedValue({} as never);

    await dashboardService.getAgentStats("u1", new Date("2026-01-14T09:00:00Z"));

    expect(dashboardRepository.getAgentStats).toHaveBeenCalledWith("u1", {
      todayStart: new Date("2026-01-14T00:00:00Z"),
      weekStart: new Date("2026-01-12T00:00:00Z"),
      monthStart: new Date("2026-01-01T00:00:00Z"),
      monthEnd: new Date("2026-02-01T00:00:00Z"),
    });
  });

  it("returns the repository result untouched", async () => {
    const stats = { todayProfit: 5 };
    vi.mocked(dashboardRepository.getAgentStats).mockResolvedValue(stats as never);
    await expect(dashboardService.getAgentStats("u1")).resolves.toBe(stats);
  });
});
