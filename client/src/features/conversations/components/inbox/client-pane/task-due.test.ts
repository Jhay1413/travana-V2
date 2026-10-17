import { describe, expect, it } from "vitest";
import { taskDueLabel } from "./task-due";

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
