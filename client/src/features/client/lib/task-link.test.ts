import { describe, expect, it } from "vitest";
import type { Transaction } from "@/features/quote/types";
import { dealKey, linkedTaskEntity, liveDealOptions, taskEntityForDeal } from "./task-link";

const FUTURE = "2999-01-01T00:00:00.000Z";
const PAST = "2000-01-01T00:00:00.000Z";

function txn(parts: Record<string, unknown>): Transaction {
  return { id: "t", status: null, is_active: true, client_id: "c1", agent_id: null, lead_source: null, user_id: "u1", created_at: FUTURE, ...parts } as unknown as Transaction;
}
const quote = (parts: Record<string, unknown>) => ({ quote_status: "sent", date_expiry: FUTURE, transaction_id: "t", title: "Quote", ...parts });

describe("liveDealOptions", () => {
  it("lists live quotes, bookings and enquiries in that order, with destination and dates", () => {
    const options = liveDealOptions([
      txn({ id: "t1", enquiry: { id: "e1", title: "Maldives", status: "open", destinations: [{ name: "Maldives" }] }, quotes: [quote({ id: "q1", transaction_id: "t1", destination_name: "Tenerife" })] }),
      txn({ id: "t2", booking: { id: "b1", transaction_id: "t2", title: "Hard Rock", travel_date: FUTURE, sales_price: "100" } }),
    ]);
    expect(options.map((o) => [o.type, o.id, o.title])).toEqual([
      ["quote", "q1", "Quote"],
      ["booking", "b1", "Hard Rock"],
      ["enquiry", "e1", "Maldives"],
    ]);
    expect(options[0].detail).toBe("Tenerife");
    expect(options[2].detail).toBe("Maldives");
  });

  it("leaves out expired and lost deals", () => {
    const options = liveDealOptions([
      txn({
        id: "t1",
        enquiry: { id: "e-lost", title: "Lost", status: "lost" },
        quotes: [quote({ id: "q-exp", transaction_id: "t1", date_expiry: PAST }), quote({ id: "q-lost", transaction_id: "t1", quote_status: "lost" }), quote({ id: "q-ok", transaction_id: "t1" })],
      }),
      txn({ id: "t2", booking: { id: "b-past", transaction_id: "t2", title: "Gone", travel_date: PAST } }),
      txn({ id: "t3", booking: { id: "b-lost", transaction_id: "t3", title: "Lost", travel_date: FUTURE, booking_status: "LOST" } }),
    ]);
    expect(options.map((o) => o.id)).toEqual(["q-ok"]);
  });

  it("shows a booked transaction once, as the booking, and includes live copy quotes", () => {
    const options = liveDealOptions([
      txn({ id: "t1", quotes: [quote({ id: "q1", transaction_id: "t1" })], booking: { id: "b1", transaction_id: "t1", title: "Booked", travel_date: FUTURE } }),
      txn({ id: "t2", quotes: [quote({ id: "q2", transaction_id: "t2" }), quote({ id: "q2c", transaction_id: "t2", isQuoteCopy: true, parent_quote_id: "q2" })] }),
    ]);
    expect(options.map((o) => `${o.type}:${o.id}`)).toEqual(["quote:q2", "quote:q2c", "booking:b1"]);
  });

  it("is empty with no transactions", () => {
    expect(liveDealOptions([])).toEqual([]);
  });
});

describe("taskEntityForDeal", () => {
  it("stores booking tasks under the quote entity type, as the booking page lists them", () => {
    expect(taskEntityForDeal({ type: "booking", id: "b1" })).toEqual({ entityType: "quote", entityId: "b1" });
    expect(taskEntityForDeal({ type: "quote", id: "q1" })).toEqual({ entityType: "quote", entityId: "q1" });
    expect(taskEntityForDeal({ type: "enquiry", id: "e1" })).toEqual({ entityType: "enquiry", entityId: "e1" });
  });
  it("linkedTaskEntity: caller entity wins, then deal, then client, else nothing", () => {
    expect(linkedTaskEntity({ entityType: "enquiry", entityId: "e1", deal: { type: "quote", id: "q1" }, clientId: "c1" })).toEqual({ entityType: "enquiry", entityId: "e1" });
    expect(linkedTaskEntity({ deal: { type: "booking", id: "b1" }, clientId: "c1" })).toEqual({ entityType: "quote", entityId: "b1" });
    expect(linkedTaskEntity({ deal: null, clientId: "c1" })).toEqual({ entityType: "client", entityId: "c1" });
    expect(linkedTaskEntity({ entityType: "quote", entityId: undefined, deal: null, clientId: null })).toEqual({});
  });
  it("keys options by type and id", () => {
    expect(dealKey({ type: "booking", id: "b1" })).toBe("booking:b1");
  });
});
