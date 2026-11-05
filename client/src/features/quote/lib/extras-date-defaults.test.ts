import { describe, it, expect } from "vitest";
import { resolveReturnDate, resolveTravelDate, withExtraDateDefaults } from "./extras-date-defaults";

const ctx = { travelDate: "2026-12-01", nights: 7 };

describe("resolveTravelDate / resolveReturnDate", () => {
  it("falls back travelDate -> checkInDate -> cruiseDate and ignores junk", () => {
    expect(resolveTravelDate({ travelDate: "2026-12-01" })).toBe("2026-12-01");
    expect(resolveTravelDate({ travelDate: "", checkInDate: "2026-12-02" })).toBe("2026-12-02");
    expect(resolveTravelDate({ cruiseDate: "2026-12-03" })).toBe("2026-12-03");
    expect(resolveTravelDate({ travelDate: "not-a-date" })).toBe("");
  });

  it("computes travel date + nights when there is no explicit return date", () => {
    expect(resolveReturnDate(ctx)).toBe("2026-12-08");
    expect(resolveReturnDate({ travelDate: "2026-12-28", nights: "5" })).toBe("2027-01-02");
  });

  it("prefers an explicit return date and returns empty when it cannot be known", () => {
    expect(resolveReturnDate({ ...ctx, inboundDepartDate: "2026-12-09" })).toBe("2026-12-09");
    expect(resolveReturnDate({ travelDate: "2026-12-01", nights: 0 })).toBe("");
    expect(resolveReturnDate({ nights: 7 })).toBe("");
  });
});

describe("withExtraDateDefaults", () => {
  it("fills transfer and car hire pick-up with the travel date and drop-off with the return date", () => {
    for (const kind of ["transfer", "carHire"] as const) {
      const row = withExtraDateDefaults(kind, { pickUpDate: "", dropOffDate: "" }, ctx);
      expect(row).toEqual({ pickUpDate: "2026-12-01", dropOffDate: "2026-12-08" });
    }
  });

  it("fills visit, usage and parking dates with the travel date", () => {
    expect(withExtraDateDefaults("attractionTicket", { dateOfVisit: "" }, ctx).dateOfVisit).toBe("2026-12-01");
    expect(withExtraDateDefaults("loungePass", { dateOfUsage: "" }, ctx).dateOfUsage).toBe("2026-12-01");
    expect(withExtraDateDefaults("airportParking", { parkingDate: "" }, ctx).parkingDate).toBe("2026-12-01");
  });

  it("uses the accommodation check-in for extra accommodation when set, else the travel date", () => {
    expect(withExtraDateDefaults("extraAccommodation", { checkInDate: "" }, { ...ctx, checkInDate: "2026-12-02" }).checkInDate).toBe("2026-12-02");
    expect(withExtraDateDefaults("extraAccommodation", { checkInDate: "" }, ctx).checkInDate).toBe("2026-12-01");
  });

  it("never overwrites a date the user already entered", () => {
    const row = withExtraDateDefaults("transfer", { pickUpDate: "2026-11-30", dropOffDate: "" }, ctx);
    expect(row).toEqual({ pickUpDate: "2026-11-30", dropOffDate: "2026-12-08" });
  });

  it("leaves fields empty when the quote has no dates yet and keeps other fields", () => {
    const row = withExtraDateDefaults("transfer", { pickUpDate: "", dropOffDate: "", cost: 0 }, {});
    expect(row).toEqual({ pickUpDate: "", dropOffDate: "", cost: 0 });
  });
});
