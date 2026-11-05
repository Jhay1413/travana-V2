import { describe, expect, it } from "vitest";
import type { Notification } from "../types";
import { markAllReadInList, markNotificationReadInList, partitionNotifications } from "./notification-tabs";

const n = (id: string, read: boolean): Notification => ({
  id,
  userId: "u",
  type: "t",
  title: id,
  message: "m",
  link: null,
  read,
  createdAt: "2026-01-01T00:00:00Z",
});

describe("partitionNotifications", () => {
  it("splits read and unread, keeping order", () => {
    const { unread, read } = partitionNotifications([n("a", false), n("b", true), n("c", false)]);
    expect(unread.map((x) => x.id)).toEqual(["a", "c"]);
    expect(read.map((x) => x.id)).toEqual(["b"]);
  });

  it("handles an empty list", () => {
    expect(partitionNotifications([])).toEqual({ unread: [], read: [] });
  });
});

describe("markNotificationReadInList", () => {
  it("moves one item to read without mutating the input", () => {
    const input = [n("a", false), n("b", false)];
    const out = markNotificationReadInList(input, "a");
    expect(partitionNotifications(out).unread.map((x) => x.id)).toEqual(["b"]);
    expect(input[0].read).toBe(false);
  });
});

describe("markAllReadInList", () => {
  it("marks everything read", () => {
    expect(partitionNotifications(markAllReadInList([n("a", false), n("b", true)])).unread).toEqual([]);
  });
});
