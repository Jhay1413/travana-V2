import { describe, expect, it } from "vitest";
import {
  buildClientInboxHref,
  buildConversationInboxHref,
  parseInboxDeepLink,
  pickConversationToOpen,
  tabForConversation,
} from "./inbox-links";

const NOW = new Date("2026-03-10T12:00:00Z");

function conv(id: string, over: Partial<Parameters<typeof pickConversationToOpen>[0][number]> = {}) {
  return {
    id,
    status: "open" as const,
    snoozed: false,
    snoozedUntil: null,
    lastActivityAt: "2026-03-10T10:00:00Z",
    ...over,
  };
}

describe("parseInboxDeepLink", () => {
  it("reads conversation and client", () => {
    expect(parseInboxDeepLink("?conversation=a1&client=c9")).toEqual({ conversationId: "a1", clientId: "c9" });
  });
  it("returns nulls when absent or blank", () => {
    expect(parseInboxDeepLink("")).toEqual({ conversationId: null, clientId: null });
    expect(parseInboxDeepLink("?client=%20")).toEqual({ conversationId: null, clientId: null });
  });
});

describe("href builders", () => {
  it("builds and round-trips the client link", () => {
    const href = buildClientInboxHref("a b/1");
    expect(href).toBe("/conversations?client=a%20b%2F1");
    expect(parseInboxDeepLink(href.split("?")[1]).clientId).toBe("a b/1");
  });
  it("builds the conversation link", () => {
    expect(buildConversationInboxHref("x")).toBe("/conversations?conversation=x");
  });
});

describe("tabForConversation", () => {
  it("maps status and snooze to tabs", () => {
    expect(tabForConversation(conv("1"), NOW)).toBe("open");
    expect(tabForConversation(conv("1", { status: "closed" }), NOW)).toBe("done");
    expect(tabForConversation(conv("1", { snoozed: true, snoozedUntil: "2026-03-11T00:00:00Z" }), NOW)).toBe("snoozed");
    expect(tabForConversation(conv("1", { snoozed: true, snoozedUntil: "2027-03-10T00:00:00Z" }), NOW)).toBe("done");
  });
});

describe("pickConversationToOpen", () => {
  it("returns null with no conversations", () => {
    expect(pickConversationToOpen([], NOW)).toBeNull();
  });
  it("prefers the most recent open conversation over a newer closed one", () => {
    const pick = pickConversationToOpen(
      [
        conv("old-open", { lastActivityAt: "2026-03-01T00:00:00Z" }),
        conv("new-closed", { status: "closed", lastActivityAt: "2026-03-10T11:00:00Z" }),
        conv("new-open", { lastActivityAt: "2026-03-05T00:00:00Z" }),
      ],
      NOW,
    );
    expect(pick).toEqual({ id: "new-open", tab: "open" });
  });
  it("falls back to the most recent of any status and reports its tab", () => {
    const pick = pickConversationToOpen(
      [
        conv("a", { status: "closed", lastActivityAt: "2026-02-01T00:00:00Z" }),
        conv("b", { snoozed: true, snoozedUntil: "2026-03-12T00:00:00Z", lastActivityAt: "2026-03-09T00:00:00Z" }),
      ],
      NOW,
    );
    expect(pick).toEqual({ id: "b", tab: "snoozed" });
  });
});
