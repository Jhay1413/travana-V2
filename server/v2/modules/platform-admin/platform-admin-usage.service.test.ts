import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("./platform-admin.repository", () => ({
  platformAdminRepository: { findOrgByIdWithCounts: vi.fn() },
}));
vi.mock("./platform-admin-usage.repository", () => ({
  periodStartMonthsAgo: vi.fn(),
}));
vi.mock("./platform-admin-audit.repository", () => ({
  platformAdminAuditRepository: { create: vi.fn() },
}));
vi.mock("../usage/usage.service", () => ({
  usageService: {
    getOrgUsageSummary: vi.fn(),
    getOrgUsageHistory: vi.fn(),
    getLimits: vi.fn(),
    upsertLimits: vi.fn(),
    getUsageOverview: vi.fn(),
    listModelPricing: vi.fn(),
    createModelPricingVersion: vi.fn(),
  },
}));

import { platformAdminUsageService } from "./platform-admin-usage.service";
import { platformAdminRepository } from "./platform-admin.repository";
import { platformAdminAuditRepository } from "./platform-admin-audit.repository";
import { periodStartMonthsAgo } from "./platform-admin-usage.repository";
import { usageService } from "../usage/usage.service";

const ACTOR = { userId: "admin1", ipAddress: null, userAgent: null } as never;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("platformAdminUsageService.getOrgUsage", () => {
  it("throws 404 when the org does not exist", async () => {
    vi.mocked(platformAdminRepository.findOrgByIdWithCounts).mockResolvedValue(undefined as never);

    await expect(platformAdminUsageService.getOrgUsage("o1")).rejects.toMatchObject({ statusCode: 404 });
    expect(usageService.getOrgUsageSummary).not.toHaveBeenCalled();
  });

  it("delegates to usageService.getOrgUsageSummary when the org exists", async () => {
    vi.mocked(platformAdminRepository.findOrgByIdWithCounts).mockResolvedValue({ id: "o1" } as never);
    vi.mocked(usageService.getOrgUsageSummary).mockResolvedValue({ orgId: "o1" } as never);

    const summary = await platformAdminUsageService.getOrgUsage("o1");

    expect(usageService.getOrgUsageSummary).toHaveBeenCalledWith("o1");
    expect(summary).toEqual({ orgId: "o1" });
  });
});

describe("platformAdminUsageService.getOrgUsageHistory", () => {
  it("throws 404 when the org does not exist", async () => {
    vi.mocked(platformAdminRepository.findOrgByIdWithCounts).mockResolvedValue(undefined as never);

    await expect(platformAdminUsageService.getOrgUsageHistory("o1", 6)).rejects.toMatchObject({ statusCode: 404 });
    expect(usageService.getOrgUsageHistory).not.toHaveBeenCalled();
  });

  it("delegates to usageService.getOrgUsageHistory with the requested months", async () => {
    vi.mocked(platformAdminRepository.findOrgByIdWithCounts).mockResolvedValue({ id: "o1" } as never);
    vi.mocked(usageService.getOrgUsageHistory).mockResolvedValue({ orgId: "o1", ai: [], sendseven: [] } as never);

    await platformAdminUsageService.getOrgUsageHistory("o1", 12);

    expect(usageService.getOrgUsageHistory).toHaveBeenCalledWith("o1", 12);
  });
});

