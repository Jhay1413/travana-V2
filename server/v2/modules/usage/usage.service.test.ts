import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("./usage.repository", () => ({
  usageRepository: {
    insertEvent: vi.fn(),
    incrementAiMonthly: vi.fn(),
    consumeSendsevenMessage: vi.fn(),
    getAiMonthly: vi.fn(),
    getSendsevenMonthly: vi.fn(),
    getLimits: vi.fn(),
    upsertLimits: vi.fn(),
    getLatestPricing: vi.fn(),
    getOrgHistory: vi.fn(),
    getUsageOverview: vi.fn(),
    listLatestPricingPerModel: vi.fn(),
    insertPricing: vi.fn(),
  },
}));

vi.mock("../platform-admin/platform-admin-credits.repository", () => ({
  startOfMonthUtc: vi.fn(() => "2026-07-01"),
}));

import { usageService, computeCostMicros } from "./usage.service";
import { usageRepository } from "./usage.repository";
import { startOfMonthUtc } from "../platform-admin/platform-admin-credits.repository";

const PERIOD = "2026-07-01";

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(startOfMonthUtc).mockReturnValue(PERIOD);
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ─── computeCostMicros ──────────────────────────────────────────────────────

describe("computeCostMicros", () => {
  const gpt41Pricing = {
    id: "p1",
    model: "gpt-4.1",
    inputMicrosPerMtok: 2_000_000,
    cachedInputMicrosPerMtok: 500_000,
    outputMicrosPerMtok: 8_000_000,
    effectiveFrom: new Date("2026-01-01"),
  } as never;

  it("computes exact cost for a prompt/cached/completion mix", () => {
    // uncached = 1000 - 300 = 700; 700*2 + 300*0.5 + 500*8 = 1400 + 150 + 4000 = 5550
    const cost = computeCostMicros(gpt41Pricing, {
      promptTokens: 1000,
      cachedTokens: 300,
      completionTokens: 500,
    });

    expect(cost).toBe(5550);
  });

  it("clamps cachedTokens to promptTokens when cachedTokens exceeds promptTokens", () => {
    // cachedTokens (1500) clamped to promptTokens (1000) -> uncached = 0
    // cost = 0 + 1000*0.5 + 0 = 500
    const cost = computeCostMicros(gpt41Pricing, {
      promptTokens: 1000,
      cachedTokens: 1500,
      completionTokens: 0,
    });

    expect(cost).toBe(500);
  });

  it("returns 0 for zero usage", () => {
    const cost = computeCostMicros(gpt41Pricing, {
      promptTokens: 0,
      cachedTokens: 0,
      completionTokens: 0,
    });

    expect(cost).toBe(0);
  });

  it("returns 0 when pricing is null", () => {
    const cost = computeCostMicros(null, {
      promptTokens: 1000,
      cachedTokens: 0,
      completionTokens: 500,
    });

    expect(cost).toBe(0);
  });

  it("rounds to the nearest integer micro (half rounds up)", () => {
    const pricing = {
      ...gpt41Pricing,
      inputMicrosPerMtok: 1_500_000,
      cachedInputMicrosPerMtok: 0,
      outputMicrosPerMtok: 0,
    } as never;

    // 1 uncached prompt token * 1_500_000 / 1_000_000 = 1.5 -> rounds to 2
    const cost = computeCostMicros(pricing, {
      promptTokens: 1,
      cachedTokens: 0,
      completionTokens: 0,
    });

    expect(cost).toBe(2);
  });

  it("never returns a negative cost even with a fully-cached, zero-rate scenario", () => {
    const zeroPricing = {
      ...gpt41Pricing,
      inputMicrosPerMtok: 0,
      cachedInputMicrosPerMtok: 0,
      outputMicrosPerMtok: 0,
    } as never;

    const cost = computeCostMicros(zeroPricing, {
      promptTokens: 500,
      cachedTokens: 500,
      completionTokens: 0,
    });

    expect(cost).toBe(0);
    expect(cost).toBeGreaterThanOrEqual(0);
  });
});

// ─── recordAiUsage ──────────────────────────────────────────────────────────

