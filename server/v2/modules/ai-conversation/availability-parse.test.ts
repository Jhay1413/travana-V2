import { describe, it, expect, vi, beforeEach } from "vitest";

// parseAvailabilityTime is the one place a MODEL-supplied value becomes a real
// due date on a real task, and the customer is then told "we'll call you then".
// A wrong year or a stale boundary phrase used to land unchecked, producing a
// task that was overdue the moment it was created and a promise about a time
// that had already gone. These cover the sanity bounds that reject it.

const create = vi.fn();

vi.mock("../../utils/ai-model", () => ({
  CHAT_MODEL: "test-chat-model",
  UTILITY_MODEL: "test-utility-model",
  getOpenAI: () => ({ chat: { completions: { create } } }),
}));

vi.mock("../usage/usage.service", () => ({
  usageService: { recordAiUsage: vi.fn() },
}));

import { parseAvailabilityTime } from "./ai-conversation.brain";
import { formatUkLocal } from "../../utils/uk-time";

function answers(ukLocal: string | null) {
  create.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify({ uk_local: ukLocal }) } }],
    usage: { prompt_tokens: 1, completion_tokens: 1, total_tokens: 2 },
  });
}

// "YYYY-MM-DD HH:mm" in UK local terms, `days` from now.
function ukLocalIn(days: number): string {
  return formatUkLocal(new Date(Date.now() + days * 24 * 60 * 60 * 1000));
}

describe("parseAvailabilityTime — sanity bounds on the model's answer", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("accepts a plausible near-future time", async () => {
    answers(ukLocalIn(1));
    await expect(parseAvailabilityTime("tomorrow at 2")).resolves.toBeInstanceOf(Date);
  });

  it("rejects a time in the past (a wrong year or a wrong day)", async () => {
    answers("2020-05-01 14:00");
    await expect(parseAvailabilityTime("Friday at 2")).resolves.toBeNull();
  });

  it("rejects yesterday, so the task is never born overdue", async () => {
    answers(ukLocalIn(-1));
    await expect(parseAvailabilityTime("yesterday afternoon")).resolves.toBeNull();
  });

  it("rejects an absurdly distant date — a callback is days away, not years", async () => {
    answers(ukLocalIn(400));
    await expect(parseAvailabilityTime("whenever")).resolves.toBeNull();
  });

  it("returns null when the model itself finds no time", async () => {
    answers(null);
    await expect(parseAvailabilityTime("hmm not sure")).resolves.toBeNull();
  });

  it("returns null rather than throwing when the call fails", async () => {
    create.mockRejectedValue(new Error("openai down"));
    await expect(parseAvailabilityTime("2pm tomorrow")).resolves.toBeNull();
  });

  it("returns null on unparseable JSON", async () => {
    create.mockResolvedValue({ choices: [{ message: { content: "not json" } }] });
    await expect(parseAvailabilityTime("2pm tomorrow")).resolves.toBeNull();
  });
});
