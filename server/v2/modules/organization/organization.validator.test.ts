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

describe("updateOrganizationSchema profile and branding settings", () => {
  const parse = (settings: Record<string, unknown>) =>
    updateOrganizationSchema.safeParse({ body: { settings } });

  it("accepts a full profile and keeps unknown keys", () => {
    const result = parse({
      profile: {
        phone: "0191 594 7999",
        email: "hi@acme.example",
        addressLine1: "1 High St",
        addressLine2: "",
        town: "Newcastle",
        county: "Tyne and Wear",
        postcode: "NE1 1AA",
      },
      custom: 1,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.body.settings).toHaveProperty("custom", 1);
  });

  it("allows an empty profile email but rejects an invalid one", () => {
    expect(parse({ profile: { email: "" } }).success).toBe(true);
    expect(parse({ profile: { email: "not-an-email" } }).success).toBe(false);
  });

  it("rejects over-long profile fields", () => {
    expect(parse({ profile: { postcode: "x".repeat(21) } }).success).toBe(false);
  });

  it("accepts a data URL or null for branding.iconUrl and rejects junk", () => {
    expect(parse({ branding: { iconUrl: "data:image/png;base64,AAAA" } }).success).toBe(true);
    expect(parse({ branding: { iconUrl: null } }).success).toBe(true);
    expect(parse({ branding: { iconUrl: "not a url" } }).success).toBe(false);
  });
});
