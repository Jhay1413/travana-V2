import { describe, expect, it } from "vitest";
import type { Conversation } from "../../../types";
import { applySort, SORT_OPTIONS } from "./sort";

const now = new Date(2026, 9, 15, 12, 0);
const ago = (h: number) => new Date(now.getTime() - h * 3_600_000).toISOString();

function c(id: string, name: string, hours: number, unread: boolean, direction: "inbound" | "outbound" = "inbound"): Conversation {
  return {
    id,
    channel: "sms",
    status: "open",
    contact: { id, displayName: name, firstName: name, lastName: "", languages: [], handle: "", handleLabel: "", customFields: [] },
    preview: "",
    lastActivityAt: ago(hours),
    unread,
    needsReply: direction === "inbound",
    snoozed: false,
    messages: [{ id: "m", direction, body: "", sentAt: ago(hours) }],
  };
}

const rows = [c("a", "Zed", 1, false, "outbound"), c("b", "Amy", 5, true), c("d", "Bob", 3, true)];
const ids = (r: Conversation[]) => r.map((x) => x.id);

describe("applySort", () => {
  it("latest", () => {
    expect(ids(applySort(rows, "latest", { unreadFirst: false, now }))).toEqual(["a", "d", "b"]);
  });
  it("longest waiting puts non-waiting last", () => {
    expect(ids(applySort(rows, "longest_waiting", { unreadFirst: false, now }))).toEqual(["b", "d", "a"]);
  });
  it("longest waiting counts a seen but unanswered row as waiting on us", () => {
    const seen = [c("a", "Zed", 9, false), c("b", "Amy", 5, true), c("d", "Bob", 3, false, "outbound")];
    expect(ids(applySort(seen, "longest_waiting", { unreadFirst: false, now }))).toEqual(["a", "b", "d"]);
  });
  it("unread first", () => {
    expect(ids(applySort(rows, "unread_first", { unreadFirst: false, now }))).toEqual(["d", "b", "a"]);
  });
  it("name", () => {
    expect(ids(applySort(rows, "name", { unreadFirst: false, now }))).toEqual(["b", "d", "a"]);
  });
  it("latest with unreadFirst", () => {
    expect(ids(applySort(rows, "latest", { unreadFirst: true, now }))).toEqual(["d", "b", "a"]);
  });
  it("does not mutate and is stable", () => {
    const same = [c("x", "Same", 2, false), c("y", "Same", 2, false)];
    expect(ids(applySort(same, "name", { unreadFirst: false, now }))).toEqual(["x", "y"]);
    expect(ids(rows)).toEqual(["a", "b", "d"]);
  });
  it("exposes four options", () => {
    expect(SORT_OPTIONS).toHaveLength(4);
  });
});
