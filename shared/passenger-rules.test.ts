import { describe, expect, it } from "vitest";
import {
  NON_UK_PASSPORT_MESSAGE,
  UK_PASSPORT_MESSAGE,
  addMonthsYmd,
  firstPassengerError,
  normalisePassportNumber,
  passportExpiryDeadline,
  passportExpiryError,
  passportNumberError,
  validatePassenger,
} from "./passenger-rules";

const TODAY = "2026-11-04";
const FULL = { title: "Mr.", firstName: "A", surname: "B", dateOfBirth: "1990-01-01", passportNumber: "123456789", passportExpiry: "2030-01-01" };

describe("addMonthsYmd", () => {
  it("clamps to month end", () => {
    expect(addMonthsYmd("2026-08-31", 6)).toBe("2027-02-28");
    expect(addMonthsYmd("2027-08-31", 6)).toBe("2028-02-29");
    expect(addMonthsYmd("2026-10-15", 6)).toBe("2027-04-15");
  });
});

describe("passportNumberError", () => {
  it("UK: exactly 9 digits", () => {
    expect(passportNumberError("123456789", false)).toBeNull();
    expect(passportNumberError(" 123456789 ", false)).toBeNull();
    for (const bad of ["12345678", "1234567890", "12345678A", "AB1234567", "123 456 789"]) {
      expect(passportNumberError(bad, false), bad).toBe(UK_PASSPORT_MESSAGE);
    }
  });
  it("is required", () => {
    expect(passportNumberError("", false)).toBe("Passport number is required");
    expect(passportNumberError("  ", true)).toBe("Passport number is required");
    expect(passportNumberError(null, false)).toBe("Passport number is required");
  });
  it("Non-UK: 5 to 20 letters or digits, no spaces, case-insensitive input", () => {
    expect(passportNumberError("AB12345", true)).toBeNull();
    expect(passportNumberError("ab12345", true)).toBeNull();
    expect(passportNumberError("12345", true)).toBeNull();
    expect(passportNumberError("A".repeat(20), true)).toBeNull();
    expect(passportNumberError("AB12", true)).toBe(NON_UK_PASSPORT_MESSAGE);
    expect(passportNumberError("A".repeat(21), true)).toBe(NON_UK_PASSPORT_MESSAGE);
    expect(passportNumberError("AB 12345", true)).toBe(NON_UK_PASSPORT_MESSAGE);
    expect(passportNumberError("AB-12345", true)).toBe(NON_UK_PASSPORT_MESSAGE);
  });
  it("a 9-digit number is fine as Non-UK, but letters are not fine as UK", () => {
    expect(passportNumberError("123456789", true)).toBeNull();
    expect(passportNumberError("AB12345", false)).toBe(UK_PASSPORT_MESSAGE);
  });
});

describe("normalisePassportNumber", () => {
  it("trims, and upper-cases only for Non-UK", () => {
    expect(normalisePassportNumber("  ab12345 ", true)).toBe("AB12345");
    expect(normalisePassportNumber("  ab12345 ", false)).toBe("ab12345");
    expect(normalisePassportNumber(null, true)).toBe("");
  });
});

describe("passport expiry", () => {
  it("deadline is next departure + 6 months, else today + 6 months", () => {
    expect(passportExpiryDeadline("2026-10-15", TODAY)).toBe("2027-04-15");
    expect(passportExpiryDeadline(null, TODAY)).toBe("2027-05-04");
  });
  it("exactly 6 months after departure is blocked, one day later is allowed", () => {
    expect(passportExpiryError("2027-04-15", "2026-10-15", TODAY)).toBe(
      "Passport must be valid for more than 6 months after travel (until after 15/04/2027)",
    );
    expect(passportExpiryError("2027-04-16", "2026-10-15", TODAY)).toBeNull();
    expect(passportExpiryError("2020-01-01", "2026-10-15", TODAY)).not.toBeNull();
  });
  it("with no booking it is measured from today", () => {
    expect(passportExpiryError("2027-05-04", null, TODAY)).not.toBeNull();
    expect(passportExpiryError("2027-05-05", null, TODAY)).toBeNull();
  });
  it("is required", () => {
    expect(passportExpiryError("", null, TODAY)).toBe("Passport expiry is required");
  });
});

describe("validatePassenger", () => {
  it("accepts a complete valid passenger", () => {
    expect(validatePassenger(FULL, { nextDeparture: null, today: TODAY })).toEqual({});
  });
  it.each(["title", "firstName", "surname", "dateOfBirth", "passportNumber", "passportExpiry"] as const)("requires %s", (key) => {
    const errors = validatePassenger({ ...FULL, [key]: "  " }, { nextDeparture: null, today: TODAY });
    expect(Object.keys(errors)).toEqual([key]);
  });
  it("reports the first error in field order", () => {
    const errors = validatePassenger({ ...FULL, dateOfBirth: "", passportNumber: "1" }, { nextDeparture: null, today: TODAY });
    expect(firstPassengerError(errors)).toBe("Date of birth is required");
  });
  it("Non-UK flag switches the number rule", () => {
    expect(validatePassenger({ ...FULL, passportNumber: "AB12345" }, { nextDeparture: null, today: TODAY }).passportNumber).toBe(UK_PASSPORT_MESSAGE);
    expect(validatePassenger({ ...FULL, passportNumber: "AB12345", passportNonUk: true }, { nextDeparture: null, today: TODAY })).toEqual({});
  });
});
