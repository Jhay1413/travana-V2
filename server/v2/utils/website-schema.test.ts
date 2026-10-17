import { describe, it, expect } from "vitest";
import { websiteSchema } from "./website-schema";

describe("websiteSchema", () => {
  it.each(["", "https://acme.com", "http://acme.com/path?x=1"])("accepts %j", (v) => {
    expect(websiteSchema.safeParse(v).success).toBe(true);
  });

  it.each(["javascript:alert(1)", "ftp://acme.com", "acme.com", "not a url"])("rejects %j", (v) => {
    expect(websiteSchema.safeParse(v).success).toBe(false);
  });
});