describe("recordAiUsage", () => {
  const pricing = {
    id: "p1",
    model: "gpt-4.1",
    inputMicrosPerMtok: 2_000_000,
    cachedInputMicrosPerMtok: 500_000,
    outputMicrosPerMtok: 8_000_000,
    effectiveFrom: new Date("2026-01-01"),
  } as never;

  it("derives totalTokens from prompt + completion when absent", async () => {
    vi.mocked(usageRepository.getLatestPricing).mockResolvedValue(pricing);

    await usageService.recordAiUsage({
      orgId: "org1",
      feature: "staff_chat",
      model: "gpt-4.1",
      usage: { promptTokens: 100, completionTokens: 50 },
    });

    expect(usageRepository.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({ totalTokens: 150, promptTokens: 100, completionTokens: 50 }),
    );
    expect(usageRepository.incrementAiMonthly).toHaveBeenCalledWith(
      "org1",
      PERIOD,
      expect.objectContaining({ totalTokens: 150 }),
    );
  });

  it("inserts the event and increments the monthly aggregate with matching numbers", async () => {
    vi.mocked(usageRepository.getLatestPricing).mockResolvedValue(pricing);

    await usageService.recordAiUsage({
      orgId: "org1",
      feature: "staff_chat",
      model: "gpt-4.1",
      usage: { promptTokens: 1000, completionTokens: 500, cachedTokens: 300, totalTokens: 1500 },
    });

    // 700*2 + 300*0.5 + 500*8 = 5550
    expect(usageRepository.insertEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: "org1",
        model: "gpt-4.1",
        promptTokens: 1000,
        completionTokens: 500,
        cachedTokens: 300,
        totalTokens: 1500,
        costMicros: 5550,
      }),
    );
    expect(usageRepository.incrementAiMonthly).toHaveBeenCalledWith("org1", PERIOD, {
      promptTokens: 1000,
      completionTokens: 500,
      totalTokens: 1500,
      messageCount: 1,
      costMicros: 5550,
    });
  });

  it("increments message_count by 1 for a chat feature", async () => {
    vi.mocked(usageRepository.getLatestPricing).mockResolvedValue(null);

    await usageService.recordAiUsage({
      orgId: "org1",
      feature: "sendseven_bot",
      model: "gpt-4.1",
      usage: { promptTokens: 10, completionTokens: 5 },
    });

    expect(usageRepository.incrementAiMonthly).toHaveBeenCalledWith(
      "org1",
      PERIOD,
      expect.objectContaining({ messageCount: 1, costMicros: 0 }),
    );
  });

  it("does not increment message_count for feature 'embedding'", async () => {
    vi.mocked(usageRepository.getLatestPricing).mockResolvedValue(null);

    await usageService.recordAiUsage({
      orgId: "org1",
      feature: "embedding",
      model: "text-embedding-3-small",
      usage: { promptTokens: 200, completionTokens: 0 },
    });

    expect(usageRepository.incrementAiMonthly).toHaveBeenCalledWith(
      "org1",
      PERIOD,
      expect.objectContaining({ messageCount: 0 }),
    );
  });

  it("resolves cost 0 when pricing is missing (null/missing pricing handled by caller)", async () => {
    vi.mocked(usageRepository.getLatestPricing).mockResolvedValue(null);

    await usageService.recordAiUsage({
      orgId: "org1",
      feature: "ai_ask",
      model: "unknown-model",
      usage: { promptTokens: 100, completionTokens: 100, cachedTokens: 50 },
    });

    expect(usageRepository.insertEvent).toHaveBeenCalledWith(expect.objectContaining({ costMicros: 0 }));
    expect(usageRepository.incrementAiMonthly).toHaveBeenCalledWith(
      "org1",
      PERIOD,
      expect.objectContaining({ costMicros: 0 }),
    );
  });

  it("is fail-open: does not throw when insertEvent rejects, and logs the error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(usageRepository.getLatestPricing).mockResolvedValue(pricing);
    vi.mocked(usageRepository.insertEvent).mockRejectedValue(new Error("db down"));

    await expect(
      usageService.recordAiUsage({
        orgId: "org1",
        feature: "staff_chat",
        model: "gpt-4.1",
        usage: { promptTokens: 10, completionTokens: 5 },
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
  });

  it("is fail-open: does not throw when incrementAiMonthly rejects, and logs the error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(usageRepository.getLatestPricing).mockResolvedValue(pricing);
    vi.mocked(usageRepository.incrementAiMonthly).mockRejectedValue(new Error("db down"));

    await expect(
      usageService.recordAiUsage({
        orgId: "org1",
        feature: "staff_chat",
        model: "gpt-4.1",
        usage: { promptTokens: 10, completionTokens: 5 },
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
  });

  it("is fail-open: does not throw when getLatestPricing rejects, and logs the error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(usageRepository.getLatestPricing).mockRejectedValue(new Error("db down"));

    await expect(
      usageService.recordAiUsage({
        orgId: "org1",
        feature: "staff_chat",
        model: "gpt-4.1",
        usage: { promptTokens: 10, completionTokens: 5 },
      }),
    ).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
    expect(usageRepository.insertEvent).not.toHaveBeenCalled();
  });
});

// ─── recordSendsevenSend ────────────────────────────────────────────────────

describe("recordSendsevenSend", () => {
  it("consumes with isAi: true for source 'ai'", async () => {
    vi.mocked(usageRepository.consumeSendsevenMessage).mockResolvedValue({ sentCount: 1, aiSentCount: 1 });

    await usageService.recordSendsevenSend({ orgId: "org1", source: "ai" });

    expect(usageRepository.consumeSendsevenMessage).toHaveBeenCalledWith("org1", PERIOD, { isAi: true });
  });

  it("consumes with isAi: false for source 'manual'", async () => {
    vi.mocked(usageRepository.consumeSendsevenMessage).mockResolvedValue({ sentCount: 1, aiSentCount: 0 });

    await usageService.recordSendsevenSend({ orgId: "org1", source: "manual" });

    expect(usageRepository.consumeSendsevenMessage).toHaveBeenCalledWith("org1", PERIOD, { isAi: false });
  });

  it("is fail-open: does not throw when the repository rejects, and logs the error", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    vi.mocked(usageRepository.consumeSendsevenMessage).mockRejectedValue(new Error("db down"));

    await expect(usageService.recordSendsevenSend({ orgId: "org1", source: "ai" })).resolves.toBeUndefined();

    expect(errorSpy).toHaveBeenCalled();
  });
});

