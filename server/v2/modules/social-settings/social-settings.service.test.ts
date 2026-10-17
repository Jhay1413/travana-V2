import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./social-settings.repository", () => ({
  socialSettingsRepository: { findByOrg: vi.fn(), upsert: vi.fn() },
}));

import { socialSettingsService } from "./social-settings.service";
import { socialSettingsRepository } from "./social-settings.repository";
import { AppError } from "../../utils/error-handler";

const ROW = {
  orgId: "o1",
  defaultViewLink: false,
  defaultPriceBadge: true,
  timeShortcuts: ["10:00"],
  timezone: "Europe/Paris",
  updatedBy: "u1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

beforeEach(() => vi.clearAllMocks());

describe("socialSettingsService.get", () => {
  it("returns the built-in defaults with isDefault true when no row exists", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(null);

    expect(await socialSettingsService.get("o1")).toEqual({
      orgId: "o1",
      defaultViewLink: true,
      defaultPriceBadge: true,
      timeShortcuts: ["09:00", "12:30", "19:00"],
      timezone: "Europe/London",
      isDefault: true,
    });
  });

  it("returns the stored row with isDefault false", async () => {
    vi.mocked(socialSettingsRepository.findByOrg).mockResolvedValue(ROW);

    expect(await socialSettingsService.get("o1")).toEqual({
      orgId: "o1",
      defaultViewLink: false,
      defaultPriceBadge: true,
      timeShortcuts: ["10:00"],
      timezone: "Europe/Paris",
      isDefault: false,
    });
  });
});

describe("socialSettingsService.update", () => {
  it("dedupes and sorts time shortcuts before upserting", async () => {
    vi.mocked(socialSettingsRepository.upsert).mockResolvedValue({ ...ROW, timeShortcuts: ["09:00", "18:30"] });

    const view = await socialSettingsService.update("o1", { timeShortcuts: ["18:30", "09:00", "18:30"] }, "u1");

    expect(socialSettingsRepository.upsert).toHaveBeenCalledWith("o1", { timeShortcuts: ["09:00", "18:30"] }, "u1");
    expect(view.timeShortcuts).toEqual(["09:00", "18:30"]);
    expect(view.isDefault).toBe(false);
  });

  it("rejects an unknown time zone with a 400 and does not write", async () => {
    const err = await socialSettingsService.update("o1", { timezone: "Mars/Olympus" }, "u1").catch((e: unknown) => e);

    expect(err).toBeInstanceOf(AppError);
    expect((err as AppError).statusCode).toBe(400);
    expect((err as AppError).message).toBe("Unknown time zone");
    expect(socialSettingsRepository.upsert).not.toHaveBeenCalled();
  });

  it("accepts a valid time zone", async () => {
    vi.mocked(socialSettingsRepository.upsert).mockResolvedValue(ROW);

    await socialSettingsService.update("o1", { timezone: "Europe/Paris" }, null);

    expect(socialSettingsRepository.upsert).toHaveBeenCalledWith("o1", { timezone: "Europe/Paris" }, null);
  });
});

describe("socialSettingsService.update hardening", () => {
  it("forwards only the four allowed keys", async () => {
    vi.mocked(socialSettingsRepository.upsert).mockResolvedValue(ROW);

    await socialSettingsService.update("o1", { defaultViewLink: true, orgId: "other", createdAt: "x" } as never, "u1");

    const data = vi.mocked(socialSettingsRepository.upsert).mock.calls[0][1];
    expect(data).toEqual({ defaultViewLink: true });
    expect(data).not.toHaveProperty("orgId");
    expect(data).not.toHaveProperty("createdAt");
  });

  it("normalises time zone casing", async () => {
    vi.mocked(socialSettingsRepository.upsert).mockResolvedValue(ROW);

    await socialSettingsService.update("o1", { timezone: "europe/london" }, "u1");

    expect(socialSettingsRepository.upsert).toHaveBeenCalledWith("o1", { timezone: "Europe/London" }, "u1");
  });
});

describe("socialSettingsService.getChannel", () => {
  const saved = { ws: process.env.ONLY_SOCIALS_WORKSPACE, key: process.env.ONLYSOCIAL_API_KEY };
  afterEach(() => {
    if (saved.ws === undefined) delete process.env.ONLY_SOCIALS_WORKSPACE;
    else process.env.ONLY_SOCIALS_WORKSPACE = saved.ws;
    if (saved.key === undefined) delete process.env.ONLYSOCIAL_API_KEY;
    else process.env.ONLYSOCIAL_API_KEY = saved.key;
  });

  it("reports configured flags and never returns the key", () => {
    process.env.ONLY_SOCIALS_WORKSPACE = "ws";
    process.env.ONLYSOCIAL_API_KEY = "secret-key";

    const info = socialSettingsService.getChannel();

    expect(info).toEqual({
      provider: "onlysocials",
      accountId: 81085,
      workspaceConfigured: true,
      apiKeyConfigured: true,
      label: "Facebook Page via OnlySocials",
    });
    expect(JSON.stringify(info)).not.toContain("secret-key");
  });

  it("reports false flags when the env vars are missing", () => {
    delete process.env.ONLY_SOCIALS_WORKSPACE;
    delete process.env.ONLYSOCIAL_API_KEY;

    const info = socialSettingsService.getChannel();

    expect(info.workspaceConfigured).toBe(false);
    expect(info.apiKeyConfigured).toBe(false);
  });
});
