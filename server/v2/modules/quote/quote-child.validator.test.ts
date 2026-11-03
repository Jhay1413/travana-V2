import { describe, it, expect } from "vitest";
import {
  addFlightValidator,
  updateFlightValidator,
  addAccommodationValidator,
  updateAccommodationValidator,
  addTransferValidator,
  addPassengerValidator,
  withoutProtectedKeys,
} from "./quote-child.validator";
import { addBookingFlightValidator, addBookingAccommodationValidator } from "../booking/booking.validator";

const Q = "6f1c2f0e-8c3a-4a39-9d1e-2f6c5b9f7a11";
const C = "0a7d4c53-1b2e-4f60-8a91-3c5d7e9f1b22";
const OTHER = "11111111-2222-4333-8444-555555555555";

const ok = (schema: { safeParse: (v: unknown) => { success: boolean } }, value: unknown) => schema.safeParse(value).success;

describe("quote child validators", () => {
  it("accept a normal edit", () => {
    expect(ok(updateFlightValidator, { params: { id: Q, flightId: C }, body: { flight_number: "BA1", cost: "10.00", departure_date_time: "2027-06-14T07:30:00" } })).toBe(true);
    expect(ok(updateAccommodationValidator, { params: { id: Q, accommodationId: C }, body: { room_type: "Double", no_of_nights: 7 } })).toBe(true);
    expect(ok(addTransferValidator, { params: { id: Q }, body: { pick_up_location: "A", cost: 40 } })).toBe(true);
    expect(ok(addPassengerValidator, { params: { id: Q }, body: { type: "child", age: 6 } })).toBe(true);
  });

  it("reject a body that sets id or quote_id (cannot re-parent a child into another quote)", () => {
    expect(ok(updateFlightValidator, { params: { id: Q, flightId: C }, body: { quote_id: OTHER } })).toBe(false);
    expect(ok(updateFlightValidator, { params: { id: Q, flightId: C }, body: { id: OTHER } })).toBe(false);
    expect(ok(updateAccommodationValidator, { params: { id: Q, accommodationId: C }, body: { quote_id: OTHER } })).toBe(false);
    expect(ok(addFlightValidator, { params: { id: Q }, body: { quote_id: OTHER } })).toBe(false);
    expect(ok(addAccommodationValidator, { params: { id: Q }, body: { quote_id: OTHER } })).toBe(false);
    expect(ok(addTransferValidator, { params: { id: Q }, body: { quote_id: OTHER } })).toBe(false);
    expect(ok(addPassengerValidator, { params: { id: Q }, body: { quote_id: OTHER } })).toBe(false);
  });

  it("reject bad ids and wrongly typed fields", () => {
    expect(ok(updateFlightValidator, { params: { id: "nope", flightId: C }, body: {} })).toBe(false);
    expect(ok(updateFlightValidator, { params: { id: Q, flightId: "nope" }, body: {} })).toBe(false);
    expect(ok(updateFlightValidator, { params: { id: Q, flightId: C }, body: { tour_operator_id: "not-a-uuid" } })).toBe(false);
    expect(ok(addPassengerValidator, { params: { id: Q }, body: { age: -1 } })).toBe(false);
  });

  it("booking child routes reject id and booking_id the same way", () => {
    expect(ok(addBookingFlightValidator, { params: { id: Q }, body: { flight_number: "X" } })).toBe(true);
    expect(ok(addBookingFlightValidator, { params: { id: Q }, body: { booking_id: OTHER } })).toBe(false);
    expect(ok(addBookingAccommodationValidator, { params: { id: Q }, body: { id: OTHER } })).toBe(false);
  });
});

describe("withoutProtectedKeys", () => {
  it("removes id, quote_id, booking_id and leg_order and keeps everything else", () => {
    expect(withoutProtectedKeys({ flight_number: "X", id: "a", quote_id: "b", booking_id: "c", leg_order: 3 })).toEqual({ flight_number: "X" });
  });
});