// ─── checkAiAllowed / checkSendsevenAllowed ────────────────────────────────

describe("checkAiAllowed", () => {
  it("allows with remaining null when there is no limits row", async () => {
    vi.mocked(usageRepository.getLimits).mockResolvedValue(null);

    const result = await usageService.checkAiAllowed("org1");

    expect(result).toEqual({ allowed: true, remaining: null, warnThresholdCrossed: false });
    expect(usageRepository.getAiMonthly).not.toHaveBeenCalled();
  });

  it("allows with remaining null when aiLimitsEnabled is false", async () => {
    vi.mocked(usageRepository.getLimits).mockResolvedValue({
      aiLimitsEnabled: false,
      sendsevenLimitsEnabled: true,
      monthlyAiTokenLimit: 1000,
      enforcementMode: "enforce",
      warnThresholdPct: 80,
    } as never);

    const result = await usageService.checkAiAllowed("org1");

    expect(result).toEqual({ allowed: true, remaining: null, warnThresholdCrossed: false });
    expect(usageRepository.getAiMonthly).not.toHaveBeenCalled();
  });

  it("null (unlimited) limit is always allowed with remaining null, even in enforce mode", async () => {
    vi.mocked(usageRepository.getLimits).mockResolvedValue({
      aiLimitsEnabled: true,
      monthlyAiTokenLimit: null,
      enforcementMode: "enforce",
      warnThresholdPct: 80,
    } as never);
    vi.mocked(usageRepository.getAiMonthly).mockResolvedValue({ totalTokens: 999_999 } as never);

    const result = await usageService.checkAiAllowed("org1");

    expect(result).toEqual({ allowed: true, remaining: null, warnThresholdCrossed: false });
  });

  describe("monitor mode", () => {
    it("is always allowed, and computes warnThresholdCrossed at the warn threshold", async () => {
      vi.mocked(usageRepository.getLimits).mockResolvedValue({
        aiLimitsEnabled: true,
        monthlyAiTokenLimit: 100,
        enforcementMode: "monitor",
        warnThresholdPct: 80,
      } as never);
      vi.mocked(usageRepository.getAiMonthly).mockResolvedValue({ totalTokens: 80 } as never);

      const result = await usageService.checkAiAllowed("org1");

      expect(result).toEqual({ allowed: true, remaining: 20, warnThresholdCrossed: true });
    });

    it("is not warned just below the warn threshold", async () => {
      vi.mocked(usageRepository.getLimits).mockResolvedValue({
        aiLimitsEnabled: true,
        monthlyAiTokenLimit: 100,
        enforcementMode: "monitor",
        warnThresholdPct: 80,
      } as never);
      vi.mocked(usageRepository.getAiMonthly).mockResolvedValue({ totalTokens: 79 } as never);

      const result = await usageService.checkAiAllowed("org1");

      expect(result).toEqual({ allowed: true, remaining: 21, warnThresholdCrossed: false });
    });

    it("stays allowed even when usage is over the limit", async () => {
      vi.mocked(usageRepository.getLimits).mockResolvedValue({
        aiLimitsEnabled: true,
        monthlyAiTokenLimit: 100,
        enforcementMode: "monitor",
        warnThresholdPct: 80,
      } as never);
      vi.mocked(usageRepository.getAiMonthly).mockResolvedValue({ totalTokens: 500 } as never);

      const result = await usageService.checkAiAllowed("org1");

      expect(result.allowed).toBe(true);
      expect(result.warnThresholdCrossed).toBe(true);
    });
  });

  describe("enforce mode", () => {
    it("blocks when usage is at the limit", async () => {
      vi.mocked(usageRepository.getLimits).mockResolvedValue({
        aiLimitsEnabled: true,
        monthlyAiTokenLimit: 100,
        enforcementMode: "enforce",
        warnThresholdPct: 80,
      } as never);
      vi.mocked(usageRepository.getAiMonthly).mockResolvedValue({ totalTokens: 100 } as never);

      const result = await usageService.checkAiAllowed("org1");

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(0);
    });

    it("blocks when usage is over the limit", async () => {
      vi.mocked(usageRepository.getLimits).mockResolvedValue({
        aiLimitsEnabled: true,
        monthlyAiTokenLimit: 100,
        enforcementMode: "enforce",
        warnThresholdPct: 80,
      } as never);
      vi.mocked(usageRepository.getAiMonthly).mockResolvedValue({ totalTokens: 150 } as never);

      const result = await usageService.checkAiAllowed("org1");

      expect(result.allowed).toBe(false);
      expect(result.remaining).toBe(-50);
    });

    it("allows when usage is under the limit", async () => {
      vi.mocked(usageRepository.getLimits).mockResolvedValue({
        aiLimitsEnabled: true,
        monthlyAiTokenLimit: 100,
        enforcementMode: "enforce",
        warnThresholdPct: 80,
      } as never);
      vi.mocked(usageRepository.getAiMonthly).mockResolvedValue({ totalTokens: 99 } as never);

      const result = await usageService.checkAiAllowed("org1");

      expect(result.allowed).toBe(true);
      expect(result.remaining).toBe(1);
    });
  });

  it("treats a missing monthly aggregate row as zero usage", async () => {
    vi.mocked(usageRepository.getLimits).mockResolvedValue({
      aiLimitsEnabled: true,
      monthlyAiTokenLimit: 100,
      enforcementMode: "enforce",
      warnThresholdPct: 80,
    } as never);
    vi.mocked(usageRepository.getAiMonthly).mockResolvedValue(null);

    const result = await usageService.checkAiAllowed("org1");

    expect(result).toEqual({ allowed: true, remaining: 100, warnThresholdCrossed: false });
  });
});

