import { describe, it, expect } from "vitest";
import { portalBrandingBySlugValidator } from "./portal-branding.validator";
import { portalPinResetValidator } from "./portal-pin-reset.validator";

describe("portalBrandingBySlugValidator", () => {
  const parse = (slug: unknown) => portalBrandingBySlugValidator.safeParse({ params: { slug } });

  it("accepts any short slug, even a made-up or malformed one (the service answers neutrally)", () => {
    expect(parse("sunny-travel").success).toBe(true);
    expect(parse("Not A Slug!").success).toBe(true);
  });

  it("rejects an empty or over-long slug", () => {
    expect(parse("").success).toBe(false);
    expect(parse("a".repeat(101)).success).toBe(false);
  });
});

describe("portalPinResetValidator", () => {
  const parse = (body: unknown) => portalPinResetValidator.safeParse({ body });

  it("accepts an email with an optional agency", () => {
    expect(parse({ email: "a@b.co" }).success).toBe(true);
    expect(parse({ email: "a@b.co", org: "sunny" }).success).toBe(true);
  });

  it("trims the email", () => {
    const r = parse({ email: "  a@b.co " });
    expect(r.success && r.data.body.email).toBe("a@b.co");
  });

  it("accepts a junk agency value (it is ignored, never an error)", () => {
    expect(parse({ email: "a@b.co", org: "???" }).success).toBe(true);
  });

  it("rejects a bad or missing email, an over-long email and an over-long agency", () => {
    expect(parse({ email: "nope" }).success).toBe(false);
    expect(parse({}).success).toBe(false);
    expect(parse({ email: `${"a".repeat(250)}@b.co` }).success).toBe(false);
    expect(parse({ email: "a@b.co", org: "x".repeat(101) }).success).toBe(false);
  });
});
