import { describe, expect, it } from "vitest";
import { addMonthsIso, formatLongPassportDate, formatPassportDate, parsePassportDate, todayIso } from "./passport-dates";

describe("formatPassportDate", () => {
  it("writes ISO dates the way the design does", () => {
    expect(formatPassportDate("2031-02-09")).toBe("9 Feb 2031");
    expect(formatPassportDate("2032-10-22")).toBe("22 Oct 2032");
    expect(formatPassportDate("1988-06-14T00:00:00.000Z")).toBe("14 Jun 1988");
  });
  it("gives nothing for blanks and things that are not dates", () => {
    expect(formatPassportDate(null)).toBe("");
    expect(formatPassportDate(undefined)).toBe("");
    expect(formatPassportDate("")).toBe("");
    expect(formatPassportDate("soon")).toBe("");
    expect(formatPassportDate("2031-02-30")).toBe("");
  });
});

describe("parsePassportDate", () => {
  it.each([
    ["22 Oct 2032", "2032-10-22"],
    ["22 October 2032", "2032-10-22"],
    ["  22   oct   2032 ", "2032-10-22"],
    ["22oct2032", "2032-10-22"],
    ["22-Oct-2032", "2032-10-22"],
    ["22 Sept 2032", "2032-09-22"],
    ["1st Mar 2030", "2030-03-01"],
    ["Oct 22, 2032", "2032-10-22"],
    ["October 22 2032", "2032-10-22"],
    ["22/10/2032", "2032-10-22"],
    ["22-10-2032", "2032-10-22"],
    ["22.10.2032", "2032-10-22"],
    ["22 10 2032", "2032-10-22"],
    ["2/3/2030", "2030-03-02"],
    ["2032-10-22", "2032-10-22"],
    ["2032-1-5", "2032-01-05"],
    ["29 Feb 2028", "2028-02-29"],
  ])("reads %s as %s", (input, iso) => {
    expect(parsePassportDate(input)).toBe(iso);
  });

  it.each([
    "",
    "   ",
    "tomorrow",
    "22 Octember 2032",
    "31 Feb 2030",
    "29 Feb 2031",
    "32/01/2030",
    "10/22/2032",
    "22/10/32",
    "22 Oct 32",
    "22 Oct",
    "2032",
    "22/10",
  ])("refuses %j rather than guessing", (input) => {
    expect(parsePassportDate(input)).toBeNull();
  });

  it("returns null for nothing", () => {
    expect(parsePassportDate(null)).toBeNull();
    expect(parsePassportDate(undefined)).toBeNull();
  });

  it("round-trips what formatPassportDate writes", () => {
    for (const iso of ["2031-02-09", "1990-03-03", "2028-02-29", "2027-12-31"]) {
      expect(parsePassportDate(formatPassportDate(iso))).toBe(iso);
    }
  });
});

describe("date helpers", () => {
  it("adds months and clamps to the month end", () => {
    expect(addMonthsIso("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonthsIso("2027-10-15", 6)).toBe("2028-04-15");
  });
  it("writes the long form the server uses", () => {
    expect(formatLongPassportDate("2027-05-04")).toBe("4 May 2027");
  });
  it("gives today on this device", () => {
    expect(todayIso(new Date(2026, 10, 26, 23, 59))).toBe("2026-11-26");
    expect(todayIso(new Date(2026, 0, 5))).toBe("2026-01-05");
  });
});
