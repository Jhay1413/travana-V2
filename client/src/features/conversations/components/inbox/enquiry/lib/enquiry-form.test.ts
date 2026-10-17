import { describe, expect, it } from "vitest";
import {
  DATELESS_FLEXIBILITY,
  DEFAULT_FORM,
  autoTitle,
  fitChildAges,
  holidayKind,
  leadSourceForChannel,
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

describe("validateEnquiryForm", () => {
  it("passes a complete package form", () => {
    expect(validateEnquiryForm(valid)).toEqual({});
  });

  it("reports every required field with its message", () => {
    const errors = validateEnquiryForm({ ...DEFAULT_FORM, adults: 0 });
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
    expect(validateEnquiryForm({ ...noDate, flexibility: "Anytime in Month" }).travelDate).toBeUndefined();
    expect(validateEnquiryForm({ ...noDate, flexibility: "Any Time" }).travelDate).toBeUndefined();
    for (const f of ["Exact Date", "+/- 3 Days", "+ 7 Days", ""]) {
      expect(validateEnquiryForm({ ...noDate, flexibility: f }).travelDate).toBeDefined();
    }
    expect(validateEnquiryForm({ ...valid, flexibility: "+/- 3 Days" }).travelDate).toBeUndefined();
  });

  it("skips the airport for a hot tub break, and the date when flexible", () => {
    const hot = { ...valid, holidayTypeName: "Hot Tub Break", airports: [], travelDate: "" };
    expect(validateEnquiryForm(hot).airports).toBeUndefined();
    expect(validateEnquiryForm(hot).travelDate).toBeDefined();
    expect(validateEnquiryForm({ ...hot, flexibleOnDate: true }).travelDate).toBeUndefined();
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

  it("computes tomorrow at 10:00 local", () => {
    const d = tomorrowAtTen(new Date(2026, 0, 31, 15, 30));
    expect([d.getFullYear(), d.getMonth(), d.getDate(), d.getHours(), d.getMinutes()]).toEqual([2026, 1, 1, 10, 0]);
  });
});
