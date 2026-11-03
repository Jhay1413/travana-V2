import { describe, expect, it } from "vitest";
import { fillEmptyAssignee, isOpening, resolveTaskFormDefaults, tomorrowLondonKey, londonDueDate } from "./task-defaults";

describe("tomorrowLondonKey", () => {
  it("rolls over on the London calendar, not UTC", () => {
    // 23:30 UTC on 30 June is already 1 July in London (BST), so tomorrow is 2 July.
    expect(tomorrowLondonKey(new Date("2026-06-30T23:30:00Z"))).toBe("2026-07-02");
    expect(tomorrowLondonKey(new Date("2026-12-31T12:00:00Z"))).toBe("2027-01-01");
  });
});

describe("resolveTaskFormDefaults", () => {
  it("keeps today 09:00 when nothing is overridden", () => {
    expect(resolveTaskFormDefaults({}, "2026-10-20")).toEqual({ dueDate: "2026-10-20", dueTime: "09:00", assignedToId: "" });
  });
  it("applies overrides", () => {
    expect(
      resolveTaskFormDefaults({ defaultDueDate: "2026-10-21", defaultDueTime: "10:00", defaultAssignedToId: "u1" }, "2026-10-20"),
    ).toEqual({ dueDate: "2026-10-21", dueTime: "10:00", assignedToId: "u1" });
  });
});

describe("isOpening", () => {
  it("is true only on closed -> open", () => {
    expect(isOpening(false, true)).toBe(true);
    expect(isOpening(true, true)).toBe(false);
    expect(isOpening(true, false)).toBe(false);
    expect(isOpening(false, false)).toBe(false);
  });
});

describe("fillEmptyAssignee", () => {
  it("fills an empty assignee when a default arrives", () => {
    expect(fillEmptyAssignee("", "u1")).toBe("u1");
  });
  it("never overwrites an existing choice", () => {
    expect(fillEmptyAssignee("u2", "u1")).toBe("u2");
  });
  it("stays empty with no default", () => {
    expect(fillEmptyAssignee("", undefined)).toBe("");
  });
});

describe("londonDueDate", () => {
  it("uses GMT in winter and BST in summer", () => {
    expect(londonDueDate("2026-12-01", "10:00")?.toISOString()).toBe("2026-12-01T10:00:00.000Z");
    expect(londonDueDate("2026-07-01", "10:00")?.toISOString()).toBe("2026-07-01T09:00:00.000Z");
  });
  it("handles the days clocks go forward and back", () => {
    expect(londonDueDate("2026-03-29", "10:00")?.toISOString()).toBe("2026-03-29T09:00:00.000Z");
    expect(londonDueDate("2026-10-25", "10:00")?.toISOString()).toBe("2026-10-25T10:00:00.000Z");
  });
  it("rejects malformed input", () => {
    expect(londonDueDate("", "10:00")).toBeNull();
    expect(londonDueDate("2026-07-01", "")).toBeNull();
  });
});
