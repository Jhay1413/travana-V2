import { describe, expect, it } from "vitest";
import {
  RIGHT_CARD_TABS,
  draftToInput,
  formatPassengerDate,
  isPassengerDraftValid,
  orDash,
  passengerCountLabel,
  passengerFullName,
  passengerLabel,
  passportFootnote,
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
    expect(passportFootnote(null)).toBe("Passport expiry is checked against the next departure. No upcoming bookings yet.");
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
