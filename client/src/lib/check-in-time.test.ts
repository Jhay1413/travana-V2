import { describe, expect, it } from "vitest";
import { deriveCheckIn } from "@/lib/check-in-time";

describe("deriveCheckIn", () => {
  it("14:50 -> 15:00", () => {
    expect(deriveCheckIn({ date: "2027-05-12", time: "14:50" })).toEqual({ date: "2027-05-12", time: "15:00" });
  });
  it("15:00 -> 15:00", () => {
    expect(deriveCheckIn({ date: "2027-05-12", time: "15:00" })).toEqual({ date: "2027-05-12", time: "15:00" });
  });
  it("15:01 -> 16:01", () => {
    expect(deriveCheckIn({ date: "2027-05-12", time: "15:01" })).toEqual({ date: "2027-05-12", time: "16:01" });
  });
  it("22:50 -> 23:50", () => {
    expect(deriveCheckIn({ date: "2027-05-12", time: "22:50" })).toEqual({ date: "2027-05-12", time: "23:50" });
  });
  it("23:30 -> next day 00:30", () => {
    expect(deriveCheckIn({ date: "2027-05-31", time: "23:30" })).toEqual({ date: "2027-06-01", time: "00:30" });
  });
  it("no flights -> 15:00 on travel date", () => {
    expect(deriveCheckIn(undefined, "2027-05-12")).toEqual({ date: "2027-05-12", time: "15:00" });
  });
  it("arrival date without time -> 15:00 on arrival date", () => {
    expect(deriveCheckIn({ date: "2027-05-13" }, "2027-05-12")).toEqual({ date: "2027-05-13", time: "15:00" });
  });
  it("overnight arrival uses the arrival (next) day", () => {
    expect(deriveCheckIn({ date: "2027-05-13", time: "06:10" }, "2027-05-12")).toEqual({ date: "2027-05-13", time: "15:00" });
  });
});
