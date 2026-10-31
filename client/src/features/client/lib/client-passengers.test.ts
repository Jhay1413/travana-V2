import { afterEach, describe, expect, it, vi } from "vitest";
import {
  RIGHT_CARD_TABS,
  draftToInput,
  formatPassengerDate,
  isPassengerDraftComplete,
  isPassengerDraftValid,
  orDash,
  passengerCountLabel,
  passengerFullName,
  passengerLabel,
  passportExpiryFlag,
  passportExpiryFlagLabel,
  passportFootnote,
  passportNumberWarning,
} from "./client-passengers";

describe("formatPassengerDate", () => {
  it("formats dd/MM/yyyy", () => expect(formatPassengerDate("2031-05-04")).toBe("04/05/2031"));
  it("dashes empty or bad values", () => {
    expect(formatPassengerDate(null)).toBe("—");
    expect(formatPassengerDate("")).toBe("—");
    expect(formatPassengerDate("nope")).toBe("—");
  });
});

describe("orDash", () => {
  it("dashes blanks", () => {
    expect(orDash(null)).toBe("—");
    expect(orDash("  ")).toBe("—");
    expect(orDash(" 123 ")).toBe("123");
  });
});

describe("passengerLabel", () => {
  it("labels lead and numbered passengers", () => {
    expect(passengerLabel({ isLead: true }, 0)).toBe("LEAD PASSENGER");
    expect(passengerLabel({ isLead: false }, 1)).toBe("PASSENGER 2");
    expect(passengerLabel({ isLead: false }, 2)).toBe("PASSENGER 3");
  });
});

describe("passengerFullName", () => {
  it("includes the title when present", () => {
    expect(passengerFullName({ title: "Mr", firstName: "Jimmy", surname: "Bouy" })).toBe("Mr Jimmy Bouy");
    expect(passengerFullName({ title: null, firstName: "Jimmy", surname: "Bouy" })).toBe("Jimmy Bouy");
  });
});

describe("passengerCountLabel", () => {
  it("pluralises", () => {
    expect(passengerCountLabel(1)).toBe("1 passenger");
    expect(passengerCountLabel(3)).toBe("3 passengers");
  });
});

describe("passportFootnote", () => {
  it("names the next departure", () => {
    expect(passportFootnote("2026-12-05")).toBe(
      "Passport expiry is checked against the next departure, Sat 5 Dec 2026. Many countries need 6 months left.",
    );
  });
  it("handles no departure", () => {
    expect(passportFootnote(null)).toBe(
      "No upcoming bookings yet, so passport expiry is checked against today. Many countries need 6 months left.",
    );
  });
});

describe("isPassengerDraftComplete", () => {
  const full = { title: "Mr.", firstName: "A", surname: "B", dateOfBirth: "2000-01-31", passportNumber: "123456789", passportExpiry: "2030-05-01" };
  it("is true only when all six fields are filled", () => {
    expect(isPassengerDraftComplete(full)).toBe(true);
    for (const key of Object.keys(full) as Array<keyof typeof full>) {
      expect(isPassengerDraftComplete({ ...full, [key]: "" })).toBe(false);
      expect(isPassengerDraftComplete({ ...full, [key]: "  " })).toBe(false);
    }
  });
});

describe("passportNumberWarning", () => {
  it("is quiet for nine digits and for empty", () => {
    expect(passportNumberWarning("123456789")).toBeNull();
    expect(passportNumberWarning(" 123456789 ")).toBeNull();
    expect(passportNumberWarning("")).toBeNull();
    expect(passportNumberWarning("  ")).toBeNull();
  });
  it("warns for 8 or 10 digits and for letters", () => {
    const msg = "UK passports have 9 numbers. Check this one if it's a UK passport.";
    expect(passportNumberWarning("12345678")).toBe(msg);
    expect(passportNumberWarning("1234567890")).toBe(msg);
    expect(passportNumberWarning("AB1234567")).toBe(msg);
  });
});

describe("passportExpiryFlag", () => {
  const today = "2026-10-31";
  it("flags exactly 6 months and less, not more (next departure)", () => {
    expect(passportExpiryFlag("2027-04-15", "2026-10-15", today)).toBe(true);
    expect(passportExpiryFlag("2027-04-14", "2026-10-15", today)).toBe(true);
    expect(passportExpiryFlag("2027-04-16", "2026-10-15", today)).toBe(false);
  });
  it("flags an already-expired passport", () => {
    expect(passportExpiryFlag("2020-01-01", "2026-10-15", today)).toBe(true);
    expect(passportExpiryFlag("2020-01-01", null, today)).toBe(true);
  });
  it("uses today when there is no departure", () => {
    expect(passportExpiryFlag("2027-04-30", null, today)).toBe(true);
    expect(passportExpiryFlag("2027-05-01", null, today)).toBe(false);
  });
  it("clamps at month end (31 Aug + 6 months = 28 Feb, 29 Feb in a leap year)", () => {
    expect(passportExpiryFlag("2027-02-28", "2026-08-31", today)).toBe(true);
    expect(passportExpiryFlag("2027-03-01", "2026-08-31", today)).toBe(false);
    expect(passportExpiryFlag("2028-02-29", "2027-08-31", today)).toBe(true);
    expect(passportExpiryFlag("2028-03-01", "2027-08-31", today)).toBe(false);
  });
  it("ignores a blank or unreadable expiry", () => {
    expect(passportExpiryFlag("", null, today)).toBe(false);
    expect(passportExpiryFlag("nope", null, today)).toBe(false);
  });
});

describe("passportExpiryFlagLabel", () => {
  it("says at travel when there is a next departure", () => {
    expect(passportExpiryFlagLabel("2026-12-01")).toBe("6 months or less at travel");
  });
  it("says left when there is none", () => {
    expect(passportExpiryFlagLabel(null)).toBe("6 months or less left");
  });
});

describe("passportExpiryFlag default day", () => {
  afterEach(() => vi.useRealTimers());
  it("defaults to the London day, not the browser day", () => {
    // BST is one hour ahead of UTC, so a late-evening UTC instant is already the next London day.
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-30T23:30:00Z")); // 00:30 on 1 Jul in London (BST)
    // London today is 2026-07-01, so the limit is 2027-01-01.
    expect(passportExpiryFlag("2027-01-01", null)).toBe(true);
    expect(passportExpiryFlag("2027-01-02", null)).toBe(false);
  });
});

describe("passenger draft", () => {
  it("requires first name and surname", () => {
    const base = { title: "", firstName: "A", surname: "B", dateOfBirth: "", passportNumber: "", passportExpiry: "" };
    expect(isPassengerDraftValid(base)).toBe(true);
    expect(isPassengerDraftValid({ ...base, surname: " " })).toBe(false);
  });
  it("nulls blanks and trims", () => {
    expect(
      draftToInput({ title: "", firstName: " A ", surname: "B", dateOfBirth: "", passportNumber: " 99 ", passportExpiry: "" }),
    ).toEqual({ title: null, firstName: "A", surname: "B", dateOfBirth: null, passportNumber: "99", passportExpiry: null });
  });
});

describe("RIGHT_CARD_TABS", () => {
  it("lists the three tabs, details first", () => {
    expect(RIGHT_CARD_TABS.map((t) => t.label)).toEqual(["Client details", "Portal access", "Referral network"]);
  });
});
