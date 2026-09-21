import { describe, it, expect, afterEach } from "vitest";
import {
  effectiveExpiry,
  endOfDayIso,
  getQuoteExpiryInfo,
  isQuotePastExpiry,
  suggestNextExpiryDate,
  toDateInputValue,
  todayIsoDate,
} from "./quote-expiry";

const NOW = new Date("2026-09-21T12:00:00.000Z");

describe("effectiveExpiry", () => {
  it("uses the explicit date_expiry when present", () => {
    expect(effectiveExpiry("2026-10-01T00:00:00Z", "2026-09-01T00:00:00Z").toISOString()).toBe(
      "2026-10-01T00:00:00.000Z",
    );
  });

  it("falls back to date_created + 7 days when there is no expiry — matches server/v2/utils/expiry.ts", () => {
    expect(effectiveExpiry(null, "2026-09-01T00:00:00Z").toISOString()).toBe("2026-09-08T00:00:00.000Z");
  });
});

describe("isQuotePastExpiry", () => {
  it("is true for a past explicit expiry date", () => {
    expect(isQuotePastExpiry("2026-09-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z", NOW)).toBe(true);
  });

  it("is false for a future explicit expiry date", () => {
    expect(isQuotePastExpiry("2026-10-01T00:00:00.000Z", "2026-08-01T00:00:00.000Z", NOW)).toBe(false);
  });

  it("derives from date_created + 7d when there's no explicit expiry", () => {
    // created 2026-09-10 -> effective expiry 2026-09-17 -> expired by NOW (2026-09-21)
    expect(isQuotePastExpiry(null, "2026-09-10T00:00:00.000Z", NOW)).toBe(true);
    // created 2026-09-20 -> effective expiry 2026-09-27 -> not yet expired
    expect(isQuotePastExpiry(null, "2026-09-20T00:00:00.000Z", NOW)).toBe(false);
  });
});

describe("getQuoteExpiryInfo", () => {
  it("returns null when there's no expiry and the fallback hasn't been reached yet", () => {
    expect(getQuoteExpiryInfo(null, "2026-09-18T00:00:00.000Z", NOW)).toBeNull();
  });

  it("returns null when there's no expiry and no created date at all", () => {
    expect(getQuoteExpiryInfo(null, null, NOW)).toBeNull();
  });

  it("reports expired (with no diffDays) once the no-expiry fallback is passed", () => {
    expect(getQuoteExpiryInfo(null, "2026-09-10T00:00:00.000Z", NOW)).toEqual({
      status: "expired",
      diffDays: null,
    });
  });

  it("flags a past explicit expiry date as expired with a negative diffDays", () => {
    const info = getQuoteExpiryInfo("2026-09-19T00:00:00.000Z", "2026-09-01T00:00:00.000Z", NOW);
    expect(info?.status).toBe("expired");
    expect(info?.diffDays).toBeLessThan(0);
  });

  it("flags a date within the 7-day near-expiry window as expiring-soon", () => {
    const info = getQuoteExpiryInfo("2026-09-27T12:00:00.000Z", "2026-09-01T00:00:00.000Z", NOW);
    expect(info).toEqual({ status: "expiring-soon", diffDays: 6 });
  });

  it("flags a date right at the 7-day boundary as expiring-soon", () => {
    const info = getQuoteExpiryInfo("2026-09-28T12:00:00.000Z", "2026-09-01T00:00:00.000Z", NOW);
    expect(info).toEqual({ status: "expiring-soon", diffDays: 7 });
  });

  it("flags a date further out as active", () => {
    const info = getQuoteExpiryInfo("2026-10-05T12:00:00.000Z", "2026-09-01T00:00:00.000Z", NOW);
    expect(info?.status).toBe("active");
    expect(info?.diffDays).toBe(14);
  });
});

describe("suggestNextExpiryDate", () => {
  it("keeps the current expiry when it's still today or later", () => {
    expect(suggestNextExpiryDate("2026-09-21", NOW)).toBe("2026-09-21");
    expect(suggestNextExpiryDate("2026-10-05", NOW)).toBe("2026-10-05");
  });

  it("suggests today + 7 days when the current expiry is in the past", () => {
    expect(suggestNextExpiryDate("2026-09-01", NOW)).toBe("2026-09-28");
  });

  it("suggests today + 7 days when there's no current expiry", () => {
    expect(suggestNextExpiryDate("", NOW)).toBe("2026-09-28");
  });
});

describe("todayIsoDate", () => {
  it("formats the given date as yyyy-mm-dd", () => {
    expect(todayIsoDate(NOW)).toBe("2026-09-21");
  });
});

// These use process.env.TZ to prove the helpers read LOCAL calendar fields
// (getFullYear/getMonth/getDate), not the UTC ones toISOString() would give —
// an instant close to a UTC day boundary reports a different calendar date
// depending on the zone. Node respects process.env.TZ for Date's local
// methods when read fresh (no caching across the change).
describe("timezone handling (local vs UTC calendar date)", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("todayIsoDate reports the local calendar date, not the UTC one", () => {
    // 23:30 UTC on the 21st is already the 22nd in a UTC+14 zone.
    const instant = new Date("2026-09-21T23:30:00.000Z");

    process.env.TZ = "UTC";
    expect(todayIsoDate(instant)).toBe("2026-09-21");

    process.env.TZ = "Pacific/Kiritimati"; // UTC+14, no DST
    expect(todayIsoDate(instant)).toBe("2026-09-22");
  });

  it("toDateInputValue reports the local calendar date for a stored expiry instant", () => {
    const instant = "2026-09-21T23:30:00.000Z";

    process.env.TZ = "UTC";
    expect(toDateInputValue(instant)).toBe("2026-09-21");

    process.env.TZ = "Pacific/Kiritimati";
    expect(toDateInputValue(instant)).toBe("2026-09-22");
  });
});

describe("toDateInputValue", () => {
  it("returns an empty string for null/undefined", () => {
    expect(toDateInputValue(null)).toBe("");
    expect(toDateInputValue(undefined)).toBe("");
  });

  it("returns an empty string for an unparseable value", () => {
    expect(toDateInputValue("not-a-date")).toBe("");
  });
});

describe("endOfDayIso", () => {
  const originalTz = process.env.TZ;

  afterEach(() => {
    process.env.TZ = originalTz;
  });

  it("writes an instant late enough in the day that 'today' isn't immediately expired", () => {
    process.env.TZ = "Europe/London";
    const written = endOfDayIso("2026-09-21");
    // Anything before 23:59:59 local on the 21st must still read as "not expired".
    const almostEndOfDay = new Date("2026-09-21T20:00:00+01:00");
    expect(new Date(written).getTime()).toBeGreaterThan(almostEndOfDay.getTime());
  });

  it("round-trips back to the same calendar day via toDateInputValue", () => {
    process.env.TZ = "Europe/London";
    const picked = "2026-09-22";
    const written = endOfDayIso(picked);
    expect(toDateInputValue(written)).toBe(picked);
  });

  it("round-trips correctly in a non-UK positive-offset timezone too", () => {
    process.env.TZ = "Pacific/Auckland"; // UTC+12/+13
    const picked = "2026-09-22";
    const written = endOfDayIso(picked);
    expect(toDateInputValue(written)).toBe(picked);
  });
});
