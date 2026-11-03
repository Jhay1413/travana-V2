import { describe, it, expect } from "vitest";
import { closeRatePercent, leadSourceLabel, perBooking} from "./organization-overview.math";

describe("perBooking", () => {
  it("divides profit by bookings", () => expect(perBooking(300, 4)).toBe(75));
  it("is 0 with no bookings", () => expect(perBooking(300, 0)).toBe(0));
});

describe("closeRatePercent", () => {
  it("is bookings over quoted deals as a percentage", () => expect(closeRatePercent(1, 4)).toBe(25));
  it("clamps at 100", () => expect(closeRatePercent(9, 3)).toBe(100));
  it("is 0 when nothing was quoted", () => expect(closeRatePercent(5, 0)).toBe(0));
});

describe("leadSourceLabel", () => {
  it("labels known sources", () => {
    expect(leadSourceLabel("SHOP")).toBe("Shop");
    expect(leadSourceLabel("FACEBOOK")).toBe("Facebook");
    expect(leadSourceLabel("WHATSAPP")).toBe("WhatsApp");
    expect(leadSourceLabel("INSTAGRAM")).toBe("Instagram");
    expect(leadSourceLabel("PHONE_ENQUIRY")).toBe("Phone enquiry");
  });
  it("labels none as Not recorded", () => expect(leadSourceLabel("none")).toBe("Not recorded"));
  it("title-cases unknown values", () => {
    expect(leadSourceLabel("WALK_IN")).toBe("Walk In");
    expect(leadSourceLabel("")).toBe("Not recorded");
  });
});