describe("platformAdminUsageService.updateUsageLimits", () => {
  it("throws 404 when the org does not exist", async () => {
    vi.mocked(platformAdminRepository.findOrgByIdWithCounts).mockResolvedValue(undefined as never);

    await expect(
      platformAdminUsageService.updateUsageLimits("o1", { monthlyAiTokenLimit: 1000 }, ACTOR),
    ).rejects.toMatchObject({ statusCode: 404 });
    expect(usageService.upsertLimits).not.toHaveBeenCalled();
  });

  it("upserts the limits and writes an audit entry with before/after", async () => {
    vi.mocked(platformAdminRepository.findOrgByIdWithCounts).mockResolvedValue({ id: "o1" } as never);
    vi.mocked(usageService.getLimits).mockResolvedValue({ monthlyAiTokenLimit: 500 } as never);
    vi.mocked(usageService.upsertLimits).mockResolvedValue({ monthlyAiTokenLimit: 1000 } as never);

    const patch = { monthlyAiTokenLimit: 1000, enforcementMode: "enforce" as const };
    const result = await platformAdminUsageService.updateUsageLimits("o1", patch, ACTOR);

    expect(usageService.upsertLimits).toHaveBeenCalledWith("o1", patch);
    expect(result).toEqual({ monthlyAiTokenLimit: 1000 });
    expect(platformAdminAuditRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        actorUserId: "admin1",
        action: "usage_limits.update",
        targetOrgId: "o1",
        metadata: expect.objectContaining({
          before: { monthlyAiTokenLimit: 500 },
          after: { monthlyAiTokenLimit: 1000 },
        }),
      }),
    );
  });

  it("accepts an explicit null on a nullable limit field (unlimited)", async () => {
    vi.mocked(platformAdminRepository.findOrgByIdWithCounts).mockResolvedValue({ id: "o1" } as never);
    vi.mocked(usageService.getLimits).mockResolvedValue({ monthlyAiTokenLimit: 500 } as never);
    vi.mocked(usageService.upsertLimits).mockResolvedValue({ monthlyAiTokenLimit: null } as never);

    await platformAdminUsageService.updateUsageLimits("o1", { monthlyAiTokenLimit: null }, ACTOR);

    expect(usageService.upsertLimits).toHaveBeenCalledWith("o1", { monthlyAiTokenLimit: null });
  });

  it("does not throw when the audit write fails (mutation already succeeded)", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(platformAdminRepository.findOrgByIdWithCounts).mockResolvedValue({ id: "o1" } as never);
    vi.mocked(usageService.getLimits).mockResolvedValue(null);
    vi.mocked(usageService.upsertLimits).mockResolvedValue({ monthlyAiTokenLimit: 1000 } as never);
    vi.mocked(platformAdminAuditRepository.create).mockRejectedValue(new Error("db down"));

    await expect(
      platformAdminUsageService.updateUsageLimits("o1", { monthlyAiTokenLimit: 1000 }, ACTOR),
    ).resolves.toEqual({ monthlyAiTokenLimit: 1000 });

    expect(errorSpy).toHaveBeenCalled();
  });
});

describe("platformAdminUsageService.getUsageOverview", () => {
  it("resolves the period start via periodStartMonthsAgo and forwards it to usageService", async () => {
    vi.mocked(periodStartMonthsAgo).mockReturnValue("2026-02-01");
    vi.mocked(usageService.getUsageOverview).mockResolvedValue([{ orgId: "o1" }] as never);

    const rows = await platformAdminUsageService.getUsageOverview(6);

    expect(periodStartMonthsAgo).toHaveBeenCalledWith(6);
    expect(usageService.getUsageOverview).toHaveBeenCalledWith("2026-02-01");
    expect(rows).toEqual([{ orgId: "o1" }]);
  });
});

describe("platformAdminUsageService.listModelPricing", () => {
  it("delegates to usageService.listModelPricing", async () => {
    vi.mocked(usageService.listModelPricing).mockResolvedValue([{ model: "gpt-4.1" }] as never);

    const rows = await platformAdminUsageService.listModelPricing();

    expect(rows).toEqual([{ model: "gpt-4.1" }]);
  });
});

describe("platformAdminUsageService.upsertModelPricing", () => {
  it("creates a new pricing version and audits before/after by model", async () => {
    vi.mocked(usageService.listModelPricing).mockResolvedValue([
      { model: "gpt-4.1", inputMicrosPerMtok: 2_000_000 },
      { model: "gpt-4.1-mini", inputMicrosPerMtok: 100_000 },
    ] as never);
    vi.mocked(usageService.createModelPricingVersion).mockResolvedValue({
      model: "gpt-4.1",
      inputMicrosPerMtok: 3_000_000,
    } as never);

    const patch = { inputMicrosPerMtok: 3_000_000, cachedInputMicrosPerMtok: 0, outputMicrosPerMtok: 8_000_000 };
    const result = await platformAdminUsageService.upsertModelPricing("gpt-4.1", patch, ACTOR);

    expect(usageService.createModelPricingVersion).toHaveBeenCalledWith({
      model: "gpt-4.1",
      inputMicrosPerMtok: 3_000_000,
      cachedInputMicrosPerMtok: 0,
      outputMicrosPerMtok: 8_000_000,
    });
    expect(result).toEqual({ model: "gpt-4.1", inputMicrosPerMtok: 3_000_000 });
    expect(platformAdminAuditRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        action: "model_pricing.update",
        metadata: expect.objectContaining({
          model: "gpt-4.1",
          before: { model: "gpt-4.1", inputMicrosPerMtok: 2_000_000 },
          after: { model: "gpt-4.1", inputMicrosPerMtok: 3_000_000 },
        }),
      }),
    );
  });

  it("records before: null when no existing pricing row matches the model", async () => {
    vi.mocked(usageService.listModelPricing).mockResolvedValue([]);
    vi.mocked(usageService.createModelPricingVersion).mockResolvedValue({ model: "new-model" } as never);

    await platformAdminUsageService.upsertModelPricing(
      "new-model",
      { inputMicrosPerMtok: 1, cachedInputMicrosPerMtok: 0, outputMicrosPerMtok: 1 },
      ACTOR,
    );

    expect(platformAdminAuditRepository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        metadata: expect.objectContaining({ before: null }),
      }),
    );
  });
});
