import { describe, expect, it } from "vitest";
import { plainTextToNoteHtml, stripHtml, toNoteCardItems } from "./note-cards";

describe("stripHtml", () => {
  it("removes tags and collapses whitespace", () => {
    expect(stripHtml("<p>Hello <b>world</b></p>\n<p>again</p>")).toBe("Hello world again");
  });
});

describe("toNoteCardItems", () => {
  const when = (v: string | null | undefined) => (v ? `on ${v.slice(0, 10)}` : null);
  it("sorts newest first, plain text, drops empty notes", () => {
    const items = toNoteCardItems(
      [
        { id: "a", content: "<p>old</p>", author_name: "Sam", createdAt: "2026-10-01T10:00:00Z" },
        { id: "b", content: null, description: "new", author_name: null, createdAt: "2026-10-02T10:00:00Z" },
        { id: "c", content: "<p> </p>", createdAt: "2026-10-03T10:00:00Z" },
      ],
      when,
    );
    expect(items).toEqual([
      { id: "b", text: "new", by: null, when: "on 2026-10-02" },
      { id: "a", text: "old", by: "Sam", when: "on 2026-10-01" },
    ]);
  });
});

describe("plainTextToNoteHtml", () => {
  it("escapes markup so it cannot execute", () => {
    expect(plainTextToNoteHtml('<img src=x onerror="alert(1)">')).toBe("<p>&lt;img src=x onerror=&quot;alert(1)&quot;&gt;</p>");
  });
  it("escapes comparison characters and ampersands", () => {
    expect(plainTextToNoteHtml("budget <2k, >1k & 'ok'")).toBe("<p>budget &lt;2k, &gt;1k &amp; &#39;ok&#39;</p>");
  });
  it("turns lines into paragraphs and drops blank lines", () => {
    expect(plainTextToNoteHtml("one\r\n\r\ntwo\nthree")).toBe("<p>one</p><p>two</p><p>three</p>");
  });
});
