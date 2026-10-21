import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./departures.service", () => ({
  departuresService: { list: vi.fn(), summary: vi.fn(), setCheck: vi.fn() },
}));

import { departuresController } from "./departures.controller";
import { departuresService } from "./departures.service";

function req(over: { query?: Record<string, unknown>; params?: Record<string, unknown>; body?: unknown } = {}) {
  return {
    query: over.query ?? {},
    params: over.params ?? {},
    body: over.body ?? {},
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

const scopeMatcher = expect.objectContaining({ orgId: "o1", branchId: "b1", orgRole: "branch_manager", userId: "viewer" });

beforeEach(() => vi.clearAllMocks());

describe("departuresController", () => {
  it("list forwards the dates and wraps the rows in the success envelope", async () => {
    const data = { rows: [] };
    vi.mocked(departuresService.list).mockResolvedValue(data as never);
    const res = mockRes();
    await departuresController.list(req({ query: { from: "2026-10-20", to: "2026-10-27" } }), res as never, vi.fn());
    expect(departuresService.list).toHaveBeenCalledWith(scopeMatcher, "2026-10-20", "2026-10-27");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: expect.any(String), data });
  });

  it("list passes undefined dates when none are given", async () => {
    vi.mocked(departuresService.list).mockResolvedValue({ rows: [] } as never);
    await departuresController.list(req(), mockRes() as never, vi.fn());
    expect(departuresService.list).toHaveBeenCalledWith(scopeMatcher, undefined, undefined);
  });

  it("summary converts days to a number, or leaves it undefined", async () => {
    vi.mocked(departuresService.summary).mockResolvedValue({} as never);
    await departuresController.summary(req({ query: { days: "14" } }), mockRes() as never, vi.fn());
    expect(departuresService.summary).toHaveBeenLastCalledWith(scopeMatcher, 14);
    await departuresController.summary(req(), mockRes() as never, vi.fn());
    expect(departuresService.summary).toHaveBeenLastCalledWith(scopeMatcher, undefined);
  });

  it("setCheck passes the booking id, key and value and returns the row", async () => {
    const row = { bookingId: "bk1" };
    vi.mocked(departuresService.setCheck).mockResolvedValue(row as never);
    const res = mockRes();
    await departuresController.setCheck(
      req({ params: { bookingId: "bk1" }, body: { key: "checkIn", value: true } }),
      res as never,
      vi.fn(),
    );
    expect(departuresService.setCheck).toHaveBeenCalledWith(scopeMatcher, "bk1", "checkIn", true);
    expect(res.json).toHaveBeenCalledWith({ success: true, message: expect.any(String), data: row });
  });

  it("hands service errors to next", async () => {
    const boom = new Error("nope");
    vi.mocked(departuresService.list).mockRejectedValue(boom);
    const next = vi.fn();
    await departuresController.list(req(), mockRes() as never, next);
    await new Promise((r) => setImmediate(r));
    expect(next).toHaveBeenCalledWith(boom);
  });
});
