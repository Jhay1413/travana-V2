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
