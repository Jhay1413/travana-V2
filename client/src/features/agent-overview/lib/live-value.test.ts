import { describe, expect, it } from "vitest";
import type { Transaction } from "@/features/quote/types";
import { liveTitle, liveValueLabel } from "./live-value";

const deal = (over: Record<string, unknown>): Transaction =>
  ({ id: "abcdef1234567890", created_at: "2026-10-01T10:00:00Z", client_id: null, ...over }) as unknown as Transaction;

describe("liveValueLabel", () => {
  it("labels an enquiry budget", () => {
    const t = deal({ status: "on_enquiry", enquiry: { id: "e1", budget: "2500" } });
    expect(liveValueLabel(t, "enquiry")).toBe("Budget £2,500");
  });

  it("shows nothing for an enquiry without a budget", () => {
    expect(liveValueLabel(deal({ status: "on_enquiry", enquiry: { id: "e1", budget: null } }), "enquiry")).toBeNull();
    expect(liveValueLabel(deal({ status: "on_enquiry", enquiry: { id: "e1", budget: "0" } }), "enquiry")).toBeNull();
  });

  it("sums quote values (sales - discounts + service charge)", () => {
    const t = deal({
      status: "on_quote",
      quotes: [
        { sales_price: "1000", discounts: "100", service_charge: "50" },
        { sales_price: "500", discounts: "0", service_charge: "0" },
      ],
    });
    expect(liveValueLabel(t, "quotes")).toBe("£1,450");
  });

  it("shows £0 for a quote worth nothing", () => {
    const t = deal({ status: "on_quote", quotes: [{ sales_price: "0", discounts: "0", service_charge: "0" }] });
    expect(liveValueLabel(t, "quotes")).toBe("£0");
  });

  it("reads the booking row for bookings", () => {
    const t = deal({ status: "on_booking", booking: { sales_price: "3200", discounts: "0", service_charge: "0" } });
    expect(liveValueLabel(t, "bookings")).toBe("£3,200");
  });
});


describe("liveTitle", () => {
  const t = deal({
    status: "on_quote",
    enquiry: { title: "Enquiry title" },
    quotes: [{ title: "Quote title" }],
    booking: { title: "Booking title" },
  });

  it("uses the active tab's entity first", () => {
    expect(liveTitle(t, "enquiry")).toBe("Enquiry title");
    expect(liveTitle(t, "quotes")).toBe("Quote title");
    expect(liveTitle(t, "bookings")).toBe("Booking title");
  });

  it("falls back quote, booking, enquiry, then a short id", () => {
    expect(liveTitle(deal({ enquiry: { title: "E" }, quotes: [{ title: "Q" }] }), "bookings")).toBe("Q");
    expect(liveTitle(deal({ enquiry: { title: "E" } }), "quotes")).toBe("E");
    expect(liveTitle(deal({}), "quotes")).toBe("#abcdef12");
  });
});
