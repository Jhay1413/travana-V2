import { describe, expect, it } from "vitest";
import { TASK_TYPE_OPTIONS, taskTypeForTitle, titleForTaskType } from "./task-types";

describe("taskTypeForTitle", () => {
  it("matches a label case-insensitively and trimmed", () => {
    expect(taskTypeForTitle("Quote follow up")).toBe("quote_follow_up");
    expect(taskTypeForTitle("  re-quote ")).toBe("re_quote");
    expect(taskTypeForTitle("ENQUIRY CALL")).toBe("enquiry_call");
  });
  it("falls back to custom", () => {
    expect(taskTypeForTitle("Call to go through the quote")).toBe("custom");
    expect(taskTypeForTitle("Custom")).toBe("custom");
    expect(taskTypeForTitle("")).toBe("custom");
    expect(taskTypeForTitle(null)).toBe("custom");
  });
});

describe("titleForTaskType", () => {
  it("returns the label for preset types, ignoring custom text", () => {
    expect(titleForTaskType("booking_call", "ignored")).toBe("Booking call");
    expect(titleForTaskType("quote_call", "")).toBe("Quote call");
  });
  it("returns the trimmed custom text for custom", () => {
    expect(titleForTaskType("custom", "  Chase passport  ")).toBe("Chase passport");
    expect(titleForTaskType("custom", "   ")).toBe("");
  });
  it("round-trips every preset label", () => {
    for (const o of TASK_TYPE_OPTIONS) {
      if (o.value !== "custom") expect(taskTypeForTitle(titleForTaskType(o.value, ""))).toBe(o.value);
    }
  });
});
