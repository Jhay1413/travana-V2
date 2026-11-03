import { describe, expect, it } from "vitest";
import type { Conversation } from "../../../types";
import { formatWait, isDoneSnooze, rowStatus, waitMs } from "./row-status";

const now = new Date(2026, 9, 15, 12, 0);
const ago = (ms: number) => new Date(now.getTime() - ms).toISOString();

function conv(over: Partial<Conversation> = {}): Conversation {
  return {
    id: "1",
    channel: "email",
    status: "open",
    contact: {
      id: "c",
      displayName: "A",
      firstName: "A",
      lastName: "",
      languages: [],
      handle: "",
      handleLabel: "",
      customFields: [],
    },
    preview: "",
    lastActivityAt: ago(4 * 60_000),
    unread: true,
    needsReply: true,
    snoozed: false,
    messages: [{ id: "m", direction: "inbound", body: "", sentAt: ago(4 * 60_000) }],
    ...over,
  };
}

describe("formatWait", () => {
  it("formats minutes, hours, days", () => {
    expect(formatWait(4 * 60_000)).toBe("4m");
    expect(formatWait(3_600_000)).toBe("1h");
    expect(formatWait(43 * 3_600_000)).toBe("1d 19h");
    expect(formatWait(48 * 3_600_000)).toBe("2d");
  });
});

describe("waitMs", () => {
  it("is null when the last message is outbound", () => {
    expect(waitMs(conv(), now, "outbound")).toBeNull();
  });
  it("still waits once the thread has been seen (unread cleared)", () => {
    expect(waitMs(conv({ unread: false, messages: [{ id: "m", direction: "inbound", body: "", sentAt: ago(4 * 60_000) }] }), now)).toBe(4 * 60_000);
  });
  it("measures since the last inbound message", () => {
    const c = conv({
      lastActivityAt: ago(60_000),
      messages: [
        { id: "m1", direction: "inbound", body: "", sentAt: ago(10 * 60_000) },
        { id: "n", direction: "outbound", body: "", sentAt: ago(60_000), isNote: true },
      ],
    });
    expect(waitMs(c, now)).toBe(10 * 60_000);
  });
  it("falls back to lastActivityAt when the inbound time is unknown", () => {
    expect(waitMs(conv({ messages: [] }), now)).toBe(4 * 60_000);
  });
  it("is null with no messages and no provider flag", () => {
    expect(waitMs(conv({ messages: [], needsReply: false }), now)).toBeNull();
  });
});

describe("rowStatus", () => {
  it("needs reply", () => {
    expect(rowStatus(conv(), now)).toEqual({ kind: "needs_reply", label: "Needs reply · 4m" });
  });
  it("overdue after 24h", () => {
    expect(rowStatus(conv({ lastActivityAt: ago(43 * 3_600_000), messages: [{ id: "m", direction: "inbound", body: "", sentAt: ago(43 * 3_600_000) }] }), now)).toEqual({
      kind: "overdue",
      label: "Overdue · 1d 19h",
    });
  });
  it("seen but unanswered stays Needs reply", () => {
    const c = conv({ unread: false, messages: [{ id: "m", direction: "inbound", body: "", sentAt: ago(4 * 60_000) }] });
    expect(rowStatus(c, now)).toEqual({ kind: "needs_reply", label: "Needs reply · 4m" });
  });
  it("an internal note after the customer message stays Needs reply", () => {
    const c = conv({
      unread: false,
      lastActivityAt: ago(60_000),
      messages: [
        { id: "m1", direction: "inbound", body: "", sentAt: ago(4 * 60_000) },
        { id: "n", direction: "outbound", body: "note", sentAt: ago(60_000), isNote: true },
      ],
    });
    expect(rowStatus(c, now)).toEqual({ kind: "needs_reply", label: "Needs reply · 4m" });
  });
  it("our reply flips it to Waiting", () => {
    const c = conv({
      unread: false,
      lastActivityAt: ago(60_000),
      messages: [
        { id: "m1", direction: "inbound", body: "", sentAt: ago(4 * 60_000) },
        { id: "m2", direction: "outbound", body: "", sentAt: ago(60_000) },
      ],
    });
    expect(rowStatus(c, now)).toEqual({ kind: "waiting", label: "Waiting 1m" });
  });
  it("no messages falls back to the provider flag", () => {
    expect(rowStatus(conv({ messages: [], needsReply: true }), now).kind).toBe("needs_reply");
    expect(rowStatus(conv({ messages: [], needsReply: false }), now).kind).toBe("waiting");
  });
  it("only notes falls back to the provider flag", () => {
    const notes = [{ id: "n", direction: "outbound" as const, body: "", sentAt: ago(0), isNote: true }];
    expect(rowStatus(conv({ messages: notes, needsReply: true }), now).kind).toBe("needs_reply");
    expect(rowStatus(conv({ messages: notes, needsReply: false }), now).kind).toBe("waiting");
  });
  it("waiting when we replied last", () => {
    const c = conv({
      unread: false,
      needsReply: false,
      lastActivityAt: ago(3_600_000),
      messages: [{ id: "m", direction: "outbound", body: "", sentAt: ago(3_600_000) }],
    });
    expect(rowStatus(c, now)).toEqual({ kind: "waiting", label: "Waiting 1h" });
  });
  it("snoozed shows return time", () => {
    const c = conv({ snoozed: true, snoozedUntil: new Date(2026, 9, 16, 9, 0).toISOString() });
    expect(rowStatus(c, now)).toEqual({ kind: "snoozed", label: "Back tomorrow 09:00" });
  });
  it("snoozed without a return time is still snoozed", () => {
    expect(rowStatus(conv({ snoozed: true, snoozedUntil: null }), now)).toEqual({ kind: "snoozed", label: "Snoozed" });
  });
  it("lapsed snooze reads 'Snooze ended' unless the client is awaiting a reply", () => {
    const past = new Date(now.getTime() - 3 * 86_400_000).toISOString();
    const answered = conv({ snoozed: false, unread: false, snoozedUntil: past, messages: [{ id: "m", direction: "outbound", body: "", sentAt: ago(0) }] });
    expect(rowStatus(answered, now)).toEqual({ kind: "snoozed", label: "Snooze ended" });
    const unreadLapsed = conv({
      snoozed: false,
      unread: true,
      snoozedUntil: past,
      lastActivityAt: ago(240_000),
      messages: [{ id: "m", direction: "inbound", body: "", sentAt: ago(240_000) }],
    });
    expect(rowStatus(unreadLapsed, now).kind).toBe("needs_reply");
  });
  it("done when closed or far snooze", () => {
    expect(rowStatus(conv({ status: "closed" }), now).label).toBe("Done");
    const far = new Date(now.getTime() + 400 * 86_400_000).toISOString();
    expect(rowStatus(conv({ snoozed: true, snoozedUntil: far }), now).kind).toBe("done");
  });
});

describe("isDoneSnooze", () => {
  it("needs 300+ days ahead", () => {
    expect(isDoneSnooze(undefined, now)).toBe(false);
    expect(isDoneSnooze(new Date(now.getTime() + 299 * 86_400_000).toISOString(), now)).toBe(false);
    expect(isDoneSnooze(new Date(now.getTime() + 300 * 86_400_000).toISOString(), now)).toBe(true);
  });
});
