import type { Request, Response } from "express";
import { getPortalBaseUrl, hostsForPage } from "./hosts";

function escapeAttribute(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** The `<meta name="travana-hosts">` tag the client reads once: origins only, plus which host this page was served on. */
export function hostsMetaTag(req: Pick<Request, "hostname">): string {
  return `<meta name="travana-hosts" content='${escapeAttribute(JSON.stringify(hostsForPage(req)))}' />`;
}

/**
 * Caching headers for the served index.html. With one host (no PORTAL_BASE_URL) it is exactly what sendFile gave it before:
 * "public, max-age=0" and the file's Last-Modified, each only when nothing earlier set one (a /view-quote page is already
 * "no-store" from publicQuoteHeaders). With a portal host the page depends on the host it was asked on, so no shared cache may
 * keep it: "no-cache, private", varied on the host headers (and no Last-Modified, which would let a validator vouch for it).
 */
export function setIndexCacheHeaders(res: Response, fileLastModified?: string): void {
  if (getPortalBaseUrl()) {
    if (!res.getHeader("Cache-Control")) res.setHeader("Cache-Control", "no-cache, private");
    res.vary("Host");
    res.vary("X-Forwarded-Host");
    return;
  }
  if (!res.getHeader("Cache-Control")) res.setHeader("Cache-Control", "public, max-age=0");
  if (fileLastModified && !res.getHeader("Last-Modified")) res.setHeader("Last-Modified", fileLastModified);
}

/** Adds the hosts tag to the served index.html (used by both production static serving and the dev server). */
export function injectHostsMeta(html: string, req: Pick<Request, "hostname">): string {
  const tag = hostsMetaTag(req);
  // A replacer function: the tag is data, not a replacement pattern ("$&" and friends).
  return html.includes("</head>") ? html.replace("</head>", () => `    ${tag}\n  </head>`) : `${tag}${html}`;
}
