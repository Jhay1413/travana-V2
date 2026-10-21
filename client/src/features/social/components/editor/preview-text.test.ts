import { describe, expect, it } from "vitest";
import { escapeHtml, postToPlainText, postToPreviewHtml, truncateText } from "./preview-text";

describe("postToPlainText", () => {
  it("strips tags and keeps line breaks as newlines", () => {
    expect(postToPlainText("Hello<br>World")).toBe("Hello\nWorld");
    expect(postToPlainText("Hello\nWorld")).toBe("Hello\nWorld");
  });
  it("decodes entities", () => {
    expect(postToPlainText("Fish &amp; chips &lt;3")).toBe("Fish & chips <3");
  });
  it("trims", () => {
    expect(postToPlainText("  hi  ")).toBe("hi");
  });
});

describe("truncateText", () => {
  it("leaves short text alone", () => {
    expect(truncateText("short", 10)).toEqual({ text: "short", truncated: false });
    expect(truncateText("exactly10!", 10)).toEqual({ text: "exactly10!", truncated: false });
  });
  it("cuts at a word boundary", () => {
    expect(truncateText("hello wonderful world", 12)).toEqual({ text: "hello", truncated: true });
  });
  it("keeps the full head when the cut lands on a space", () => {
    expect(truncateText("hello world again", 11)).toEqual({ text: "hello world", truncated: true });
  });
  it("hard-cuts a single long word", () => {
    expect(truncateText("abcdefghijkl", 5)).toEqual({ text: "abcde", truncated: true });
  });
});

describe("escapeHtml", () => {
  it("escapes <, >, & and quotes", () => {
    expect(escapeHtml(`<b>"Tom" & 'Jerry'</b>`)).toBe(
      "&lt;b&gt;&quot;Tom&quot; &amp; &#39;Jerry&#39;&lt;/b&gt;",
    );
  });
});

describe("postToPreviewHtml", () => {
  it("strips markup and escapes the remaining text", () => {
    const out = postToPreviewHtml('Hi<script>alert(1)</script><img src=x onerror="alert(1)">');
    expect(out).not.toMatch(/<script|<img|onerror=\"/i);
  });
  it("escapes entity-encoded markup so it cannot be re-parsed as HTML", () => {
    expect(postToPreviewHtml("&lt;img src=x onerror=alert(1)&gt;")).toBe("&lt;img src=x onerror=alert(1)&gt;");
  });
  it("turns line breaks into <br>", () => {
    expect(postToPreviewHtml("a<br>\nb")).toBe("a<br>b");
  });
});
