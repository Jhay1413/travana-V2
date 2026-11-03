import { describe, it, expect, vi } from "vitest";

vi.mock("../../config/database", async () => {
  const m = await import("../../test/capture-db");
  return { db: m.captureDb };
});

import { enquiry_table, quote, booking } from "@shared/schema";
import { pickCreateColumns } from "./transaction.repository";

const ENQ = new Set(["id", "transaction_id", "deleted_by", "deleted_at", "deletion_code", "date_created", "is_active"]);

describe("pickCreateColumns (deal create whitelist)", () => {
  it("keeps real columns and drops ids, parents, deletion and acceptance stamps, tokens and unknown keys", () => {
    const quoteOut = pickCreateColumns(
      quote,
      { id: "x", transaction_id: "t", title: "ok", sales_price: "1", quote_token: "tok", isFreeQuote: true, deleted_at: new Date(), accepted_at: new Date(), accepted_by: "u", deleted_by: "u", bogus: 1 },
      new Set(["id", "transaction_id", "deleted_by", "deleted_at", "isFreeQuote", "quote_token", "accepted_at", "accepted_by"]),
    );
    expect(quoteOut).toEqual({ title: "ok", sales_price: "1" });
  });

  it("works for enquiries and bookings too", () => {
    expect(pickCreateColumns(enquiry_table, { id: "x", title: "e", deleted_at: null, is_active: false, holiday_type_id: "h" }, ENQ)).toEqual({ title: "e", holiday_type_id: "h" });
    expect(pickCreateColumns(booking, { id: "x", hays_ref: "HAY-1", deleted_by: "u", quote_id: "q" }, new Set(["id", "deleted_by", "quote_id"]))).toEqual({ hays_ref: "HAY-1" });
  });
});
