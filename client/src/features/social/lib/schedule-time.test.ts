import { describe, expect, it } from "vitest";
import { browserTimezoneLabel, combineLocal, goesOutLabel, isFutureLocal, splitLocal, time12 } from "./schedule-time";

describe("combineLocal", () => {
  it("keeps the wall clock verbatim and converts the same instant to UTC", () => {
    const { local, utcIso } = combineLocal("2026-10-21", "09:00");
    expect(local).toBe("2026-10-21T09:00");
    expect(utcIso).toBe(new Date("2026-10-21T09:00").toISOString());
  });
});

describe("splitLocal", () => {
  it("splits a full value", () => {
    expect(splitLocal("2026-10-21T09:30")).toEqual({ date: "2026-10-21", time: "09:30" });
  });
  it("handles date-only and empty values", () => {
    expect(splitLocal("2026-10-21")).toEqual({ date: "2026-10-21", time: "" });
    expect(splitLocal("")).toEqual({ date: "", time: "" });
  });
});

describe("time12", () => {
  it("formats morning, noon, afternoon and midnight", () => {
    expect(time12("09:00")).toBe("9:00 AM");
    expect(time12("12:05")).toBe("12:05 PM");
    expect(time12("18:30")).toBe("6:30 PM");
    expect(time12("00:00")).toBe("12:00 AM");
  });
  it("returns invalid input unchanged", () => {
    expect(time12("nope")).toBe("nope");
    expect(time12("25:00")).toBe("25:00");
  });
});

describe("goesOutLabel", () => {
  it("renders weekday, day, month and 12-hour time", () => {
    expect(goesOutLabel("2026-10-21T09:00")).toBe("Goes out Wed 21 Oct at 9:00 AM");
  });
  it("is empty for incomplete values", () => {
    expect(goesOutLabel("2026-10-21")).toBe("");
    expect(goesOutLabel("")).toBe("");
  });
});

describe("isFutureLocal", () => {
  const now = new Date("2026-10-15T12:00");
  it("is true only for complete values after now", () => {
    expect(isFutureLocal("2026-10-16T09:00", now)).toBe(true);
    expect(isFutureLocal("2026-10-15T11:59", now)).toBe(false);
    expect(isFutureLocal("2026-10-16", now)).toBe(false);
    expect(isFutureLocal("", now)).toBe(false);
  });
});

describe("browserTimezoneLabel", () => {
  it("shows the org label when it matches the browser zone", () => {
    expect(browserTimezoneLabel("Europe/London", "Europe/London")).toBe("Europe/London");
  });
  it("falls back to the browser zone with a hint when they differ", () => {
    expect(browserTimezoneLabel("Europe/London", "Asia/Manila")).toBe("Asia/Manila (your browser's time zone)");
  });
  it("uses the browser zone when no org label is given", () => {
    expect(browserTimezoneLabel(undefined, "Asia/Manila")).toBe("Asia/Manila (your browser's time zone)");
  });
});
