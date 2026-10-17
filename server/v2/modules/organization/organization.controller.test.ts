import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./organization.service", () => ({
  organizationService: { update: vi.fn(), getById: vi.fn() },
}));

import { organizationController } from "./organization.controller";
import { organizationService } from "./organization.service";

const flush = () => new Promise((resolve) => setImmediate(resolve));

function mockRes() {
  const res = { status: vi.fn(), json: vi.fn() };
  res.status.mockReturnValue(res);
  return res;
}

beforeEach(() => vi.clearAllMocks());

describe("organizationController.updateMine", () => {
  it("passes only the fields an org admin may change: seatLimit, isActive and unknown columns are dropped", async () => {
    vi.mocked(organizationService.update).mockResolvedValue({ id: "o1" } as never);
    const req = {
      orgId: "o1",
      body: {
        name: "Acme", seatLimit: 9999, isActive: false,
        monthlySmsCreditLimit: 1_000_000, homeworkerCommission: 90, id: "other-org",
      },
    } as never;

    await organizationController.updateMine(req, mockRes() as never, vi.fn());
    await flush();

    expect(organizationService.update).toHaveBeenCalledWith("o1", { name: "Acme" });
  });

  it("403s 'Contact us to change plan' when an org admin sends plan", async () => {
    const next = vi.fn();
    await organizationController.updateMine({ orgId: "o1", body: { plan: "enterprise" } } as never, mockRes() as never, next);
    await flush();
    expect(next.mock.calls[0][0]).toMatchObject({ statusCode: 403, message: "Contact us to change plan" });
    expect(organizationService.update).not.toHaveBeenCalled();
  });

  it("keeps explicit nulls such as logoUrl: null", async () => {
    vi.mocked(organizationService.update).mockResolvedValue({ id: "o1" } as never);
    await organizationController.updateMine({ orgId: "o1", body: { logoUrl: null } } as never, mockRes() as never, vi.fn());
    await flush();
    expect(organizationService.update).toHaveBeenCalledWith("o1", { logoUrl: null });
  });
});
