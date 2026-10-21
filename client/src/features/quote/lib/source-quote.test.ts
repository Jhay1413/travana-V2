import { describe, expect, it } from "vitest";
import { sourceQuoteField } from "./source-quote";

describe("sourceQuoteField", () => {
  it("includes the source quote id when set", () => {
    expect(sourceQuoteField("q1")).toEqual({ source_quote_id: "q1" });
  });
  it("adds nothing when absent", () => {
    expect(sourceQuoteField(undefined)).toEqual({});
    expect(sourceQuoteField(null)).toEqual({});
    expect(sourceQuoteField("")).toEqual({});
  });
});
