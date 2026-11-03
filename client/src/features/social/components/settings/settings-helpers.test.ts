// @vitest-environment node
import { describe, expect, it } from "vitest";
import { addShortcut, isValidTime, timezoneOptions } from "./settings-helpers";

describe("isValidTime", () => {
  it("accepts HH:mm", () => {
    expect(isValidTime("00:00")).toBe(true);
    expect(isValidTime("23:59")).toBe(true);
  });
  it("rejects bad values", () => {
    for (const v of ["24:00", "9:00", "12:60", "", "ab:cd"]) expect(isValidTime(v)).toBe(false);
  });
});

describe("addShortcut", () => {
  it("adds and sorts", () => {
    expect(addShortcut(["12:00", "18:00"], "09:00")).toEqual({ ok: true, list: ["09:00", "12:00", "18:00"] });
  });
  it("rejects duplicates", () => {
    expect(addShortcut(["09:00"], "09:00")).toEqual({ ok: false, error: "That time is already in the list." });
  });
  it("rejects invalid", () => {
    expect(addShortcut([], "99:00").ok).toBe(false);
  });
  it("rejects when full", () => {
    const full = ["01:00", "02:00", "03:00", "04:00", "05:00", "06:00", "07:00", "08:00"];
    expect(addShortcut(full, "09:00").ok).toBe(false);
  });
});

describe("timezoneOptions", () => {
  it("returns a non-empty list including London", () => {
    const zones = timezoneOptions();
    expect(zones.length).toBeGreaterThan(0);
    expect(zones).toContain("Europe/London");
  });
});
