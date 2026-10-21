import { describe, expect, it } from "vitest";
import { resolveSelectionTransactionId } from "./holiday-transaction";

const transactions = [
  { id: "t1", enquiry: { id: "e1" }, quotes: [{ id: "q1" }, { id: "q2" }], booking: null },
  { id: "t2", enquiry: null, quotes: [], booking: { id: "b1" } },
];

describe("resolveSelectionTransactionId", () => {
  it("returns null with no selection", () => {
    expect(resolveSelectionTransactionId(null, transactions)).toBeNull();
  });
  it("finds the transaction for an enquiry, a quote variant and a booking", () => {
    expect(resolveSelectionTransactionId({ type: "enquiry", id: "e1" }, transactions)).toBe("t1");
    expect(resolveSelectionTransactionId({ type: "quote", id: "q2" }, transactions)).toBe("t1");
    expect(resolveSelectionTransactionId({ type: "booking", id: "b1" }, transactions)).toBe("t2");
  });
  it("does not match an id of a different kind or an unknown id", () => {
    expect(resolveSelectionTransactionId({ type: "quote", id: "e1" }, transactions)).toBeNull();
    expect(resolveSelectionTransactionId({ type: "booking", id: "zzz" }, transactions)).toBeNull();
  });
});
