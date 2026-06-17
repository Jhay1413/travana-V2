import { describe, it, expect } from "vitest";
import { createOrganizationSchema, updateOrganizationSchema } from "./organization.validator";

describe("createOrganizationSchema", () => {
  it("accepts a valid organization", () => {
    const result = createOrganizationSchema.safeParse({
      body: { name: "Acme", slug: "acme-co", plan: "growth" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects a slug with uppercase or spaces", () => {
    expect(createOrganizationSchema.safeParse({ body: { name: "Acme", slug: "Acme Co" } }).success).toBe(false);
  });

  it("rejects a slug shorter than 3 characters", () => {
    expect(createOrganizationSchema.safeParse({ body: { name: "Acme", slug: "ab" } }).success).toBe(false);
  });

  it("rejects an unknown plan", () => {
    expect(
      createOrganizationSchema.safeParse({ body: { name: "Acme", slug: "acme-co", plan: "ultra" } }).success,
    ).toBe(false);
  });
});

describe("updateOrganizationSchema", () => {
  it("rejects a brand color that is not a 6-digit hex", () => {
    expect(updateOrganizationSchema.safeParse({ body: { brandColor: "blue" } }).success).toBe(false);
    expect(updateOrganizationSchema.safeParse({ body: { brandColor: "#fff" } }).success).toBe(false);
  });

  it("accepts a valid 6-digit hex brand color", () => {
    expect(updateOrganizationSchema.safeParse({ body: { brandColor: "#1a2b3c" } }).success).toBe(true);
  });

  it("rejects a currency code that is not exactly 3 characters", () => {
    expect(updateOrganizationSchema.safeParse({ body: { settings: { currency: "POUND" } } }).success).toBe(false);
  });

  it("rejects a non-positive seat limit", () => {
    expect(updateOrganizationSchema.safeParse({ body: { seatLimit: 0 } }).success).toBe(false);
  });
});
