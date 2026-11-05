import { describe, it, expect } from "vitest";
import { departureDatesForCheckIn } from "./departure-dates";

const base = { checkInDate: "2027-06-14", nights: 7, currentOutboundDepart: "", checkInIsDerived: false };

describe("departureDatesForCheckIn", () => {
  it("outbound departs on check-in and inbound on check-in + nights", () => {
    expect(departureDatesForCheckIn(base)).toEqual({ outboundDepartDate: "2027-06-14", inboundDepartDate: "2027-06-21" });
  });

  it("a derived check-in never overwrites an existing departure date", () => {
    expect(departureDatesForCheckIn({ ...base, checkInIsDerived: true, currentOutboundDepart: "2027-06-13" })).toEqual({ inboundDepartDate: "2027-06-21" });
    expect(departureDatesForCheckIn({ ...base, checkInIsDerived: true })).toHaveProperty("outboundDepartDate", "2027-06-14");
  });

  it("social posts keep an existing departure date", () => {
    expect(departureDatesForCheckIn({ ...base, socialPost: true, currentOutboundDepart: "2027-06-13" }).outboundDepartDate).toBeUndefined();
  });

  it("no inbound without nights, nothing without a valid check-in", () => {
    expect(departureDatesForCheckIn({ ...base, nights: 0 })).toEqual({ outboundDepartDate: "2027-06-14" });
    expect(departureDatesForCheckIn({ ...base, checkInDate: "" })).toEqual({});
    expect(departureDatesForCheckIn({ ...base, checkInDate: "junk" })).toEqual({});
  });
});
