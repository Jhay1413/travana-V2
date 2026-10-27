import { describe, expect, it } from "vitest";
import { planShareSend } from "./quote-share-send";

describe("planShareSend", () => {
  it("sends on WhatsApp when a client and quote are attached", () => {
    expect(planShareSend({ clientId: "c1", quoteId: "q1" })).toBe("whatsapp");
  });

  it("is a plain copy without a client", () => {
    expect(planShareSend({ quoteId: "q1" })).toBe("link");
    expect(planShareSend({ clientId: "", quoteId: "q1" })).toBe("link");
  });

  it("is a plain copy without a quote id", () => {
    expect(planShareSend({ clientId: "c1" })).toBe("link");
  });
});
