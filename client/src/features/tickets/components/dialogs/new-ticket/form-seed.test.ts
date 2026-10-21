import { describe, expect, it } from "vitest";
import { seededTransactionId, validTransactionId } from "./form-seed";

describe("seededTransactionId", () => {
  it("keeps the holiday for the client it came with", () => {
    expect(seededTransactionId("c1", "c1", "t1")).toBe("t1");
  });
  it("drops it for a different client", () => {
    expect(seededTransactionId("c2", "c1", "t1")).toBe("");
  });
  it("is empty without a client, an initial client or an initial holiday", () => {
    expect(seededTransactionId(null, "c1", "t1")).toBe("");
    expect(seededTransactionId("c1", undefined, "t1")).toBe("");
    expect(seededTransactionId("c1", "c1", undefined)).toBe("");
  });
});

describe("validTransactionId", () => {
  it("keeps an id that is among the client's holidays", () => {
    expect(validTransactionId("t1", ["t0", "t1"])).toBe("t1");
  });
  it("clears an id that is not among them, or when there are none", () => {
    expect(validTransactionId("tX", ["t0", "t1"])).toBe("");
    expect(validTransactionId("t1", [])).toBe("");
    expect(validTransactionId("", ["t1"])).toBe("");
  });
});
