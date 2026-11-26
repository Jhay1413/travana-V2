import { describe, expect, it } from "vitest";
import { PLACEHOLDER_BALANCE_DUE_DAYS_BEFORE_DEPARTURE, formatUkDate, placeholderBalanceDueDate } from "./balance-due";
import { maskLoginCodes } from "./mask-login-code";

describe("placeholderBalanceDueDate", () => {
  it("is departure minus 14 days, the original reminder rule, whatever the operator's own payment term is", () => {
    expect(PLACEHOLDER_BALANCE_DUE_DAYS_BEFORE_DEPARTURE).toBe(14);
    expect(placeholderBalanceDueDate("2026-12-10")).toBe("2026-11-26");
    expect(placeholderBalanceDueDate("2026-07-10")).toBe("2026-06-26");
  });

  it("is plain calendar arithmetic: the clock change never moves the day", () => {
    expect(placeholderBalanceDueDate("2026-11-10")).toBe("2026-10-27");
    expect(placeholderBalanceDueDate("2027-04-05")).toBe("2027-03-22");
  });

  it("is null without a usable departure date", () => {
    expect(placeholderBalanceDueDate(null)).toBeNull();
    expect(placeholderBalanceDueDate("soon")).toBeNull();
  });
});

describe("formatUkDate", () => {
  it("shows the calendar day in UK style", () => {
    expect(formatUkDate("2026-12-10")).toBe("10 Dec 2026");
    expect(formatUkDate("2027-06-01")).toBe("1 Jun 2027");
  });

  it("never shifts the day, whatever the machine's own zone (summer and winter)", () => {
    const before = process.env.TZ;
    try {
      for (const tz of ["Pacific/Auckland", "America/Los_Angeles", "UTC"]) {
        process.env.TZ = tz;
        expect(formatUkDate("2026-07-01")).toBe("1 Jul 2026");
        expect(formatUkDate("2026-12-31")).toBe("31 Dec 2026");
      }
    } finally {
      if (before === undefined) delete process.env.TZ;
      else process.env.TZ = before;
    }
  });

  it("is blank for nothing and unchanged for something that is not a date", () => {
    expect(formatUkDate(null)).toBe("");
    expect(formatUkDate("")).toBe("");
    expect(formatUkDate("soon")).toBe("soon");
  });
});

describe("maskLoginCodes", () => {
  it("replaces a live sign-in code and keeps the rest of the link", () => {
    expect(maskLoginCodes("Tap https://p.test/portal/login?mt=AbC123xyz789&next=%2Fportal%2Faccount to sign in")).toBe(
      "Tap https://p.test/portal/login?mt=[redacted]&next=%2Fportal%2Faccount to sign in",
    );
  });

  it("handles a code at the end, in another position, and several links", () => {
    expect(maskLoginCodes("https://p.test/portal/login?mt=CODE")).toBe("https://p.test/portal/login?mt=[redacted]");
    expect(maskLoginCodes("https://p.test/portal/login?next=%2Fx&mt=CODE1 and https://q.test/?mt=CODE2.")).toBe(
      "https://p.test/portal/login?next=%2Fx&mt=[redacted] and https://q.test/?mt=[redacted]",
    );
  });

  it("leaves text with no code alone", () => {
    expect(maskLoginCodes("Hi Ann, your booking is confirmed: https://p.test/portal/login")).toBe("Hi Ann, your booking is confirmed: https://p.test/portal/login");
    expect(maskLoginCodes("a format=mt is not a code")).toBe("a format=mt is not a code");
  });
});
