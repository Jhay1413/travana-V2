import { describe, expect, it } from "vitest";
import { onlySocialsPlainLength, toOnlySocialsBody } from "./social-post-body";

describe("toOnlySocialsBody span repair", () => {
  it("removes real span tags, keeping inner text", () => {
    expect(toOnlySocialsBody('£99 <span style="color: rgb(18, 18, 22);">pp</span>')).toBe("£99 pp");
  });

  it("removes escaped span tags case-insensitively", () => {
    expect(toOnlySocialsBody('£99 &lt;SPAN style="color: red;"&gt;pp&lt;/span&gt;')).toBe("£99 pp");
  });

  it("keeps other escaped text and is idempotent", () => {
    const once = toOnlySocialsBody("a &lt; b<br>\nc &lt;span&gt;x&lt;/span&gt;");
    expect(once).toBe("a &lt; b<br>\nc x");
    expect(toOnlySocialsBody(once)).toBe(once);
  });
});

describe("onlySocialsPlainLength", () => {
  it("counts each line break as one character, not as the <br> markup", () => {
    expect(onlySocialsPlainLength(toOnlySocialsBody("ab\n\ncd"))).toBe("ab\n\ncd".length);
    expect(onlySocialsPlainLength("a<br>\nb")).toBe(3);
  });
  it("counts emoji as one character each", () => {
    expect(onlySocialsPlainLength("🌴🌴")).toBe(2);
  });
});

describe("onlySocialsPlainLength entities", () => {
  it("counts an escaped character as the one character it stands for", () => {
    expect(onlySocialsPlainLength("Tom &amp; Jerry")).toBe("Tom & Jerry".length);
    expect(onlySocialsPlainLength("a &lt; b &gt; c")).toBe("a < b > c".length);
    expect(onlySocialsPlainLength("&quot;hi&quot; &#39;x&#39;")).toBe(`"hi" 'x'`.length);
    expect(onlySocialsPlainLength("a&nbsp;b")).toBe(3);
    expect(onlySocialsPlainLength("&#128512; &#x1F600;")).toBe(3);
  });
  it("leaves an unknown entity alone", () => {
    expect(onlySocialsPlainLength("&nope;")).toBe(6);
  });
});
