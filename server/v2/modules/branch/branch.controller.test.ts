import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./branch.service", () => ({
  branchService: { list: vi.fn(), getById: vi.fn(), create: vi.fn(), update: vi.fn(), remove: vi.fn() },
}));

import { branchController } from "./branch.controller";
import { branchService } from "./branch.service";

function req(over: Record<string, unknown> = {}) {
  return {
    params: {},
    query: {},
    body: {},
    orgId: "o1",
    branchId: null,
    orgRole: "agent",
    orgRoles: ["agent"],
    user: { authType: "password", userId: "u1" },
    ...over,
  } as never;
}

function mockRes() {
  const res: { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> } = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  res.json.mockReturnValue(res);
  return res;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("branchController.list", () => {
  it("defaults to shop branches", async () => {
    vi.mocked(branchService.list).mockResolvedValue([]);

    await branchController.list(req(), mockRes() as never, vi.fn());

    expect(branchService.list).toHaveBeenCalledWith(expect.objectContaining({ orgId: "o1", orgRole: "agent" }), "shop");
  });

  it("passes type=homeworker through to the service, which enforces the admin rule", async () => {
    vi.mocked(branchService.list).mockResolvedValue([]);

    await branchController.list(req({ query: { type: "homeworker" } }), mockRes() as never, vi.fn());

    expect(branchService.list).toHaveBeenCalledWith(expect.anything(), "homeworker");
  });
});

describe("branchController.getById", () => {
  it("passes the caller scope so the service can apply owner/admin access", async () => {
    vi.mocked(branchService.getById).mockResolvedValue({ id: "hb1" } as never);
    const res = mockRes();

    await branchController.getById(req({ params: { id: "hb1" } }), res as never, vi.fn());

    expect(branchService.getById).toHaveBeenCalledWith("hb1", expect.objectContaining({ orgId: "o1", userId: "u1" }));
    expect(res.status).toHaveBeenCalledWith(200);
  });
});
