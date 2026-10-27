import { describe, expect, it } from "vitest";
import type { SsConversation } from "./api/conversations.api";
import { displayHandle, looksLikePhone, toUiConversation } from "./map";

describe("displayHandle", () => {
  it("shows a whatsapp phone", () => {
    expect(displayHandle({ channel: "whatsapp", handle: "+447700900123" })).toBe("+447700900123");
  });
  it("shows an email", () => {
    expect(displayHandle({ channel: "email", handle: "a@b.com" })).toBe("a@b.com");
  });
  it("hides an opaque messenger id", () => {
    expect(displayHandle({ channel: "messenger", handle: "abc-1234" })).toBeNull();
  });
  it("hides an opaque instagram id", () => {
    expect(displayHandle({ channel: "instagram", handle: "ig_user_x" })).toBeNull();
  });
  it("shows a messenger contact with a real phone", () => {
    expect(displayHandle({ channel: "messenger", handle: "+44 7700 900123" })).toBe("+44 7700 900123");
  });
  it("returns null for an empty handle", () => {
    expect(displayHandle({ channel: "whatsapp", handle: "" })).toBeNull();
  });
  it("hides SendSeven's contact uuid even on whatsapp or sms", () => {
    expect(displayHandle({ channel: "whatsapp", handle: "7c9e6679-7425-40de-944b-e07fc1f90ae7" })).toBeNull();
    expect(displayHandle({ channel: "sms", handle: "7c9e6679-7425-40de-944b-e07fc1f90ae7" })).toBeNull();
  });
  it("hides a long numeric platform id", () => {
    expect(displayHandle({ channel: "messenger", handle: "2473811029384756112" })).toBeNull();
  });
});

describe("looksLikePhone", () => {
  it("accepts dialable numbers with 7 to 15 digits", () => {
    expect(looksLikePhone("+44 7700 900123")).toBe(true);
    expect(looksLikePhone("(020) 7946-0958")).toBe(true);
    expect(looksLikePhone("1234567")).toBe(true);
  });
  it("rejects short numbers, letters and over-long ids", () => {
    expect(looksLikePhone("123456")).toBe(false);
    expect(looksLikePhone("abc-1234567")).toBe(false);
    expect(looksLikePhone("1234567890123456")).toBe(false);
    expect(looksLikePhone(null)).toBe(false);
  });
});

describe("toUiConversation needs-reply seed", () => {
  const item = (over: Partial<SsConversation> = {}): SsConversation => ({
    id: "c1",
    tenant_id: "t",
    channel_id: "ch",
    status: "open",
    created_at: "2026-03-10T10:00:00Z",
    needs_reply: true,
    last_message: { text: "hi", direction: "inbound", created_at: "2026-03-10T10:00:00Z" },
    ...over,
  });
  it("carries the raw provider flag alongside unread", () => {
    const c = toUiConversation(item());
    expect(c.needsReply).toBe(true);
    expect(c.unread).toBe(true);
    expect(toUiConversation(item({ needs_reply: false })).needsReply).toBe(false);
  });
  it("does not flag a normal last message as a note", () => {
    expect(toUiConversation(item()).messages[0].isNote).toBeUndefined();
  });
  it("flags internal and system previews as notes", () => {
    const base = { text: "n", direction: "outbound", created_at: "2026-03-10T10:00:00Z" };
    expect(toUiConversation(item({ last_message: { ...base, is_internal: true } })).messages[0].isNote).toBe(true);
    expect(toUiConversation(item({ last_message: { ...base, message_type: "system" } })).messages[0].isNote).toBe(true);
  });
});
