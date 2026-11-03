import { describe, expect, it } from "vitest";
import { BRIEFING_BULLETS, BRIEFING_TIMES, briefingGreeting } from "./sample-briefing";

describe("sample-briefing", () => {
  const friday = new Date("2026-10-16T09:00:00Z");

  it("greets by first name and London weekday", () => {
    expect(briefingGreeting("James", friday)).toEqual({ bold: "Good morning, James.", rest: " Here is your Friday." });
  });

  it("drops the name when it is empty or unknown", () => {
    expect(briefingGreeting("", friday).bold).toBe("Good morning.");
    expect(briefingGreeting("   ", friday).bold).toBe("Good morning.");
    expect(briefingGreeting(undefined, friday).bold).toBe("Good morning.");
  });

  it("keeps the five sample bullets and three send times", () => {
    expect(BRIEFING_BULLETS).toHaveLength(5);
    expect(BRIEFING_TIMES).toEqual(["7:00am", "8:00am", "9:00am"]);
  });
});