describe("checkSendsevenAllowed", () => {
  it("allows with remaining null when there is no limits row", async () => {
    vi.mocked(usageRepository.getLimits).mockResolvedValue(null);

    const result = await usageService.checkSendsevenAllowed("org1");

    expect(result).toEqual({ allowed: true, remaining: null, warnThresholdCrossed: false });
    expect(usageRepository.getSendsevenMonthly).not.toHaveBeenCalled();
  });

  it("allows with remaining null when sendsevenLimitsEnabled is false", async () => {
    vi.mocked(usageRepository.getLimits).mockResolvedValue({
      sendsevenLimitsEnabled: false,
      monthlySendsevenMsgLimit: 50,
      enforcementMode: "enforce",
      warnThresholdPct: 80,
    } as never);

    const result = await usageService.checkSendsevenAllowed("org1");

    expect(result).toEqual({ allowed: true, remaining: null, warnThresholdCrossed: false });
    expect(usageRepository.getSendsevenMonthly).not.toHaveBeenCalled();
  });

  it("null (unlimited) limit is always allowed with remaining null", async () => {
    vi.mocked(usageRepository.getLimits).mockResolvedValue({
      sendsevenLimitsEnabled: true,
      monthlySendsevenMsgLimit: null,
      enforcementMode: "enforce",
      warnThresholdPct: 80,
    } as never);
    vi.mocked(usageRepository.getSendsevenMonthly).mockResolvedValue({ sentCount: 999 } as never);

    const result = await usageService.checkSendsevenAllowed("org1");

    expect(result).toEqual({ allowed: true, remaining: null, warnThresholdCrossed: false });
  });

  it("monitor mode is always allowed but reports warnThresholdCrossed", async () => {
    vi.mocked(usageRepository.getLimits).mockResolvedValue({
      sendsevenLimitsEnabled: true,
      monthlySendsevenMsgLimit: 200,
      enforcementMode: "monitor",
      warnThresholdPct: 80,
    } as never);
    vi.mocked(usageRepository.getSendsevenMonthly).mockResolvedValue({ sentCount: 160 } as never);

    const result = await usageService.checkSendsevenAllowed("org1");

    expect(result).toEqual({ allowed: true, remaining: 40, warnThresholdCrossed: true });
  });

  it("enforce mode blocks at or over the limit", async () => {
    vi.mocked(usageRepository.getLimits).mockResolvedValue({
      sendsevenLimitsEnabled: true,
      monthlySendsevenMsgLimit: 200,
      enforcementMode: "enforce",
      warnThresholdPct: 80,
    } as never);
    vi.mocked(usageRepository.getSendsevenMonthly).mockResolvedValue({ sentCount: 200 } as never);

    const result = await usageService.checkSendsevenAllowed("org1");

    expect(result.allowed).toBe(false);
  });

  it("enforce mode allows under the limit", async () => {
    vi.mocked(usageRepository.getLimits).mockResolvedValue({
      sendsevenLimitsEnabled: true,
      monthlySendsevenMsgLimit: 200,
      enforcementMode: "enforce",
      warnThresholdPct: 80,
    } as never);
    vi.mocked(usageRepository.getSendsevenMonthly).mockResolvedValue({ sentCount: 199 } as never);

    const result = await usageService.checkSendsevenAllowed("org1");

    expect(result.allowed).toBe(true);
  });
});

