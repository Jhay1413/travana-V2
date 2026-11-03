import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./organization-overview.service", () => ({
  organizationOverviewService: { getCompare: vi.fn(), getProfitSources: vi.fn() },
}));

import { organizationOverviewController } from "./organization-overview.controller";
import { organizationOverviewService } from "./organization-overview.service";

function req(query: Record<string, unknown>) {
  return {
    query,
    params: {},
    body: {},
    orgId: "o1",
    branchId: null,
    orgRole: "org_admin",
    orgRoles: ["org_admin"],
    user: { authType: "password", userId: "u1" },
  } as never;
}

function mockRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

beforeEach(() => vi.clearAllMocks());

describe("organizationOverviewController", () => {
  it("getCompare forwards period, against and branch and wraps the result", async () => {
    const data = { period: "month" };
    vi.mocked(organizationOverviewService.getCompare).mockResolvedValue(data as never);
    const res = mockRes();

    await organizationOverviewController.getCompare(
      req({ period: "month", against: "year", branchId: "b1" }),
      res as never,
      vi.fn(),
    );

    expect(organizationOverviewService.getCompare).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "o1" }),
      "month",
      "year",
      "b1",
    );
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({ success: true, data });
  });

  it("getProfitSources forwards the optional branch", async () => {
    const data = { month: "2026-10", rows: [], totals: { profit: 0, bookings: 0 } };
    vi.mocked(organizationOverviewService.getProfitSources).mockResolvedValue(data);
    const res = mockRes();

    await organizationOverviewController.getProfitSources(req({}), res as never, vi.fn());

    expect(organizationOverviewService.getProfitSources).toHaveBeenCalledWith(
      expect.objectContaining({ orgId: "o1" }),
      undefined,
    );
    expect(res.json.mock.calls[0][0]).toMatchObject({ success: true, data });
  });

  it("passes a service rejection to next", async () => {
    const error = new Error("Select an organisation first");
    vi.mocked(organizationOverviewService.getCompare).mockRejectedValue(error);
    const res = mockRes();
    const next = vi.fn();

    await organizationOverviewController.getCompare(req({ period: "week", against: "prev" }), res as never, next);

    await new Promise((resolve) => setImmediate(resolve));
    expect(next).toHaveBeenCalledWith(error);
    expect(res.json).not.toHaveBeenCalled();
  });
});
