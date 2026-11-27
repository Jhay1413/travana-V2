import type { PortalDocument } from "@shared/portal-documents";

/** Pure helpers for the in-app document viewer (no React, no browser globals except where a caller passes them in). */

/** Show "View" only when the server says the viewer can show the file (its own mime-type + extension + bytes rule). */
export function canView(doc: Pick<PortalDocument, "viewable" | "viewKind">): boolean {
  return doc.viewable === true && (doc.viewKind === "pdf" || doc.viewKind === "image");
}

export type ViewErrorKind = "gone" | "too-large" | "unsupported" | "failed";

/** Why a view request failed, from the server's status. */
export function viewErrorKindForStatus(status: number): ViewErrorKind {
  if (status === 404) return "gone";
  if (status === 413) return "too-large";
  if (status === 415) return "unsupported";
  return "failed";
}

export class DocumentViewError extends Error {
  readonly kind: ViewErrorKind;
  constructor(kind: ViewErrorKind, message?: string) {
    super(message ?? VIEW_ERROR_MESSAGES[kind]);
    this.name = "DocumentViewError";
    this.kind = kind;
  }
}

export const VIEW_ERROR_MESSAGES: Record<ViewErrorKind, string> = {
  gone: "That document is no longer available.",
  "too-large": "This file is too large to preview. Please download it.",
  unsupported: "This document can't be previewed. Please download it.",
  failed: "We couldn't open that document. Please try again, or download it.",
};

/** What the viewer offers beside the message: a retry only makes sense when trying again could work. */
export function viewErrorOffersRetry(kind: ViewErrorKind): boolean {
  return kind === "failed";
}

/** Whether the viewer should stop offering "View" for the file after this failure (it will never work). */
export function viewErrorHidesView(kind: ViewErrorKind): boolean {
  return kind === "too-large" || kind === "unsupported" || kind === "gone";
}

/** Any thrown value as a view error kind (anything unrecognised is "failed"). */
export function viewErrorKindOf(err: unknown): ViewErrorKind {
  return err instanceof DocumentViewError ? err.kind : "failed";
}

export type PdfErrorKind = "password" | "corrupt" | "failed";

/** PDF.js rejects with named exceptions; "password" and "corrupt" are permanent for that file, anything else may pass. */
export function classifyPdfError(err: unknown): PdfErrorKind {
  const name = typeof err === "object" && err !== null && "name" in err ? String((err as { name: unknown }).name) : "";
  if (name === "PasswordException") return "password";
  if (name === "InvalidPDFException" || name === "FormatError" || name === "MissingPDFException") return "corrupt";
  return "failed";
}

export const PDF_ERROR_MESSAGES: Record<PdfErrorKind, string> = {
  password: "This document is password protected, so we can't show it here. Please download it.",
  corrupt: "This document looks damaged, so we can't show it here. Please download it.",
  failed: VIEW_ERROR_MESSAGES.failed,
};

/** At most this many page canvases are alive at once, however far the customer has scrolled. */
export const MAX_LIVE_PAGES = 6;

/**
 * Which pages should hold a rendered canvas, given the pages currently near the screen (those intersecting the scroll
 * area plus a margin of one screen above and below). Pages outside the result are released. Page numbers are 1-based;
 * unknown or out-of-range numbers are ignored; if more than MAX_LIVE_PAGES are near, the ones closest to the first
 * near page win (a very short page size cannot exhaust memory).
 */
export function pagesToRender(nearPages: Iterable<number>, pageCount: number, max: number = MAX_LIVE_PAGES): number[] {
  const valid = Array.from(new Set(nearPages)).filter((n) => Number.isInteger(n) && n >= 1 && n <= pageCount).sort((a, b) => a - b);
  return valid.slice(0, max);
}

/** The page shown in "Page N of M": the first page crossing the middle band of the screen, else the previous answer. */
export function pickCurrentPage(bandPages: Iterable<number>, previous: number, pageCount: number): number {
  const valid = Array.from(bandPages).filter((n) => Number.isInteger(n) && n >= 1 && n <= pageCount);
  return valid.length > 0 ? Math.min(...valid) : Math.min(Math.max(previous, 1), Math.max(pageCount, 1));
}

/**
 * Pixel scale for rendering a page so it is crisp at the screen's pixel ratio but cannot exhaust memory: the device
 * ratio is capped, and so is the canvas area. `cssWidth` is the width the page is shown at, `pageWidth` /
 * `pageHeight` its size at scale 1.
 */
export function renderScale(opts: { cssWidth: number; pageWidth: number; pageHeight: number; devicePixelRatio: number }): number {
  const { cssWidth, pageWidth, pageHeight } = opts;
  if (!(cssWidth > 0) || !(pageWidth > 0) || !(pageHeight > 0)) return 1;
  const ratio = Math.min(Math.max(opts.devicePixelRatio || 1, 1), MAX_DEVICE_PIXEL_RATIO);
  const wanted = (cssWidth / pageWidth) * ratio;
  const areaCap = Math.sqrt(MAX_CANVAS_PIXELS / (pageWidth * pageHeight));
  return Math.min(wanted, areaCap);
}

export const MAX_DEVICE_PIXEL_RATIO = 2;
export const MAX_CANVAS_PIXELS = 4_000_000;

/** An object URL for a Blob that is revoked exactly once, whenever it is released. */
export interface ObjectUrlHandle {
  url: string;
  revoke: () => void;
}

export function createObjectUrlHandle(blob: Blob): ObjectUrlHandle {
  const url = URL.createObjectURL(blob);
  let revoked = false;
  return {
    url,
    revoke: () => {
      if (revoked) return;
      revoked = true;
      URL.revokeObjectURL(url);
    },
  };
}
