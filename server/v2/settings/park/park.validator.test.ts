import { describe, it, expect } from "vitest";
import { createParkValidator, updateParkValidator, parkIdValidator } from "./park.validator";

const id = "5b0f6c1e-8f3a-4c1e-9d55-0a1f2b3c4d5e";

describe("createParkValidator", () => {
  it("accepts a name with optional fields, including empty strings", () => {
    expect(createParkValidator.safeParse({ body: { name: "Sunhaven", location: "", city: "Torquay", county: null, code: "SH1" } }).success).toBe(true);
  });

  it("requires a non-blank name", () => {
    expect(createParkValidator.safeParse({ body: {} }).success).toBe(false);
    expect(createParkValidator.safeParse({ body: { name: "   " } }).success).toBe(false);
  });

  it("rejects a name over 200 characters", () => {
    expect(createParkValidator.safeParse({ body: { name: "x".repeat(201) } }).success).toBe(false);
  });

  it("trims the name and strips unknown keys", () => {
    const r = createParkValidator.safeParse({ body: { name: "  Sunhaven  ", id: "evil", extra: 1 } });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.body).toEqual({ name: "Sunhaven" });
  });
});

describe("updateParkValidator", () => {
  it("accepts a partial body and requires a uuid id", () => {
    expect(updateParkValidator.safeParse({ params: { id }, body: { city: "Devon" } }).success).toBe(true);
    expect(updateParkValidator.safeParse({ params: { id: "nope" }, body: {} }).success).toBe(false);
  });

  it("rejects a blank name when one is sent", () => {
    expect(updateParkValidator.safeParse({ params: { id }, body: { name: "" } }).success).toBe(false);
  });
});

describe("parkIdValidator", () => {
  it("requires a uuid", () => {
    expect(parkIdValidator.safeParse({ params: { id } }).success).toBe(true);
    expect(parkIdValidator.safeParse({ params: { id: "x" } }).success).toBe(false);
  });
});
