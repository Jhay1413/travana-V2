import { describe, it, expect } from "vitest";
import { createLodgeValidator, updateLodgeValidator } from "./lodge.validator";

const parkId = "5b0f6c1e-8f3a-4c1e-9d55-0a1f2b3c4d5e";

describe("createLodgeValidator", () => {
  it("accepts a lodge with a uuid park_id and name", () => {
    const r = createLodgeValidator.safeParse({ body: { park_id: parkId, lodge_name: "Lakeside", sleeps: 4 } });
    expect(r.success).toBe(true);
  });

  it("requires lodge_name", () => {
    expect(createLodgeValidator.safeParse({ body: { park_id: parkId } }).success).toBe(false);
    expect(createLodgeValidator.safeParse({ body: { park_id: parkId, lodge_name: "  " } }).success).toBe(false);
  });

  it("rejects a non-uuid park_id", () => {
    expect(createLodgeValidator.safeParse({ body: { park_id: "abc", lodge_name: "X" } }).success).toBe(false);
  });

  it("allows creating without a park", () => {
    expect(createLodgeValidator.safeParse({ body: { lodge_name: "X" } }).success).toBe(true);
  });

  it("rejects negative counts", () => {
    expect(createLodgeValidator.safeParse({ body: { lodge_name: "X", sleeps: -1 } }).success).toBe(false);
  });
});

describe("updateLodgeValidator", () => {
  it("accepts a partial body and requires a uuid id", () => {
    expect(updateLodgeValidator.safeParse({ params: { id: parkId }, body: { sleeps: 2 } }).success).toBe(true);
    expect(updateLodgeValidator.safeParse({ params: { id: "nope" }, body: {} }).success).toBe(false);
  });
});
