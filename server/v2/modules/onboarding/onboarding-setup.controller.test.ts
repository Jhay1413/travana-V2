import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./onboarding-setup.service", () => ({
  onboardingSetupService: {
    getState: vi.fn(),
    saveBusiness: vi.fn(),
    addShops: vi.fn(),
    setHomeworkerCommission: vi.fn(),
    complete: vi.fn(),
  },
}));

import { onboardingSetupController } from "./onboarding-setup.controller";
import { onboardingSetupService } from "./onboarding-setup.service";

const flush = () => new Promise((resolve) => setImmediate(resolve));

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

function mockReq(body: Record<string, unknown> = {}) {
  return {
    orgId: "orgScope",
    orgRole: "org_admin",
    branchId: null,
    body,
    user: { authType: "password", userId: "owner1" },
    get: () => undefined,
    protocol: "http",
    headers: {},
    socket: {},
  } as never;
}

beforeEach(() => vi.clearAllMocks());

describe("onboardingSetupController", () => {
  it("GET state returns 200 with the state, using the scope org and user", async () => {
    vi.mocked(onboardingSetupService.getState).mockResolvedValue({ status: "pending" } as never);
    const res = mockRes();

    await onboardingSetupController.getState(mockReq(), res as never, vi.fn());
    await flush();

    expect(onboardingSetupService.getState).toHaveBeenCalledWith("orgScope");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ success: true, data: { status: "pending" } }));
  });

  it("ignores an orgId in the body on every mutating endpoint", async () => {
    vi.mocked(onboardingSetupService.saveBusiness).mockResolvedValue({} as never);
    vi.mocked(onboardingSetupService.addShops).mockResolvedValue({ results: [] });
    vi.mocked(onboardingSetupService.setHomeworkerCommission).mockResolvedValue({ homeworkerCommission: 10 });
    vi.mocked(onboardingSetupService.complete).mockResolvedValue({ status: "complete" });

    await onboardingSetupController.saveBusiness(mockReq({ orgId: "evil", businessName: "X" }), mockRes() as never, vi.fn());
    await onboardingSetupController.addShops(mockReq({ orgId: "evil", shops: [] }), mockRes() as never, vi.fn());
    await onboardingSetupController.setHomeworkerCommission(mockReq({ orgId: "evil", percent: 10 }), mockRes() as never, vi.fn());
    await onboardingSetupController.complete(mockReq({ orgId: "evil" }), mockRes() as never, vi.fn());
    await flush();

    expect(vi.mocked(onboardingSetupService.saveBusiness).mock.calls[0][0].orgId).toBe("orgScope");
    expect(vi.mocked(onboardingSetupService.addShops).mock.calls[0][0].orgId).toBe("orgScope");
    expect(onboardingSetupService.setHomeworkerCommission).toHaveBeenCalledWith("orgScope", 10);
    expect(onboardingSetupService.complete).toHaveBeenCalledWith("orgScope");
  });

  it("PUT business, POST shops, PUT commission and POST complete all answer 200", async () => {
    vi.mocked(onboardingSetupService.saveBusiness).mockResolvedValue({} as never);
    vi.mocked(onboardingSetupService.addShops).mockResolvedValue({ results: [] });
    vi.mocked(onboardingSetupService.setHomeworkerCommission).mockResolvedValue({ homeworkerCommission: null });
    vi.mocked(onboardingSetupService.complete).mockResolvedValue({ status: "complete" });
    const resList = [mockRes(), mockRes(), mockRes(), mockRes()];

    await onboardingSetupController.saveBusiness(mockReq(), resList[0] as never, vi.fn());
    await onboardingSetupController.addShops(mockReq({ shops: [] }), resList[1] as never, vi.fn());
    await onboardingSetupController.setHomeworkerCommission(mockReq({ percent: null }), resList[2] as never, vi.fn());
    await onboardingSetupController.complete(mockReq(), resList[3] as never, vi.fn());
    await flush();

    for (const res of resList) expect(res.status).toHaveBeenCalledWith(200);
    expect(resList[1].json).toHaveBeenCalledWith(expect.objectContaining({ data: { results: [] } }));
  });

  it("403s when there is no organisation context", async () => {
    const next = vi.fn();
    await onboardingSetupController.complete({ ...(mockReq() as object), orgId: "" } as never, mockRes() as never, next);
    await flush();
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403 });
    expect(onboardingSetupService.complete).not.toHaveBeenCalled();
  });
});