// ─── Period boundary (calendar-month UTC) ──────────────────────────────────

describe("period boundary attribution", () => {
  it("passes the mocked calendar-month UTC periodStart to incrementAiMonthly on recordAiUsage", async () => {
    vi.mocked(startOfMonthUtc).mockReturnValue("2026-03-01");
    vi.mocked(usageRepository.getLatestPricing).mockResolvedValue(null);

    await usageService.recordAiUsage({
      orgId: "org1",
      feature: "staff_chat",
      model: "gpt-4.1",
      usage: { promptTokens: 10, completionTokens: 5 },
    });

    expect(usageRepository.incrementAiMonthly).toHaveBeenCalledWith("org1", "2026-03-01", expect.anything());
  });

  it("passes the mocked calendar-month UTC periodStart to consumeSendsevenMessage on recordSendsevenSend", async () => {
    vi.mocked(startOfMonthUtc).mockReturnValue("2026-12-01");
    vi.mocked(usageRepository.consumeSendsevenMessage).mockResolvedValue({ sentCount: 1, aiSentCount: 0 });

    await usageService.recordSendsevenSend({ orgId: "org1", source: "manual" });

    expect(usageRepository.consumeSendsevenMessage).toHaveBeenCalledWith("org1", "2026-12-01", { isAi: false });
  });

  it("passes the mocked calendar-month UTC periodStart to getAiMonthly on checkAiAllowed", async () => {
    vi.mocked(startOfMonthUtc).mockReturnValue("2027-01-01");
    vi.mocked(usageRepository.getLimits).mockResolvedValue({
      aiLimitsEnabled: true,
      monthlyAiTokenLimit: 100,
      enforcementMode: "monitor",
      warnThresholdPct: 80,
    } as never);
    vi.mocked(usageRepository.getAiMonthly).mockResolvedValue(null);

    await usageService.checkAiAllowed("org1");

    expect(usageRepository.getAiMonthly).toHaveBeenCalledWith("org1", "2027-01-01");
  });

  it("passes the mocked calendar-month UTC periodStart to getSendsevenMonthly on checkSendsevenAllowed", async () => {
    vi.mocked(startOfMonthUtc).mockReturnValue("2027-02-01");
    vi.mocked(usageRepository.getLimits).mockResolvedValue({
      sendsevenLimitsEnabled: true,
      monthlySendsevenMsgLimit: 100,
      enforcementMode: "monitor",
      warnThresholdPct: 80,
    } as never);
    vi.mocked(usageRepository.getSendsevenMonthly).mockResolvedValue(null);

    await usageService.checkSendsevenAllowed("org1");

    expect(usageRepository.getSendsevenMonthly).toHaveBeenCalledWith("org1", "2027-02-01");
  });
});

