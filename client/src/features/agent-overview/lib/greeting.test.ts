import { describe, expect, it } from "vitest";
import { greetingForHour, greetingLine } from "./greeting";

describe("greetingForHour", () => {
  it.each([
    [0, "Good morning"],
    [11, "Good morning"],
    [12, "Good afternoon"],
    [17, "Good afternoon"],
    [18, "Good evening"],
    [23, "Good evening"],
  ] as const)("hour %i -> %s", (hour, expected) => {
    expect(greetingForHour(hour)).toBe(expected);
  });
});

describe("greetingLine", () => {
  it("adds the first name", () => {
    expect(greetingLine(new Date(2026, 9, 16, 9, 0), "James")).toBe("Good morning, James");
  });

  it("drops the comma when there is no name", () => {
    expect(greetingLine(new Date(2026, 9, 16, 15, 0), "  ")).toBe("Good afternoon");
    expect(greetingLine(new Date(2026, 9, 16, 20, 0), null)).toBe("Good evening");
  });
});
