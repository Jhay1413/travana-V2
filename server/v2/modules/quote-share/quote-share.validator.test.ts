import { describe, it, expect } from "vitest";
import { markSentValidator } from "./quote-share.validator";

const id = "3f2b8c1e-5d4a-4e6b-9c7d-1a2b3c4d5e6f";
const parse = (body: unknown, params: unknown = { id }) => markSentValidator.safeParse({ params, body });

describe("markSentValidator", () => {
  it.each(["link", "sms", "email", "whatsapp"])("accepts sentVia %s", (sentVia) => {
    expect(parse({ sentVia }).success).toBe(true);
  });

  it("rejects an unknown channel", () => {
    const r = parse({ sentVia: "carrier-pigeon" });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.errors[0].message).toContain("sentVia must be one of");
  });

  it("rejects a missing sentVia, the old via key and extra keys", () => {
    expect(parse({}).success).toBe(false);
    expect(parse({ via: "link" }).success).toBe(false);
    expect(parse({ sentVia: "link", extra: 1 }).success).toBe(false);
  });

  it("rejects a non-uuid id", () => {
    expect(parse({ sentVia: "link" }, { id: "x" }).success).toBe(false);
  });
});
