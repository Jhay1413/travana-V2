import { describe, expect, it } from "vitest";
import { toOnlySocialsBody } from "@shared/social-post-body";

describe("toOnlySocialsBody", () => {
  it("turns bare newlines into <br>", () => {
    expect(toOnlySocialsBody("Why You'll Love It:\n🌴 Lush, tropical gardens")).toBe(
      "Why You'll Love It:<br>\n🌴 Lush, tropical gardens"
    );
    expect(toOnlySocialsBody("unforgettable getaway!\nTUI")).toBe("unforgettable getaway!<br>\nTUI");
  });

  it("keeps template <br>\n as a single break and preserves blank lines", () => {
    const input = "£554pp<br>\n<br>\n🌞 Why You'll Love It:\n🌴 Lush";
    expect(toOnlySocialsBody(input)).toBe("£554pp<br>\n<br>\n🌞 Why You'll Love It:<br>\n🌴 Lush");
  });

  it("keeps a blank line before To Book", () => {
    expect(toOnlySocialsBody("TUI\n\nTo Book<br>\n☎️ Call")).toBe("TUI<br>\n<br>\nTo Book<br>\n☎️ Call");
  });

  it("handles mixed <br> variants and case", () => {
    expect(toOnlySocialsBody("a<BR>b<br/>c<br />d\ne")).toBe("a<br>\nb<br>\nc<br>\nd<br>\ne");
  });

  it("converts Windows newlines", () => {
    expect(toOnlySocialsBody("a\r\n\r\nb\r\nc")).toBe("a<br>\n<br>\nb<br>\nc");
  });

  it("collapses 3+ blank lines and trims leading/trailing blanks", () => {
    expect(toOnlySocialsBody("\n\na\n\n\n\nb<br>\n<br>\n")).toBe("a<br>\n<br>\nb");
  });

  it("is idempotent", () => {
    const input = "x\n\n\ny<br>\nz<br>\n<br>\nw\r\nv";
    const once = toOnlySocialsBody(input);
    expect(toOnlySocialsBody(once)).toBe(once);
  });

  it("leaves a normalised template post unchanged", () => {
    const post = "🌴 Title 🌴<br>\n✨ Sub ✨<br>\n<br>\n📅 Mon 01 Jan 2029<br>\n🌙 7 Nights<br>\n<br>\n💸 £554pp<br>\nSummary";
    expect(toOnlySocialsBody(post)).toBe(post);
  });
});