// ─── Platform-admin surface: getLimits / upsertLimits / getUsageOverview / model pricing ──

describe("getLimits / upsertLimits", () => {
  it("getLimits forwards to the repository", async () => {
    vi.mocked(usageRepository.getLimits).mockResolvedValue({ orgId: "org1" } as never);

    const result = await usageService.getLimits("org1");

    expect(usageRepository.getLimits).toHaveBeenCalledWith("org1");
    expect(result).toEqual({ orgId: "org1" });
  });

  it("upsertLimits forwards the patch to the repository", async () => {
    vi.mocked(usageRepository.upsertLimits).mockResolvedValue({ orgId: "org1", monthlyAiTokenLimit: 1000 } as never);

    const result = await usageService.upsertLimits("org1", { monthlyAiTokenLimit: 1000 });

    expect(usageRepository.upsertLimits).toHaveBeenCalledWith("org1", { monthlyAiTokenLimit: 1000 });
    expect(result).toEqual({ orgId: "org1", monthlyAiTokenLimit: 1000 });
  });
});

describe("getUsageOverview", () => {
  it("sorts rows by costMicros descending", async () => {
    vi.mocked(usageRepository.getUsageOverview).mockResolvedValue([
      { orgId: "a", costMicros: 100 },
      { orgId: "b", costMicros: 500 },
      { orgId: "c", costMicros: 250 },
    ] as never);

    const rows = await usageService.getUsageOverview("2026-07-01");

    expect(usageRepository.getUsageOverview).toHaveBeenCalledWith("2026-07-01");
    expect(rows.map((r) => r.orgId)).toEqual(["b", "c", "a"]);
  });

  it("returns an empty array unchanged", async () => {
    vi.mocked(usageRepository.getUsageOverview).mockResolvedValue([]);

    const rows = await usageService.getUsageOverview("2026-07-01");

    expect(rows).toEqual([]);
  });
});

describe("model pricing", () => {
  it("listModelPricing forwards to the repository", async () => {
    vi.mocked(usageRepository.listLatestPricingPerModel).mockResolvedValue([{ model: "gpt-4.1" }] as never);

    const rows = await usageService.listModelPricing();

    expect(rows).toEqual([{ model: "gpt-4.1" }]);
  });

  it("createModelPricingVersion inserts a new row without touching old ones", async () => {
    vi.mocked(usageRepository.insertPricing).mockResolvedValue({ model: "gpt-4.1", inputMicrosPerMtok: 3 } as never);

    const row = await usageService.createModelPricingVersion({
      model: "gpt-4.1",
      inputMicrosPerMtok: 3,
      cachedInputMicrosPerMtok: 0,
      outputMicrosPerMtok: 8,
    });

    expect(usageRepository.insertPricing).toHaveBeenCalledWith({
      model: "gpt-4.1",
      inputMicrosPerMtok: 3,
      cachedInputMicrosPerMtok: 0,
      outputMicrosPerMtok: 8,
    });
    expect(row).toEqual({ model: "gpt-4.1", inputMicrosPerMtok: 3 });
  });
});
