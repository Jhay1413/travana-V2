import { describe, expect, it } from "vitest";
import { editorHtmlToPost, postToEditorHtml } from "@/lib/post-editor-html";

describe("post editor round-trip", () => {
  it("keeps template breaks and blank lines unchanged", () => {
    const post = "A<br>\n<br>\nB<br>\nC";
    expect(editorHtmlToPost(postToEditorHtml(post))).toBe(post);
  });

  it("shows legacy bare newlines as breaks", () => {
    expect(postToEditorHtml("Why:\n🌴 Lush")).toBe("Why:<br>\n🌴 Lush");
  });

  it("converts contentEditable divs, keeping blank lines", () => {
    expect(editorHtmlToPost("A<div>B</div><div><br></div><div>C</div>")).toBe("A<br>\nB<br>\n<br>\nC");
  });
});

describe("postToEditorHtml escaping", () => {
  it("escapes injected markup but keeps <br> line breaks", () => {
    const out = postToEditorHtml('Hi<img src=x onerror=alert(1)><script>x</script><br>\nBye');
    expect(out).not.toMatch(/<img|<script/i);
    expect(out).toBe("Hi&lt;img src=x onerror=alert(1)&gt;&lt;script&gt;x&lt;/script&gt;<br>\nBye");
  });

  it("round-trips escaped text unchanged", () => {
    const out = postToEditorHtml("a &lt; b<br>\nc");
    expect(editorHtmlToPost(out)).toBe("a &lt; b<br>\nc");
  });
});
