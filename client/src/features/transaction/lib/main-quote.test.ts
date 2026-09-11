import { describe, expect, it } from "vitest";
import { holidayLabelOf, mainQuoteOf } from "./main-quote";
import type { Booking, EnquiryTable, Quote, Transaction } from "@/features/quote/types";

function makeTransaction(overrides: Partial<Transaction> = {}): Transaction {
  return {
    id: "txn-1",
    status: null,
    is_active: true,
    client_id: "client-1",
    agent_id: null,
    lead_source: null,
    user_id: "user-1",
    created_at: "2024-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    id: "quote-1",
    transaction_id: "txn-1",
    deal_id: null,
    holiday_type_id: "ht-1",
    sales_price: null,
    package_commission: null,
    travel_date: "2024-06-01",
    discounts: null,
    service_charge: null,
    num_of_nights: 7,
    pets: 0,
    cottage_id: null,
    lodge_id: null,
    park_id: null,
    quote_type: "standard",
    deal_type: null,
    pre_booked_seats: null,
    flight_meals: null,
    infant: null,
    child: null,
    adult: null,
    title: "Quote title",
    price_per_person: "100",
    lodge_type: null,
    transfer_type: "none",
    quote_status: "draft",
    main_tour_operator_id: null,
    date_created: null,
    date_expiry: null,
    is_future_deal: null,
    future_deal_date: null,
    is_active: true,
    quote_ref: null,
    isQuoteCopy: false,
    parent_quote_id: null,
    isFreeQuote: null,
    show_on_portal: null,
    portal_added_at: null,
    is_featured: null,
    not_for_social: null,
    ...overrides,
  };
}

function makeBooking(overrides: Partial<Booking> = {}): Booking {
  return {
    id: "booking-1",
    transaction_id: "txn-1",
    deal_type: null,
    pre_booked_seats: null,
    flight_meals: null,
    holiday_type_id: "ht-1",
    hays_ref: "H1",
    supplier_ref: "S1",
    is_active: true,
    sales_price: null,
    package_commission: null,
    travel_date: "2024-07-01",
    title: "Booking title",
    discounts: null,
    service_charge: null,
    num_of_nights: 7,
    pets: 0,
    cottage_id: null,
    lodge_id: null,
    lodge_type: null,
    transfer_type: null,
    infant: 0,
    child: 0,
    adult: 2,
    booking_status: "confirmed",
    main_tour_operator_id: null,
    date_created: null,
    price_per_person: null,
    wallet_credit: null,
    ...overrides,
  };
}

function makeEnquiry(overrides: Partial<EnquiryTable> = {}): EnquiryTable {
  return {
    id: "enquiry-1",
    transaction_id: "txn-1",
    holiday_type_id: "ht-1",
    accomodation_type_id: null,
    travel_date: "2024-08-01",
    adults: 2,
    children: 0,
    infants: 0,
    cabin_type: null,
    title: "Enquiry title",
    flexibility_date: null,
    flexible_date: null,
    weekend_lodge: null,
    accom_min_star_rating: null,
    no_of_nights: 5,
    flexible_nights: null,
    budget: "1000",
    max_budget: null,
    budget_type: "total",
    no_of_guests: null,
    no_of_pets: null,
    pre_cruise_stay: null,
    post_cruise_stay: null,
    status: "open",
    date_created: null,
    date_expiry: null,
    is_future_deal: null,
    future_deal_date: null,
    is_active: true,
    deletion_code: null,
    email: null,
    ...overrides,
  };
}

describe("mainQuoteOf", () => {
  it("returns the non-copy quote when one exists among copies", () => {
    const copy = makeQuote({ id: "copy-1", isQuoteCopy: true });
    const main = makeQuote({ id: "main-1", isQuoteCopy: false });
    const transaction = makeTransaction({ quotes: [copy, main] });
    expect(mainQuoteOf(transaction)?.id).toBe("main-1");
  });

  it("falls back to the first quote when every quote is a copy", () => {
    const first = makeQuote({ id: "copy-1", isQuoteCopy: true });
    const second = makeQuote({ id: "copy-2", isQuoteCopy: true });
    const transaction = makeTransaction({ quotes: [first, second] });
    expect(mainQuoteOf(transaction)?.id).toBe("copy-1");
  });

  it("returns undefined when there are no quotes", () => {
    expect(mainQuoteOf(makeTransaction())).toBeUndefined();
  });
});

describe("holidayLabelOf", () => {
  it("picks the booking when status is on_booking", () => {
    const transaction = makeTransaction({ status: "on_booking", booking: makeBooking() });
    expect(holidayLabelOf(transaction)).toEqual({ kind: "booking", title: "Booking title", date: "2024-07-01" });
  });

  it("picks the main quote when status is on_quote", () => {
    const copy = makeQuote({ id: "copy-1", isQuoteCopy: true, title: "Copy" });
    const main = makeQuote({ id: "main-1", isQuoteCopy: false, title: "Main quote" });
    const transaction = makeTransaction({ status: "on_quote", quotes: [copy, main] });
    expect(holidayLabelOf(transaction)).toEqual({ kind: "quote", title: "Main quote", date: "2024-06-01" });
  });

  it("picks the enquiry when status is on_enquiry", () => {
    const transaction = makeTransaction({ status: "on_enquiry", enquiry: makeEnquiry() });
    expect(holidayLabelOf(transaction)).toEqual({ kind: "enquiry", title: "Enquiry title", date: "2024-08-01" });
  });

  it("falls back to the booking when status is missing but a booking is present", () => {
    const transaction = makeTransaction({ booking: makeBooking() });
    expect(holidayLabelOf(transaction).kind).toBe("booking");
  });

  it("falls back to the main quote when status is missing but quotes are present", () => {
    const transaction = makeTransaction({ quotes: [makeQuote()] });
    expect(holidayLabelOf(transaction).kind).toBe("quote");
  });

  it("falls back to the enquiry when status is missing and only an enquiry is present", () => {
    const transaction = makeTransaction({ enquiry: makeEnquiry() });
    expect(holidayLabelOf(transaction).kind).toBe("enquiry");
  });

  it("uses fallback titles when the relation's title is missing", () => {
    const transaction = makeTransaction({ status: "on_booking", booking: makeBooking({ title: null }) });
    expect(holidayLabelOf(transaction).title).toBe("Untitled booking");
  });

  it("returns a null kind when the transaction has no relations at all", () => {
    expect(holidayLabelOf(makeTransaction())).toEqual({ kind: null, title: "Untitled", date: null });
  });
});
