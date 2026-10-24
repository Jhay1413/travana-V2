import { describe, expect, it } from "vitest";
import { whatsAppLink } from "./whatsapp-link";

describe("whatsAppLink", () => {
  it("keeps an international number", () => {
    expect(whatsAppLink("+44 7700 900123")).toBe("https://wa.me/447700900123");
  });
  it("converts a leading UK 0 to 44", () => {
    expect(whatsAppLink("07700 900123")).toBe("https://wa.me/447700900123");
  });
  it("handles a 00 international prefix", () => {
    expect(whatsAppLink("0044 7700 900123")).toBe("https://wa.me/447700900123");
  });
  it("drops the UK trunk 0 written after the country code", () => {
    expect(whatsAppLink("+44 (0)7700 900123")).toBe("https://wa.me/447700900123");
    expect(whatsAppLink("00 44 0 7700 900123")).toBe("https://wa.me/447700900123");
    expect(whatsAppLink("447700900123")).toBe("https://wa.me/447700900123");
  });
  it("returns null for too few digits or empty", () => {
    expect(whatsAppLink("abc")).toBeNull();
    expect(whatsAppLink("12345")).toBeNull();
    expect(whatsAppLink(null)).toBeNull();
  });
});
