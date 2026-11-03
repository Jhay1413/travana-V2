import { describe, expect, it } from "vitest";
import { askText, lastInbound, missingForClient } from "./ask-text";

describe("missingForClient", () => {
  it("lists only the details the client can supply", () => {
    expect(
      missingForClient({ title: "x", destinations: "x", travelDate: "x", travellers: "x" }),
    ).toEqual(["destination", "travel date", "who is travelling"]);
    expect(missingForClient({})).toEqual([]);
  });
});

describe("askText", () => {
  it("drafts a polite question", () => {
    expect(askText("Sarah", ["destination", "travel date", "who is travelling"])).toBe(
      "Hi Sarah, so I can put the options together, could you tell me where you'd like to go, when you'd like to travel and who is travelling? Thanks",
    );
  });
  it("handles a single item", () => {
    expect(askText("Sam", ["destination"])).toContain("could you tell me where you'd like to go?");
  });
});

describe("lastInbound", () => {
  it("returns the newest inbound text whatever the order", () => {
    const msgs = [
      { direction: "inbound", text: "newer", created_at: "2026-01-02T10:00:00Z" },
      { direction: "outbound", text: "reply", created_at: "2026-01-03T10:00:00Z" },
      { direction: "inbound", text: "older", created_at: "2026-01-01T10:00:00Z" },
    ];
    expect(lastInbound(msgs)).toEqual({ text: "newer", at: "2026-01-02T10:00:00Z" });
  });
  it("is null with no inbound text", () => {
    expect(lastInbound([{ direction: "inbound", text: " ", created_at: "2026-01-01T00:00:00Z" }])).toBeNull();
  });
});
