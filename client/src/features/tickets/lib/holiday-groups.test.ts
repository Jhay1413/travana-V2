import { describe, expect, it } from "vitest";
import { filterHolidayOptions, groupHolidayOptions, holidayOptionSubline, type HolidayOption } from "./holiday-groups";

function opt(id: string, kind: HolidayOption["kind"], extra: Partial<HolidayOption> = {}): HolidayOption {
  return { id, kind, title: `T ${id}`, date: null, label: id, ref: null, operatorName: null, operatorLogoUrl: null, ...extra };
}

describe("groupHolidayOptions", () => {
  it("orders groups Bookings, Quotes, Enquiries and hides empty ones", () => {
    const groups = groupHolidayOptions([opt("e1", "enquiry"), opt("b1", "booking"), opt("e2", "enquiry")]);
    expect(groups.map((g) => g.heading)).toEqual(["Bookings", "Enquiries"]);
    expect(groups[1].options.map((o) => o.id)).toEqual(["e1", "e2"]);
  });
  it("returns nothing for no options", () => {
    expect(groupHolidayOptions([])).toEqual([]);
  });
});

describe("filterHolidayOptions", () => {
  const all = [opt("1", "booking", { title: "Majorca", ref: "HAYS123" }), opt("2", "quote", { title: "Crete", operatorName: "Jet2" })];
  it("keeps everything for a blank query", () => {
    expect(filterHolidayOptions(all, "  ")).toHaveLength(2);
  });
  it("matches title, ref and operator case-insensitively", () => {
    expect(filterHolidayOptions(all, "majo").map((o) => o.id)).toEqual(["1"]);
    expect(filterHolidayOptions(all, "hays1").map((o) => o.id)).toEqual(["1"]);
    expect(filterHolidayOptions(all, "JET2").map((o) => o.id)).toEqual(["2"]);
    expect(filterHolidayOptions(all, "zzz")).toEqual([]);
  });
});

describe("holidayOptionSubline", () => {
  it("shows ref and date for a booking", () => {
    expect(holidayOptionSubline({ kind: "booking", ref: "HAYS1", date: "2026-06-12T00:00:00Z" })).toMatch(/^HAYS1 · .*2026/);
  });
  it("shows only the date for quotes and enquiries, ignoring a ref", () => {
    const s = holidayOptionSubline({ kind: "quote", ref: "X", date: "2026-06-12T00:00:00Z" });
    expect(s).not.toContain("X");
    expect(holidayOptionSubline({ kind: "enquiry", ref: null, date: null })).toBeNull();
  });
});
