import { describe, expect, it } from "vitest";
import { canSendPrivateReply, isPrivateReplyOpen, type SsComment } from "./comments.types";

const NOW = new Date("2026-08-12T12:00:00Z");

function comment(overrides: Partial<SsComment> = {}): SsComment {
  return {
    id: "sc_1",
    external_id: "17912345678901234",
    state: "pending",
    private_reply_window_expires_at: "2026-08-15T12:00:00Z",
    ...overrides,
  };
}

describe("isPrivateReplyOpen", () => {
  it("is open while the window has time left", () => {
    expect(isPrivateReplyOpen(comment(), NOW)).toBe(true);
  });

  it("is closed once the window has passed", () => {
    expect(isPrivateReplyOpen(comment({ private_reply_window_expires_at: "2026-08-11T12:00:00Z" }), NOW)).toBe(false);
  });

  it("is closed exactly at the expiry instant", () => {
    expect(isPrivateReplyOpen(comment({ private_reply_window_expires_at: NOW.toISOString() }), NOW)).toBe(false);
  });

  // SendSeven sends null when it cannot derive a reliable comment timestamp.
  // Fail closed: a wrong `true` spends the comment's only reply on a 410.
  it("treats a null expiry as closed, not as 'no deadline'", () => {
    expect(isPrivateReplyOpen(comment({ private_reply_window_expires_at: null }), NOW)).toBe(false);
  });

  it("treats an unparseable expiry as closed", () => {
    expect(isPrivateReplyOpen(comment({ private_reply_window_expires_at: "not-a-date" }), NOW)).toBe(false);
  });
});

describe("canSendPrivateReply", () => {
  it("allows a pending comment inside the window", () => {
    expect(canSendPrivateReply(comment(), NOW)).toBe(true);
  });

  // Meta permits exactly one private reply per comment, forever — so an
  // already-answered comment stays closed even with days left on the clock.
  it("refuses a comment an agent already replied to", () => {
    expect(canSendPrivateReply(comment({ state: "replied" }), NOW)).toBe(false);
  });

  it("refuses a comment a SendSeven auto-reply rule already answered", () => {
    expect(canSendPrivateReply(comment({ state: "auto_replied" }), NOW)).toBe(false);
  });

  // Triage clears the queue without spending the reply, so a handled comment
  // is still answerable if the agent changes their mind inside the window.
  it("still allows a handled comment inside the window", () => {
    expect(canSendPrivateReply(comment({ state: "handled" }), NOW)).toBe(true);
  });

  it("refuses once the window has expired", () => {
    expect(canSendPrivateReply(comment({ private_reply_window_expires_at: "2026-08-01T12:00:00Z" }), NOW)).toBe(false);
  });
});
