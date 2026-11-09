import { describe, expect, it } from "vitest";
import {
  DATELESS_FLEXIBILITY,
  DEFAULT_FORM,
  autoTitle,
  fitChildAges,
  flexibilityOptionsFor,
  holidayKind,
  leadSourceForChannel,
  nightsAsNumbers,
  tomorrowAtTen,
  validateEnquiryForm,
  type EnquiryForm,
} from "./enquiry-form";

const valid: EnquiryForm = {
  ...DEFAULT_FORM,
  title: "Lanzarote week",
  holidayType: "pt1",
  holidayTypeName: "Package Holiday",
  destinations: ["d1"],
  airports: ["a1"],
  travelDate: "2026-07-01",
};

const strict = (f: EnquiryForm) => validateEnquiryForm(f, { strict: true });

describe("validateEnquiryForm (non-strict, create / edit)", () => {
  it("only needs a title and a holiday type", () => {
    expect(validateEnquiryForm(DEFAULT_FORM, { strict: false })).toEqual({
      title: "Give the enquiry a title.",
      holidayType: "Pick a holiday type.",
    });
    expect(validateEnquiryForm({ ...DEFAULT_FORM, title: " ", holidayType: "pt1" }, { strict: false }).title).toBeDefined();
    expect(validateEnquiryForm({ ...DEFAULT_FORM, title: "Maldives", holidayType: "pt1" }, { strict: false })).toEqual({});
  });
});

describe("validateEnquiryForm (strict, inbox)", () => {
  it("passes a complete package form", () => {
    expect(strict(valid)).toEqual({});
  });

  it("reports every required field with its message", () => {
    const errors = strict({ ...DEFAULT_FORM, adults: 0 });
    expect(errors).toEqual({
      title: "Give the enquiry a title.",
      holidayType: "Pick a holiday type.",
      destinations: "Where do they want to go?",
      airports: "Which airport are they flying from?",
      travelDate: "Add the travel date, or choose an any-time flexibility.",
      travellers: "Who is travelling?",
    });
  });

  it("needs a travel date unless the flexibility means any time", () => {
    const noDate = { ...valid, travelDate: "" };
    expect(DATELESS_FLEXIBILITY).toEqual(["Anytime in Month", "Any Time"]);
    expect(strict({ ...noDate, flexibility: "Anytime in Month" }).travelDate).toBeUndefined();
    expect(strict({ ...noDate, flexibility: "Any Time" }).travelDate).toBeUndefined();
    for (const f of ["Exact Date", "+/- 3 Days", "+ 7 Days", ""]) {
      expect(strict({ ...noDate, flexibility: f }).travelDate).toBeDefined();
    }
    expect(strict({ ...valid, flexibility: "+/- 3 Days" }).travelDate).toBeUndefined();
  });

  it("skips the airport for a hot tub break, and the date when flexible", () => {
    const hot = { ...valid, holidayTypeName: "Hot Tub Break", airports: [], travelDate: "" };
    expect(strict(hot).airports).toBeUndefined();
    expect(strict(hot).travelDate).toBeDefined();
    expect(strict({ ...hot, flexibleOnDate: true }).travelDate).toBeUndefined();
  });
});

describe("helpers", () => {
  it("classifies holiday types by name", () => {
    expect(holidayKind("Hot Tub Break")).toBe("hottub");
    expect(holidayKind("cruise package")).toBe("cruise");
    expect(holidayKind("Package Holiday")).toBe("package");
    expect(holidayKind("")).toBe("package");
  });

  it("maps channel to lead source", () => {
    expect(leadSourceForChannel("whatsapp")).toBe("WHATSAPP");
    expect(leadSourceForChannel("messenger")).toBe("FACEBOOK");
    expect(leadSourceForChannel("instagram")).toBe("INSTAGRAM");
    expect(leadSourceForChannel("email")).toBe("SHOP");
  });

  it("builds the auto title from a destination label", () => {
    expect(autoTitle("Lanzarote, Spain")).toBe("Lanzarote holiday");
    expect(autoTitle(undefined)).toBe("");
  });

  it("keeps child ages the same length as children", () => {
    expect(fitChildAges([4], 3)).toEqual([4, 0, 0]);
    expect(fitChildAges([4, 6, 8], 1)).toEqual([4]);
    expect(fitChildAges([], 0)).toEqual([]);
  });

  it("picks flexibility choices by kind", () => {
    expect(flexibilityOptionsFor("package")).toContain("Anytime in Month");
    expect(flexibilityOptionsFor("cruise")).toContain("Any Time");
    expect(flexibilityOptionsFor("hottub")).toContain("Any Time");
  });

  it("reads night choices as numbers", () => {
    expect(nightsAsNumbers(["7", "x", "10"])).toEqual([7, 10]);
  });

  it("computes tomorrow at 10:00 local", () => {
    const d = tomorrowAtTen(new Date(2026, 0, 31, 15, 30));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 1, 1, 10, 0]);
  });
});
