import { describe, expect, it } from "vitest";
import { toSaveResult } from "./enquiry-save-result";

describe("toSaveResult", () => {
  it("returns the ids with the client", () => {
    expect(toSaveResult({ id: "e1", transaction_id: "t1" }, "c1")).toEqual({ enquiryId: "e1", transactionId: "t1", clientId: "c1" });
  });

  it("is undefined when either id is missing", () => {
    expect(toSaveResult(undefined)).toBeUndefined();
    expect(toSaveResult(null)).toBeUndefined();
    expect(toSaveResult({ id: "e1" })).toBeUndefined();
    expect(toSaveResult({ transaction_id: "t1" })).toBeUndefined();
  });
});
