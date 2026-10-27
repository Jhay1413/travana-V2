import { describe, expect, it } from "vitest";
import type { Transaction } from "@/features/quote/types";
import { operatorSubLine, quoteHeadline } from "./drawer-tour-operator";

const tx = (over: Record<string, unknown>) => over as unknown as Transaction;

describe("quoteHeadline", () => {
  it("uses the main (non-copy) quote's title first", () => {
    const t = tx({ quotes: [{ title: "Copy", isQuoteCopy: true }, { title: "Majorca 7 nights", isQuoteCopy: false }] });
    expect(quoteHeadline(t, "TUI")).toBe("Majorca 7 nights");
  });

  it("falls back to the booking title, then the operator, then 'Quote'", () => {
    expect(quoteHeadline(tx({ quotes: [], booking: { title: "Booked trip" } }), "TUI")).toBe("Booked trip");
    expect(quoteHeadline(tx({}), "TUI")).toBe("TUI");
    expect(quoteHeadline(tx({}), null)).toBe("Quote");
  });
});

describe("operatorSubLine", () => {
  it("shows the operator with the quote ref when there is one", () => {
    expect(operatorSubLine(tx({ quotes: [{ title: "A", quote_ref: "Q123" }] }), "Jet2")).toBe("Jet2 · Quote ref Q123");
  });

  it("shows just the operator, or a placeholder when none is set", () => {
    expect(operatorSubLine(tx({ quotes: [{ title: "A" }] }), "Jet2")).toBe("Jet2");
    expect(operatorSubLine(tx({}), null)).toBe("No tour operator");
  });
});
