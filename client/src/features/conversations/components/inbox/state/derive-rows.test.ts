import { describe, expect, it } from "vitest";
import type { Conversation } from "../../../types";
import { EMPTY_FILTERS, DEFAULT_SORT_PREFERENCE } from "../lib";
import { deriveRows, isDone, matchesTab, mergeById, tabToQuery } from "./derive-rows";

const NOW = new Date("2026-03-10T12:00:00Z");

function conv(over: Partial<Conversation> & { id: string }): Conversation {
  return {
    channel: "email",
    status: "open",
    contact: { id: `c-${over.id}`, displayName: over.id } as Conversation["contact"],
    preview: "",
    lastActivityAt: "2026-03-10T10:00:00Z",
    unread: false,
    snoozed: false,
    snoozedUntil: null,
    messages: [],
    ...over,
  };
}

const base = { tab: "open" as const, filters: EMPTY_FILTERS, chip: "all" as const, sort: DEFAULT_SORT_PREFERENCE, forcedUnread: new Set<string>(), now: NOW };

describe("tabToQuery", () => {
  it("maps done to the closed query", () => {
    expect(tabToQuery("done")).toBe("closed");
    expect(tabToQuery("open")).toBe("open");
    expect(tabToQuery("snoozed")).toBe("snoozed");
  });
});

describe("done predicate", () => {
  const yearSnooze = conv({ id: "y", snoozed: true, snoozedUntil: "2027-03-10T12:00:00Z" });
  const shortSnooze = conv({ id: "s", snoozed: true, snoozedUntil: "2026-03-11T12:00:00Z" });
  it("treats closed and year-long snoozes as done", () => {
    expect(isDone(conv({ id: "c", status: "closed" }), NOW)).toBe(true);
    expect(isDone(yearSnooze, NOW)).toBe(true);
    expect(isDone(shortSnooze, NOW)).toBe(false);
  });
  it("keeps done rows out of Snoozed and Open", () => {
    expect(matchesTab(yearSnooze, "done", NOW)).toBe(true);
    expect(matchesTab(yearSnooze, "snoozed", NOW)).toBe(false);
    expect(matchesTab(yearSnooze, "open", NOW)).toBe(false);
    expect(matchesTab(shortSnooze, "snoozed", NOW)).toBe(true);
  });
  it("keeps a lapsed snooze on the Snoozed tab until the provider clears it", () => {
    const lapsed = conv({ id: "l", snoozed: false, snoozedUntil: "2025-01-20T09:00:00Z" });
    expect(matchesTab(lapsed, "snoozed", NOW)).toBe(true);
  });
  it("drops a row from Snoozed once an optimistic unsnooze clears the stamp", () => {
    const cleared = conv({ id: "u", snoozed: false, snoozedUntil: null });
    expect(matchesTab(cleared, "snoozed", NOW)).toBe(false);
  });
});

describe("deriveRows", () => {
  it("filters by tab and sorts newest first", () => {
    const rows = deriveRows(
      [
        conv({ id: "old", lastActivityAt: "2026-03-09T10:00:00Z" }),
        conv({ id: "new", lastActivityAt: "2026-03-10T11:00:00Z" }),
        conv({ id: "closed", status: "closed" }),
      ],
      base,
    );
    expect(rows.map((r) => r.id)).toEqual(["new", "old"]);
  });

  it("applies forced unread and the unread chip", () => {
    const rows = deriveRows([conv({ id: "a" }), conv({ id: "b", unread: true })], {
      ...base,
      chip: "unread",
      forcedUnread: new Set(["a"]),
    });
    expect(rows.map((r) => r.id).sort()).toEqual(["a", "b"]);
    expect(rows.every((r) => r.unread)).toBe(true);
  });

  it("drops non-unread rows under the unread chip", () => {
    const rows = deriveRows([conv({ id: "a" }), conv({ id: "b", unread: true })], { ...base, chip: "unread" });
    expect(rows.map((r) => r.id)).toEqual(["b"]);
  });

  it("keeps the selected row under the unread chip after it is read", () => {
    const list = [conv({ id: "a" }), conv({ id: "b", unread: true })];
    expect(deriveRows(list, { ...base, chip: "unread", selectedId: "a" }).map((r) => r.id).sort()).toEqual(["a", "b"]);
    expect(deriveRows(list, { ...base, chip: "unread", selectedId: null }).map((r) => r.id)).toEqual(["b"]);
  });

  it("keeps the selected row under a status filter it no longer matches", () => {
    const list = [
      conv({ id: "a", unread: false }),
      conv({ id: "b", unread: true, lastActivityAt: "2026-03-10T11:50:00Z", messages: [{ id: "m", direction: "inbound", body: "", sentAt: "2026-03-10T11:50:00Z" }] }),
    ];
    const filters = { ...EMPTY_FILTERS, status: ["needs_reply" as const] };
    expect(deriveRows(list, { ...base, filters }).map((r) => r.id)).toEqual(["b"]);
    expect(deriveRows(list, { ...base, filters, selectedId: "a" }).map((r) => r.id).sort()).toEqual(["a", "b"]);
  });

  it("still applies the tab to the selected row", () => {
    const rows = deriveRows([conv({ id: "a", status: "closed" })], { ...base, selectedId: "a" });
    expect(rows).toEqual([]);
  });

  it("applies client-side filters", () => {
    const rows = deriveRows([conv({ id: "a", channel: "sms" }), conv({ id: "b", channel: "email" })], {
      ...base,
      filters: { ...EMPTY_FILTERS, channels: ["sms"] },
    });
    expect(rows.map((r) => r.id)).toEqual(["a"]);
  });
});

describe("mergeById", () => {
  it("unions by id keeping the first occurrence", () => {
    expect(mergeById([{ id: "a", v: 1 }, { id: "b", v: 1 }], [{ id: "b", v: 2 }, { id: "c", v: 2 }])).toEqual([
      { id: "a", v: 1 },
      { id: "b", v: 1 },
      { id: "c", v: 2 },
    ]);
  });
});
