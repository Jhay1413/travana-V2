import { afterEach, describe, expect, it, vi } from "vitest";
import {
  canView,
  classifyPdfError,
  createObjectUrlHandle,
  DocumentViewError,
  MAX_CANVAS_PIXELS,
  MAX_LIVE_PAGES,
  pagesToRender,
  PDF_ERROR_MESSAGES,
  pickCurrentPage,
  renderScale,
  VIEW_ERROR_MESSAGES,
  viewErrorHidesView,
  viewErrorKindForStatus,
  viewErrorKindOf,
  viewErrorOffersRetry,
} from "./document-viewer";

describe("canView", () => {
  it("follows the server's flag and kind, never the label", () => {
    expect(canView({ viewable: true, viewKind: "pdf" })).toBe(true);
    expect(canView({ viewable: true, viewKind: "image" })).toBe(true);
    expect(canView({ viewable: false, viewKind: null })).toBe(false);
    expect(canView({ viewable: false, viewKind: "pdf" })).toBe(false);
    expect(canView({ viewable: true, viewKind: null })).toBe(false);
  });
  it("an older list answer without the fields offers no View", () => {
    expect(canView({} as { viewable: boolean; viewKind: null })).toBe(false);
  });
});

describe("error to message mapping", () => {
  it("maps each server status to a kind and its plain message", () => {
    expect(viewErrorKindForStatus(404)).toBe("gone");
    expect(viewErrorKindForStatus(413)).toBe("too-large");
    expect(viewErrorKindForStatus(415)).toBe("unsupported");
    for (const status of [400, 429, 500, 502]) expect(viewErrorKindForStatus(status)).toBe("failed");
    expect(VIEW_ERROR_MESSAGES.gone).toBe("That document is no longer available.");
    expect(VIEW_ERROR_MESSAGES["too-large"]).toBe("This file is too large to preview. Please download it.");
    expect(VIEW_ERROR_MESSAGES.failed).toBe("We couldn't open that document. Please try again, or download it.");
  });
  it("a DocumentViewError carries its kind and message; anything else reads as failed", () => {
    const err = new DocumentViewError("too-large");
    expect(err.message).toBe(VIEW_ERROR_MESSAGES["too-large"]);
    expect(viewErrorKindOf(err)).toBe("too-large");
    expect(viewErrorKindOf(new Error("x"))).toBe("failed");
    expect(viewErrorKindOf("x")).toBe("failed");
  });
  it("only a transient failure offers Retry; permanent ones stop offering View", () => {
    expect(viewErrorOffersRetry("failed")).toBe(true);
    for (const kind of ["gone", "too-large", "unsupported"] as const) {
      expect(viewErrorOffersRetry(kind)).toBe(false);
      expect(viewErrorHidesView(kind)).toBe(true);
    }
    expect(viewErrorHidesView("failed")).toBe(false);
  });
  it("classifies PDF.js failures", () => {
    expect(classifyPdfError({ name: "PasswordException" })).toBe("password");
    expect(classifyPdfError({ name: "InvalidPDFException" })).toBe("corrupt");
    expect(classifyPdfError({ name: "FormatError" })).toBe("corrupt");
    expect(classifyPdfError({ name: "MissingPDFException" })).toBe("corrupt");
    expect(classifyPdfError(new Error("boom"))).toBe("failed");
    expect(classifyPdfError(null)).toBe("failed");
    expect(PDF_ERROR_MESSAGES.password).toMatch(/password protected/);
    expect(PDF_ERROR_MESSAGES.failed).toBe(VIEW_ERROR_MESSAGES.failed);
  });
});

describe("pagesToRender (the page window)", () => {
  it("renders the pages near the screen, in order, and releases everything else", () => {
    // A 50-page file scrolled to pages 20-22 with a screen of margin either side: 19..23 are near.
    expect(pagesToRender([23, 19, 21, 20, 22], 50)).toEqual([19, 20, 21, 22, 23]);
  });
  it("at the top of the file only the first pages are live", () => {
    expect(pagesToRender([1, 2], 50)).toEqual([1, 2]);
  });
  it("ignores numbers outside the document and duplicates", () => {
    expect(pagesToRender([0, 1, 1, 2, 51, -3, 2.5], 50)).toEqual([1, 2]);
    expect(pagesToRender([], 50)).toEqual([]);
    expect(pagesToRender([1], 0)).toEqual([]);
  });
  it("never keeps more than the cap alive, however many are near (tiny pages)", () => {
    const many = Array.from({ length: 40 }, (_, i) => i + 10);
    const live = pagesToRender(many, 100);
    expect(live).toHaveLength(MAX_LIVE_PAGES);
    expect(live[0]).toBe(10);
    expect(pagesToRender(many, 100, 3)).toEqual([10, 11, 12]);
  });
});

describe("pickCurrentPage", () => {
  it("is the first page crossing the middle band", () => {
    expect(pickCurrentPage([5, 6], 1, 10)).toBe(5);
    expect(pickCurrentPage(new Set([3]), 1, 10)).toBe(3);
  });
  it("keeps the previous answer while the band is between pages, and stays in range", () => {
    expect(pickCurrentPage([], 4, 10)).toBe(4);
    expect(pickCurrentPage([], 40, 10)).toBe(10);
    expect(pickCurrentPage([], 0, 10)).toBe(1);
    expect(pickCurrentPage([99], 2, 10)).toBe(2);
  });
});

describe("renderScale", () => {
  it("fits the page to the screen width at the device pixel ratio", () => {
    expect(renderScale({ cssWidth: 300, pageWidth: 600, pageHeight: 800, devicePixelRatio: 1 })).toBeCloseTo(0.5);
    expect(renderScale({ cssWidth: 300, pageWidth: 600, pageHeight: 800, devicePixelRatio: 2 })).toBeCloseTo(1);
  });
  it("caps the device pixel ratio at 2 (a 3x phone does not triple the memory)", () => {
    expect(renderScale({ cssWidth: 300, pageWidth: 600, pageHeight: 800, devicePixelRatio: 3 })).toBeCloseTo(1);
  });
  it("caps the canvas area, so a huge page cannot exhaust memory", () => {
    const scale = renderScale({ cssWidth: 900, pageWidth: 3000, pageHeight: 4000, devicePixelRatio: 2 });
    expect(3000 * scale * 4000 * scale).toBeLessThanOrEqual(MAX_CANVAS_PIXELS + 1);
  });
  it("falls back to 1 for unusable sizes", () => {
    expect(renderScale({ cssWidth: 0, pageWidth: 600, pageHeight: 800, devicePixelRatio: 2 })).toBe(1);
    expect(renderScale({ cssWidth: 300, pageWidth: 0, pageHeight: 800, devicePixelRatio: 2 })).toBe(1);
  });
});

describe("createObjectUrlHandle", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("creates the URL from the Blob and revokes it exactly once", () => {
    const create = vi.fn().mockReturnValue("blob:abc");
    const revoke = vi.fn();
    vi.stubGlobal("URL", { createObjectURL: create, revokeObjectURL: revoke });
    const blob = new Blob(["x"], { type: "image/png" });
    const handle = createObjectUrlHandle(blob);
    expect(create).toHaveBeenCalledWith(blob);
    expect(handle.url).toBe("blob:abc");
    expect(revoke).not.toHaveBeenCalled();
    handle.revoke();
    handle.revoke();
    expect(revoke).toHaveBeenCalledTimes(1);
    expect(revoke).toHaveBeenCalledWith("blob:abc");
  });
});
