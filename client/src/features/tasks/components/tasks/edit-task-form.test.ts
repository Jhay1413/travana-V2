import { describe, expect, it } from "vitest";
import { buildEditTaskPayload, splitDueDate, toDateInput, toTimeInput } from "./edit-task-form";

describe("edit-task-form", () => {
  it("formats local date and time inputs zero padded", () => {
    const d = new Date(2026, 0, 5, 7, 3);
    expect(toDateInput(d)).toBe("2026-01-05");
    expect(toTimeInput(d)).toBe("07:03");
  });

  it("splits a valid due date and falls back for missing or invalid ones", () => {
    expect(splitDueDate(new Date(2026, 10, 20, 14, 30))).toEqual({ date: "2026-11-20", time: "14:30" });
    expect(splitDueDate(null)).toEqual({ date: "", time: "09:00" });
    expect(splitDueDate("not a date")).toEqual({ date: "", time: "09:00" });
  });

  it("builds a payload with trimmed description and optional assignee", () => {
    const base = { title: "Call", priority: "medium" as const, description: "  hi  ", dueDate: "2026-11-20", dueTime: "", completed: true, assignedToId: "" };
    const p = buildEditTaskPayload(base);
    expect(p.description).toBe("hi");
    expect(p.dueDate).toEqual(new Date(2026, 10, 20, 9, 0));
    expect("userId" in p).toBe(false);
    expect(buildEditTaskPayload({ ...base, description: " ", assignedToId: "u1" })).toMatchObject({ description: null, userId: "u1" });
  });
});
