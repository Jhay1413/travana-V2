import { describe, expect, it } from "vitest";
import { DEFAULT_TASK_PRIORITY, priorityLabel, showPriorityPill } from "./task-priority";

describe("showPriorityPill", () => {
  it("hides medium and missing priorities", () => {
    expect(showPriorityPill("medium")).toBe(false);
    expect(showPriorityPill(undefined)).toBe(false);
    expect(showPriorityPill(null)).toBe(false);
  });
  it("shows low, high and urgent", () => {
    expect(showPriorityPill("low")).toBe(true);
    expect(showPriorityPill("high")).toBe(true);
    expect(showPriorityPill("urgent")).toBe(true);
  });
});

describe("priorityLabel", () => {
  it("labels each priority and defaults to Medium", () => {
    expect(priorityLabel("low")).toBe("Low");
    expect(priorityLabel("high")).toBe("High");
    expect(priorityLabel("urgent")).toBe("Urgent");
    expect(priorityLabel(undefined)).toBe("Medium");
    expect(DEFAULT_TASK_PRIORITY).toBe("medium");
  });
});
