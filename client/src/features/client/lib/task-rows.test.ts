import { describe, expect, it } from "vitest";
import { relativeTime, sortTasks, taskDueChip, totalViews } from "./task-rows";

const NOW = new Date(2026, 9, 16, 12, 0, 0);

describe("taskDueChip", () => {
  it("labels overdue, today, tomorrow and later dates", () => {
    expect(taskDueChip(new Date(2026, 9, 15, 23, 0), NOW).label).toBe("Overdue");
    expect(taskDueChip(new Date(2026, 9, 16, 8, 0), NOW).label).toBe("Today");
    expect(taskDueChip(new Date(2026, 9, 17, 8, 0), NOW).label).toBe("Tomorrow");
    expect(taskDueChip(new Date(2026, 9, 20, 8, 0), NOW).label).toBe("20 Oct");
  });
});

describe("sortTasks", () => {
  it("puts open tasks first, soonest due first, undated last", () => {
    const sorted = sortTasks([
      { id: "done", completed: true, dueDate: "2026-01-01" },
      { id: "late", completed: false, dueDate: "2026-12-01" },
      { id: "none", completed: false, dueDate: null },
      { id: "soon", completed: false, dueDate: "2026-11-01" },
    ]);
    expect(sorted.map((t) => t.id)).toEqual(["soon", "late", "none", "done"]);
  });
});

describe("relativeTime", () => {
  it("steps through minutes, hours and days", () => {
    const at = (ms: number) => new Date(NOW.getTime() - ms).toISOString();
    expect(relativeTime(at(10_000), NOW)).toBe("just now");
    expect(relativeTime(at(5 * 60_000), NOW)).toBe("5 min ago");
    expect(relativeTime(at(60 * 60_000), NOW)).toBe("1 hr ago");
    expect(relativeTime(at(3 * 3_600_000), NOW)).toBe("3 hrs ago");
    expect(relativeTime(at(2 * 86_400_000), NOW)).toBe("2 days ago");
  });
});

describe("totalViews", () => {
  it("sums view counts", () => {
    expect(totalViews([{ viewCount: 2 }, { viewCount: 3 }])).toBe(5);
    expect(totalViews(undefined)).toBe(0);
  });
});
