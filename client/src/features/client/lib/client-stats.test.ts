import { describe, expect, it } from "vitest";
import { computeClientStats, formatStatDate, isLostBooking, latestDate } from "./client-stats";

describe("latestDate", () => {
  it("returns the newest valid date and ignores junk", () => {
    expect(latestDate(["2026-01-01", null, "nope", "2026-03-05T10:00:00Z"])?.toISOString()).toBe("2026-03-05T10:00:00.000Z");
  });
  it("returns null when nothing parses", () => {
    expect(latestDate([null, undefined, "x"])).toBeNull();
  });
});

describe("isLostBooking", () => {
  it("matches LOST case-insensitively only", () => {
    expect(isLostBooking({ booking_status: "LOST" })).toBe(true);
    expect(isLostBooking({ booking_status: "lost" })).toBe(true);
    expect(isLostBooking({ booking_status: "BOOKED" })).toBe(false);
    expect(isLostBooking({ booking_status: null })).toBe(false);
  });
});

describe("computeClientStats", () => {
  it("counts primary quotes only", () => {
    const s = computeClientStats([], [{ isQuoteCopy: false }, { isQuoteCopy: true }, {}], []);
    expect(s.quotes).toBe(2);
  });

  it("does not count quotes whose transaction is booked", () => {
    const s = computeClientStats(
      [],
      [
        { transaction_id: "t1" },
        { transaction_id: "t2" },
        { transaction_id: "t3", isQuoteCopy: true },
      ],
      [{ transaction_id: "t1", booking_status: "BOOKED" }, { transaction_id: "t2", booking_status: "LOST" }],
    );
    expect(s.quotes).toBe(0);
    expect(computeClientStats([], [{ transaction_id: "t9" }], [{ transaction_id: "t1" }]).quotes).toBe(1);
  });

  it("excludes LOST bookings from count, profit, PPB and last date", () => {
    const s = computeClientStats(
      [],
      [],
      [
        { package_commission: "300", booking_status: "BOOKED", date_created: "2026-02-01T00:00:00Z" },
        { package_commission: "100", booking_status: null, date_created: "2026-01-01T00:00:00Z" },
        { package_commission: "999", booking_status: "LOST", date_created: "2026-05-01T00:00:00Z" },
      ],
    );
    expect(s.bookings).toBe(2);
    expect(s.profit).toBe(400);
    expect(s.avgPpb).toBe(200);
    expect(s.lastBooking?.toISOString()).toBe("2026-02-01T00:00:00.000Z");
  });

  it("has zero PPB with no bookings and tolerates bad numbers", () => {
    const s = computeClientStats([{ date_created: "2026-04-02T00:00:00Z" }], [], [{ package_commission: "abc", booking_status: "BOOKED" }]);
    expect(s.enquiries).toBe(1);
    expect(s.profit).toBe(0);
    expect(s.avgPpb).toBe(0);
    expect(computeClientStats([], [], []).avgPpb).toBe(0);
  });
});

describe("formatStatDate", () => {
  it("formats dd/MM/yy and blanks null", () => {
    expect(formatStatDate(new Date("2026-03-05T10:00:00Z"))).toBe("05/03/26");
    // 23:30 UTC on 30 Jun is already 1 Jul in London (BST).
    expect(formatStatDate(new Date("2026-06-30T23:30:00Z"))).toBe("01/07/26");
    expect(formatStatDate(null)).toBe("");
  });
});
