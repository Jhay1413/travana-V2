import { describe, it, expect } from "vitest";
import { inlineDisposition, matchesSignature, toPortalDocument, viewTypeFor } from "./portal-documents.mapper";

describe("viewTypeFor", () => {
  it("accepts a PDF and the common images when the mime type and the extension agree", () => {
    expect(viewTypeFor("application/pdf", "a.pdf")).toEqual({ kind: "pdf", contentType: "application/pdf" });
    expect(viewTypeFor("Application/PDF; x=y", "A.PDF")).toEqual({ kind: "pdf", contentType: "application/pdf" });
    expect(viewTypeFor("image/jpeg", "a.jpg")?.contentType).toBe("image/jpeg");
    expect(viewTypeFor("image/jpeg", "a.JPEG")?.kind).toBe("image");
    expect(viewTypeFor("image/png", "a.png")?.contentType).toBe("image/png");
    expect(viewTypeFor("image/gif", "a.gif")?.contentType).toBe("image/gif");
    expect(viewTypeFor("image/webp", "a.webp")?.contentType).toBe("image/webp");
  });

  it("refuses when the mime type and the extension disagree, whichever one looks viewable", () => {
    expect(viewTypeFor("application/pdf", "a.docx")).toBeNull();
    expect(viewTypeFor("application/octet-stream", "a.pdf")).toBeNull();
    expect(viewTypeFor("image/png", "a.jpg")).toBeNull();
    expect(viewTypeFor("application/pdf", "a")).toBeNull();
    expect(viewTypeFor("application/pdf", ".pdf")).toBeNull();
  });

  it("refuses HEIC, SVG, HTML, text and Word", () => {
    const cases: Array<[string, string]> = [
      ["image/heic", "a.heic"],
      ["image/heif", "a.heif"],
      ["image/svg+xml", "a.svg"],
      ["text/html", "a.html"],
      ["text/plain", "a.txt"],
      ["application/msword", "a.doc"],
    ];
    for (const [mime, name] of cases) expect(viewTypeFor(mime, name), mime).toBeNull();
  });

  it("reads the extension of the last path segment only", () => {
    expect(viewTypeFor("application/pdf", "x.pdf/evil")).toBeNull();
    expect(viewTypeFor("application/pdf", "C:\\docs\\a.pdf")?.kind).toBe("pdf");
  });
});

describe("matchesSignature", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0]);

  it("recognises each supported signature", () => {
    expect(matchesSignature("application/pdf", Buffer.from("%PDF-1.7\n"))).toBe(true);
    expect(matchesSignature("image/jpeg", Buffer.from([0xff, 0xd8, 0xff, 0xe0]))).toBe(true);
    expect(matchesSignature("image/png", png)).toBe(true);
    expect(matchesSignature("image/gif", Buffer.from("GIF89a....."))).toBe(true);
    expect(matchesSignature("image/gif", Buffer.from("GIF87a....."))).toBe(true);
    expect(matchesSignature("image/webp", Buffer.from("RIFF\0\0\0\0WEBPVP8 "))).toBe(true);
  });

  it("rejects text, the wrong kind, truncated and empty heads, and types it does not know", () => {
    expect(matchesSignature("application/pdf", Buffer.from("<html>not a pdf"))).toBe(false);
    expect(matchesSignature("application/pdf", png)).toBe(false);
    expect(matchesSignature("image/png", Buffer.from("%PDF-1.4"))).toBe(false);
    expect(matchesSignature("image/webp", Buffer.from("RIFF\0\0\0\0WAVEfmt "))).toBe(false);
    expect(matchesSignature("image/png", png.subarray(0, 4))).toBe(false);
    expect(matchesSignature("application/pdf", Buffer.alloc(0))).toBe(false);
    expect(matchesSignature("text/html", Buffer.from("<html>"))).toBe(false);
  });
});

describe("inlineDisposition", () => {
  it("is the attachment form with inline, an ASCII fallback and the UTF-8 name", () => {
    expect(inlineDisposition("Ticket é.pdf")).toBe(`inline; filename="Ticket _.pdf"; filename*=UTF-8''Ticket%20%C3%A9.pdf`);
  });
});

describe("toPortalDocument viewable / viewKind", () => {
  const row = {
    id: "f1",
    clientId: "c1",
    filename: "k",
    title: null,
    originalName: "scan.pdf",
    mimeType: "application/pdf",
    size: 1,
    category: null,
    createdAt: new Date("2026-11-20T10:00:00Z"),
    dealId: "d1",
  };

  it("a PDF is viewable as a pdf, a picture as an image", () => {
    expect(toPortalDocument(row, null)).toMatchObject({ viewable: true, viewKind: "pdf" });
    expect(toPortalDocument({ ...row, originalName: "boarding.PNG", mimeType: "image/png" }, null)).toMatchObject({ viewable: true, viewKind: "image" });
  });

  it("Word, text and a mime/extension disagreement are not viewable", () => {
    const docx = { originalName: "terms.docx", mimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
    expect(toPortalDocument({ ...row, ...docx }, null)).toMatchObject({ viewable: false, viewKind: null });
    expect(toPortalDocument({ ...row, originalName: "page.pdf", mimeType: "text/html" }, null)).toMatchObject({ viewable: false, viewKind: null });
    expect(toPortalDocument({ ...row, originalName: "scan.docx", mimeType: "application/pdf" }, null)).toMatchObject({ viewable: false, viewKind: null });
  });
});
