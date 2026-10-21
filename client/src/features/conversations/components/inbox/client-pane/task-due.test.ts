import { describe, expect, it } from "vitest";
import { dueDateIso, sortByDue, taskDueLabel } from "./task-due";

const NOW = new Date(2026, 9, 15, 9, 0);

describe("taskDueLabel", () => {
  it("formats a future due date with time", () => {
    expect(taskDueLabel({ dueDate: new Date(2026, 9, 16, 10, 0) }, NOW)).toBe("Due Fri 16 Oct · 10:00");
  });

  it("omits the time at midnight", () => {
    expect(taskDueLabel({ dueDate: new Date(2026, 9, 20, 0, 0) }, NOW)).toBe("Due Tue 20 Oct");
  });

  it("marks past dates overdue", () => {
    expect(taskDueLabel({ dueDate: new Date(2026, 9, 14, 8, 5) }, NOW)).toBe("Overdue Wed 14 Oct · 08:05");
  });

  it("handles missing or invalid dates and ISO strings", () => {
    expect(taskDueLabel({ dueDate: null }, NOW)).toBe("No due date");
    expect(taskDueLabel({ dueDate: "nope" }, NOW)).toBe("No due date");
    expect(taskDueLabel({ dueDate: new Date(2026, 9, 16, 10, 0).toISOString() }, NOW)).toBe("Due Fri 16 Oct · 10:00");
  });
});

describe("dueDateIso", () => {
  it("normalises dates and strings, nulls bad input", () => {
    expect(dueDateIso(new Date("2026-10-21T10:00:00Z"))).toBe("2026-10-21T10:00:00.000Z");
    expect(dueDateIso("2026-10-21T10:00:00Z")).toBe("2026-10-21T10:00:00.000Z");
    expect(dueDateIso("nope")).toBeNull();
    expect(dueDateIso(undefined)).toBeNull();
  });
});

describe("sortByDue", () => {
  it("orders soonest first with undated last, without mutating", () => {
    const input = [{ id: "a", dueDate: null }, { id: "b", dueDate: "2026-10-22T10:00:00Z" }, { id: "c", dueDate: "2026-10-21T10:00:00Z" }];
    expect(sortByDue(input).map((t) => t.id)).toEqual(["c", "b", "a"]);
    expect(input[0].id).toBe("a");
  });
});
