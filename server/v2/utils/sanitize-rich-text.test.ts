import { describe, it, expect } from "vitest";
import { sanitizeRichText } from "./sanitize-rich-text";

describe("sanitizeRichText idempotence", () => {
  const samples = [
    "a &amp; b",
    "a &lt; b &gt; c",
    "Tom & Jerry",
    "a < b",
    "&amp;amp;",
    '<p>x</p><script>alert(1)</script><a href="javascript:alert(1)">l</a>',
    '<p><strong>b</strong> <a href="https://x.com?a=1&amp;b=2">l</a></p><ul><li>one</li></ul>',
    "Quote Request:\n• Destination: Rome",
  ];
  it.each(samples)("sanitising twice equals once: %s", (input) => {
    const once = sanitizeRichText(input);
    expect(sanitizeRichText(once)).toBe(once);
  });

  it("does not double-escape ampersands", () => {
    expect(sanitizeRichText("a &amp; b")).toBe("a &amp; b");
    expect(sanitizeRichText(sanitizeRichText("a & b"))).toBe("a &amp; b");
  });
});
