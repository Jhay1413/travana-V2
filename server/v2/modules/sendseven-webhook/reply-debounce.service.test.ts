import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  clearPendingReplies,
  scheduleInboundReply,
  REPLY_DEBOUNCE_MS,
  REPLY_DEBOUNCE_MAX_WAIT_MS,
} from "./reply-debounce.service";
import type { SsWebhookEvent } from "./sendseven-webhook.types";

// People text the way they talk — several short messages in a row. The reply is
// held briefly so the burst gets ONE answer, written with everything they said.

const event = (id: string, text: string): SsWebhookEvent => ({
  id,
  data: { message: { id, conversation_id: "conv-1", direction: "inbound", text } },
});

beforeEach(() => {
  vi.useFakeTimers();
  clearPendingReplies();
});

afterEach(() => {
  clearPendingReplies();
  vi.useRealTimers();
});

describe("scheduleInboundReply", () => {
  it("answers a lone message once the quiet window passes", async () => {
    const run = vi.fn(async () => undefined);

    scheduleInboundReply("org-1", "conv-1", event("m1", "Egypt please"), run);
    expect(run).not.toHaveBeenCalled(); // nothing fires immediately

    await vi.advanceTimersByTimeAsync(REPLY_DEBOUNCE_MS);

    expect(run).toHaveBeenCalledTimes(1);
    expect(vi.mocked(run).mock.calls[0][1].id).toBe("m1");
  });

  it("collapses a burst into ONE reply, to the latest message", async () => {
    const run = vi.fn(async () => undefined);

    scheduleInboundReply("org-1", "conv-1", event("m1", "Egypt for a week, cheap all inclusive"), run);
    await vi.advanceTimersByTimeAsync(1_000);
    scheduleInboundReply("org-1", "conv-1", event("m2", "3 people"), run);
    await vi.advanceTimersByTimeAsync(1_000);
    scheduleInboundReply("org-1", "conv-1", event("m3", "from Newcastle"), run);

    // Still quiet until the window elapses after the LAST message.
    await vi.advanceTimersByTimeAsync(REPLY_DEBOUNCE_MS - 1);
    expect(run).not.toHaveBeenCalled();

    await vi.advanceTimersByTimeAsync(1);
    expect(run).toHaveBeenCalledTimes(1);
    expect(vi.mocked(run).mock.calls[0][1].id).toBe("m3");
  });

  it("still answers someone who keeps typing, at the cap", async () => {
    const run = vi.fn(async () => undefined);

    // A message every 2s for well past the cap — the window would otherwise
    // keep being pushed back forever.
    for (let i = 0; i < 20; i += 1) {
      scheduleInboundReply("org-1", "conv-1", event(`m${i}`, `part ${i}`), run);
      await vi.advanceTimersByTimeAsync(2_000);
    }

    expect(run).toHaveBeenCalled();
    const firedAtOrBeforeCap = vi.mocked(run).mock.calls.length >= 1;
    expect(firedAtOrBeforeCap).toBe(true);
    expect(REPLY_DEBOUNCE_MAX_WAIT_MS).toBeGreaterThan(REPLY_DEBOUNCE_MS);
  });

  it("keeps conversations independent", async () => {
    const run = vi.fn(async () => undefined);

    scheduleInboundReply("org-1", "conv-1", event("a1", "hi"), run);
    scheduleInboundReply("org-1", "conv-2", event("b1", "hello"), run);
    await vi.advanceTimersByTimeAsync(REPLY_DEBOUNCE_MS);

    expect(run).toHaveBeenCalledTimes(2);
    expect(vi.mocked(run).mock.calls.map((c) => c[1].id).sort()).toEqual(["a1", "b1"]);
  });

  it("swallows a failing reply rather than crashing the process", async () => {
    const run = vi.fn(async () => {
      throw new Error("AI service down");
    });

    scheduleInboundReply("org-1", "conv-1", event("m1", "hi"), run);

    // No unhandled rejection — the webhook was acked long ago, nothing awaits this.
    await expect(vi.advanceTimersByTimeAsync(REPLY_DEBOUNCE_MS)).resolves.not.toThrow();
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("frees the conversation once its reply has run, so the next message starts a fresh window", async () => {
    const run = vi.fn(async () => undefined);

    scheduleInboundReply("org-1", "conv-1", event("m1", "hi"), run);
    await vi.advanceTimersByTimeAsync(REPLY_DEBOUNCE_MS);
    scheduleInboundReply("org-1", "conv-1", event("m2", "any deals?"), run);
    await vi.advanceTimersByTimeAsync(REPLY_DEBOUNCE_MS);

    expect(run).toHaveBeenCalledTimes(2);
    expect(vi.mocked(run).mock.calls[1][1].id).toBe("m2");
  });
});
