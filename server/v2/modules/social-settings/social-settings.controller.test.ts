import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./social-settings.service", () => ({
  socialSettingsService: { get: vi.fn(), update: vi.fn(), getChannel: vi.fn() },
}));

import { socialSettingsController } from "./social-settings.controller";
import { socialSettingsService } from "./social-settings.service";

function req(over: Record<string, unknown> = {}) {
  return {
    params: {},
    body: {},
    orgId: "o1",
    branchId: "br1",
    orgRole: "agent",
    orgRoles: ["agent"],
    user: { authType: "password", userId: "u1" },
    ...over,
  } as never;
}

function mockRes() {
  const res: Record<string, ReturnType<typeof vi.fn>> = {};
  res.status = vi.fn().mockReturnValue(res);
  res.json = vi.fn().mockReturnValue(res);
  return res;
}

const VIEW = {
  orgId: "o1",
  defaultViewLink: true,
  defaultPriceBadge: true,
  timeShortcuts: ["09:00"],
  timezone: "Europe/London",
  isDefault: true,
};

beforeEach(() => vi.clearAllMocks());

describe("socialSettingsController", () => {
  it("get passes the caller org and wraps the view in a success envelope", async () => {
    vi.mocked(socialSettingsService.get).mockResolvedValue(VIEW);
    const res = mockRes();

    await socialSettingsController.get(req(), res as never, vi.fn());

    expect(socialSettingsService.get).toHaveBeenCalledWith("o1");
    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json.mock.calls[0][0]).toMatchObject({ success: true, data: VIEW });
  });

  it("update forwards body, org and user id", async () => {
    vi.mocked(socialSettingsService.update).mockResolvedValue({ ...VIEW, isDefault: false });
    const res = mockRes();

    await socialSettingsController.update(req({ body: { defaultViewLink: false } }), res as never, vi.fn());

    expect(socialSettingsService.update).toHaveBeenCalledWith("o1", { defaultViewLink: false }, "u1");
    expect(res.json.mock.calls[0][0]).toMatchObject({ success: true, data: { isDefault: false } });
  });

  it("getChannel returns the channel info", async () => {
    const info = {
      provider: "onlysocials" as const,
      accountId: 1,
      workspaceConfigured: true,
      apiKeyConfigured: false,
      label: "Facebook Page via OnlySocials",
    };
    vi.mocked(socialSettingsService.getChannel).mockReturnValue(info);
    const res = mockRes();

    await socialSettingsController.getChannel(req(), res as never, vi.fn());

    expect(res.json.mock.calls[0][0]).toMatchObject({ success: true, data: info });
  });

  it("forwards service errors to next()", async () => {
    const boom = new Error("boom");
    vi.mocked(socialSettingsService.get).mockRejectedValue(boom);
    const next = vi.fn();

    await socialSettingsController.get(req(), mockRes() as never, next);
    await new Promise((resolve) => setTimeout(resolve, 0));

    expect(next).toHaveBeenCalledWith(boom);
  });
});
