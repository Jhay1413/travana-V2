import { describe, expect, it } from "vitest";
import type { Transaction } from "@/features/quote/types";
import { DEFAULT_PIPELINE_SORT, PIPELINE_SORT_OPTIONS, activeFilterCount, sortLabel } from "./pipeline-board-filters";
import { quietLabel } from "./quiet";
import { addDaysToKey, isLondonTomorrow, isSameLondonDay, londonDayKey } from "@/lib/london-day";
import { isDueToday } from "./deal-meta";
import {
  formatCurrency,
  formatDueDateTime,
  getClientPhone,
  getDestinationName,
  getEnquiryBudget,
  getStageForTransaction,
  getTourOperator,
  getTransactionDate,
  getTransactionNavUrl,
  getTransactionTitle,
} from "./pipeline-helpers";

const tx = (p: Record<string, unknown>) => ({ id: "abcdef123456", created_at: "2026-10-01T00:00:00Z", ...p }) as unknown as Transaction;

describe("pipeline-board-filters extras", () => {
  it("exposes the default sort and its options", () => {
    expect(DEFAULT_PIPELINE_SORT).toBe("latest_activity");
    expect(PIPELINE_SORT_OPTIONS.map((o) => o.value)).toEqual(["latest_activity", "value_desc", "profit_desc", "quiet_first", "name_asc"]);
  });
  it("sortLabel maps values and falls back", () => {
    expect(sortLabel("quiet_first")).toBe("Quietest first");
    expect(sortLabel("newest")).toBe("Latest activity");
  });
  it("activeFilterCount adds priorities and operators", () => {
    expect(activeFilterCount(new Set(["low", "high"] as const), new Set(["a"]))).toBe(3);
    expect(activeFilterCount(new Set(), new Set())).toBe(0);
  });
});

describe("quietLabel", () => {
  it("pluralises", () => {
    expect(quietLabel(1)).toBe("1 day quiet");
    expect(quietLabel(9)).toBe("9 days quiet");
  });
});

describe("Europe/London day boundaries", () => {
  it("uses the London calendar day, not UTC", () => {
    // 23:30 UTC on 14 Oct is 00:30 BST on 15 Oct.
    expect(londonDayKey(new Date("2026-10-14T23:30:00Z"))).toBe("2026-10-15");
    expect(londonDayKey(new Date("2026-10-14T22:30:00Z"))).toBe("2026-10-14");
  });
  it("handles GMT after the clocks go back", () => {
    expect(londonDayKey(new Date("2026-11-01T23:30:00Z"))).toBe("2026-11-01");
  });
  it("addDaysToKey rolls over months", () => {
    expect(addDaysToKey("2026-10-31", 1)).toBe("2026-11-01");
  });
  it("same-day and tomorrow checks", () => {
    const now = new Date("2026-10-15T10:00:00Z");
    expect(isSameLondonDay(new Date("2026-10-15T22:59:00Z"), now)).toBe(true);
    expect(isSameLondonDay(new Date("2026-10-15T23:00:00Z"), now)).toBe(false); // 00:00 BST on the 16th
    expect(isLondonTomorrow(new Date("2026-10-15T23:00:00Z"), now)).toBe(true);
    expect(isLondonTomorrow(new Date("2026-10-16T23:00:00Z"), now)).toBe(false);
  });
  it("isDueToday and the Today / Tomorrow labels agree", () => {
    const now = new Date("2026-10-15T10:00:00Z");
    expect(isDueToday("2026-10-15T22:30:00Z", now)).toBe(true);
    expect(isDueToday("2026-10-15T23:30:00Z", now)).toBe(false);
    expect(formatDueDateTime("2026-10-15T23:30:00Z", now).startsWith("Tomorrow")).toBe(true);
  });
});

describe("pipeline-helpers getters", () => {
  it("formatCurrency is whole pounds", () => {
    expect(formatCurrency(1234.6)).toBe("£1,235");
  });
  it("title falls through enquiry, quote, booking, id", () => {
    expect(getTransactionTitle(tx({ enquiry: { title: "E" }, quotes: [{ title: "Q" }] }))).toBe("E");
    expect(getTransactionTitle(tx({ quotes: [{ title: "Q" }] }))).toBe("Q");
    expect(getTransactionTitle(tx({ booking: { title: "B" } }))).toBe("B");
    expect(getTransactionTitle(tx({}))).toBe("#abcdef12");
  });
  it("date and destination fall through", () => {
    expect(getTransactionDate(tx({ quotes: [{ travel_date: "2026-05-01" }] }))).toBe("2026-05-01");
    expect(getTransactionDate(tx({}))).toBe("2026-10-01T00:00:00Z");
    expect(getDestinationName(tx({ enquiry: { destination_name: "Rome" } }))).toBe("Rome");
    expect(getDestinationName(tx({}))).toBeNull();
  });
  it("tour operator and phone", () => {
    expect(getTourOperator(tx({ quotes: [{ main_tour_operator_name: "TUI", main_tour_operator_logo_url: "u" }] }))).toEqual({ name: "TUI", logoUrl: "u" });
    expect(getTourOperator(tx({}))).toEqual({ name: null, logoUrl: null });
    expect(getClientPhone(tx({ client_phone: "0123" }))).toBe("0123");
    expect(getClientPhone(tx({ client_phone: "NULL" }))).toBeNull();
  });
  it("enquiry budget parses numbers only", () => {
    expect(getEnquiryBudget(tx({ enquiry: { budget: "2500" } }))).toBe(2500);
    expect(getEnquiryBudget(tx({ enquiry: { budget: "abc" } }))).toBeNull();
    expect(getEnquiryBudget(tx({}))).toBeNull();
  });
  it("getStageForTransaction", () => {
    expect(getStageForTransaction(tx({ status: "on_enquiry" }))).toBe("Enquiry");
    expect(getStageForTransaction(tx({ status: "on_booking" }))).toBe("Booked");
    expect(getStageForTransaction(tx({ status: "on_quote", quote_variants: [{ id: "1", isQuoteCopy: false, quote_status: "in_play" }] }))).toBe("In Play");
    expect(getStageForTransaction(tx({ status: "on_quote", quote_variants: [] }))).toBe("Quoted");
  });
  it("getTransactionNavUrl", () => {
    expect(getTransactionNavUrl(tx({}), "Enquiry")).toBe("/pipeline");
    expect(getTransactionNavUrl(tx({ client_id: "c", enquiry: { id: "e" } }), "Enquiry")).toBe("/clients/c?holiday=enquiry:e");
    expect(getTransactionNavUrl(tx({ client_id: "c", quotes: [{ id: "q" }] }), "Quoted")).toBe("/clients/c?holiday=quote:q");
    expect(getTransactionNavUrl(tx({ client_id: "c", booking: { id: "b" } }), "Booked")).toBe("/clients/c?holiday=booking:b");
    expect(getTransactionNavUrl(tx({ client_id: "c" }), "Lost")).toBe("/clients/c");
  });
});
