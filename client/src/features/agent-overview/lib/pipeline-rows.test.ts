import { describe, expect, it } from "vitest";
import type { Transaction } from "@/features/quote/types";
import { recentPipelineRows, toPipelineListRow } from "./pipeline-rows";

const deal = (over: Record<string, unknown>): Transaction =>
  ({ id: "abcdef1234567890", created_at: "2026-10-01T10:00:00Z", client_id: null, ...over }) as unknown as Transaction;

describe("pipeline list rows", () => {
  it("uses the stage-aware profit (quotes sum package + service commission)", () => {
    const t = deal({
      status: "on_quote",
      client: { name: "Ann Lee" },
      quotes: [{ title: "Crete", package_commission: "120", service_commission: "30" }],
      quote_variants: [{ isQuoteCopy: false, quote_status: "sent" }],
    });
    const row = toPipelineListRow(t);
    expect(row.profit).toBe(150);
    expect(row.stage).toBe("Quoted");
    expect(row.customer).toBe("Ann Lee");
    expect(row.title).toBe("Crete");
  });

  it("reads the booking row for booked deals and zero for enquiries", () => {
    const booked = deal({ status: "on_booking", booking: { title: "Rhodes", package_commission: "200" } });
    expect(toPipelineListRow(booked).profit).toBe(200);
    expect(toPipelineListRow(booked).stage).toBe("Booked");
    expect(toPipelineListRow(deal({ status: "on_enquiry", enquiry: { title: "x" } })).profit).toBe(0);
  });

  it("returns the newest five", () => {
    const deals = Array.from({ length: 8 }, (_, i) =>
      deal({ id: `id-${i}`, status: "on_enquiry", created_at: `2026-10-0${i + 1}T10:00:00Z` }),
    );
    const rows = recentPipelineRows(deals);
    expect(rows).toHaveLength(5);
    expect(rows[0].id).toBe("id-7");
  });
});
