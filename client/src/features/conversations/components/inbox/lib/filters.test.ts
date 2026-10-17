import { describe, expect, it } from "vitest";
import type { Conversation } from "../../../types";
import { channelCounts, countActiveFilters, EMPTY_FILTERS, matchesFilters, serverParamsFor } from "./filters";

const now = new Date(2026, 9, 15, 12, 0);
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

function c(over: Partial<Conversation> = {}): Conversation {
  return {
    id: "1",
    channel: "email",
    status: "open",
    contact: { id: "c", displayName: "A", firstName: "A", lastName: "", languages: [], handle: "", handleLabel: "", customFields: [] },
    preview: "",
    lastActivityAt: ago(1),
    unread: true,
    snoozed: false,
    messages: [{ id: "m", direction: "inbound", body: "", sentAt: ago(1) }],
    ...over,
  };
}

describe("filters", () => {
  it("counts active filters", () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
    expect(countActiveFilters({ ...EMPTY_FILTERS, channels: ["sms"], assigned: "me", status: ["waiting"] })).toBe(3);
  });
  it("matches channels and tags", () => {
    expect(matchesFilters(c(), { ...EMPTY_FILTERS, channels: ["sms"] }, now)).toBe(false);
    expect(matchesFilters(c(), { ...EMPTY_FILTERS, channels: ["email"] }, now)).toBe(true);
    const tagged = c({ tags: [{ id: "t1", name: "VIP", color: "#fff" }] });
    expect(matchesFilters(tagged, { ...EMPTY_FILTERS, tags: ["t1"] }, now)).toBe(true);
    expect(matchesFilters(c(), { ...EMPTY_FILTERS, tags: ["t1"] }, now)).toBe(false);
  });
  it("matches status", () => {
    const overdue = c({ lastActivityAt: ago(30) });
    expect(matchesFilters(overdue, { ...EMPTY_FILTERS, status: ["overdue"] }, now)).toBe(true);
    expect(matchesFilters(overdue, { ...EMPTY_FILTERS, status: ["needs_reply"] }, now)).toBe(true);
    expect(matchesFilters(c(), { ...EMPTY_FILTERS, status: ["overdue"] }, now)).toBe(false);
    expect(matchesFilters(c(), { ...EMPTY_FILTERS, status: ["waiting"] }, now)).toBe(false);
  });
  it("matches last message window and ignores assigned", () => {
    const old = c({ lastActivityAt: ago(24 * 10) });
    expect(matchesFilters(old, { ...EMPTY_FILTERS, lastMessage: "week" }, now)).toBe(false);
    expect(matchesFilters(old, { ...EMPTY_FILTERS, lastMessage: "any" }, now)).toBe(true);
    expect(matchesFilters(c(), { ...EMPTY_FILTERS, lastMessage: "today" }, now)).toBe(true);
    expect(matchesFilters(c(), { ...EMPTY_FILTERS, assigned: "unassigned" }, now)).toBe(true);
  });
  it("builds server params", () => {
    expect(serverParamsFor(EMPTY_FILTERS, "all")).toEqual({});
    expect(serverParamsFor({ ...EMPTY_FILTERS, assigned: "unassigned" }, "all")).toEqual({ assignedTo: "unassigned" });
    expect(serverParamsFor({ ...EMPTY_FILTERS, assigned: "unassigned" }, "mine")).toEqual({ assignedTo: "me" });
    expect(serverParamsFor(EMPTY_FILTERS, "needs_reply")).toEqual({ needsReply: true });
  });
  it("counts channels", () => {
    expect(channelCounts([c(), c({ channel: "sms" }), c()])).toEqual({
      email: 2,
      sms: 1,
      whatsapp: 0,
      messenger: 0,
      instagram: 0,
    });
  });
});
