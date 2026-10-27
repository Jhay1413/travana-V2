import { describe, expect, it } from "vitest";
import { toOnlySocialsBody } from "./social-post-body";

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
