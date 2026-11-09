import { describe, expect, it } from "vitest";
import { DEFAULT_FORM, type EnquiryForm } from "./enquiry-form";
import { formatSummaryDate, summariseEnquiry } from "./enquiry-summary";

const pkg: EnquiryForm = { ...DEFAULT_FORM, holidayType: "pt1", holidayTypeName: "Package Holiday" };

describe("formatSummaryDate", () => {
  it("formats ISO dates and leaves anything else alone", () => {
    expect(formatSummaryDate("2026-07-01")).toBe("1 Jul 2026");
    expect(formatSummaryDate("soon")).toBe("soon");
  });
});

describe("summariseEnquiry", () => {
  it("says nothing is filled in while only defaults are set", () => {
    expect(summariseEnquiry(pkg)).toBe("Nothing filled in yet.");
  });

  it("joins where, date, nights, party, airport and budget", () => {
    const form: EnquiryForm = {
      ...pkg,
      destinations: ["d1", "d2"],
      airports: ["a1"],
      labels: { d1: "Lanzarote, Spain", d2: "Tenerife, Spain", a1: "Manchester (MAN)" },
      travelDate: "2026-07-01",
      adults: 2,
      children: 1,
      budget: "3000",
    };
    expect(summariseEnquiry(form)).toBe("Lanzarote, Tenerife · 1 Jul 2026 · 7 nights · 2 adults, 1 child · from Manchester (MAN) · £3000 per person");
  });

  it("lists several night choices and uses the flexibility when there is no date", () => {
    const text = summariseEnquiry({ ...pkg, flexibleNights: ["10", "7"], flexibility: "Anytime in Month" });
    expect(text).toBe("Anytime in Month · 7 or 10 nights · 2 adults");
  });

  it("describes a hot tub break by guests and pets", () => {
    const form: EnquiryForm = { ...pkg, holidayTypeName: "Hot Tub Break", destinations: ["d1"], labels: { d1: "Lake District" }, guests: 4, pets: 1, budget: "500", maxBudget: "900" };
    expect(summariseEnquiry(form)).toBe("Lake District · 7 nights · 4 guests · 1 pet · £500 to £900 per person");
  });

  it("uses only the first destination for a cruise", () => {
    const form: EnquiryForm = { ...pkg, holidayTypeName: "Cruise Package", destinations: ["d1", "d2"], labels: { d1: "Med", d2: "Caribbean" }, budgetType: "Package", budget: "2000" };
    expect(summariseEnquiry(form)).toBe("Med · 7 nights · 2 adults · £2000 package");
  });
});
