/**
 * Which host a page belongs to, when the customer portal and the public quote page are served from their own
 * host (PORTAL_BASE_URL). Pure and shared: the server (redirects at the SPA fallback) and the client (the route
 * guard) apply the exact same rules, so neither can disagree about where a page lives.
 */

/** 'single' = one host for everything (no PORTAL_BASE_URL); 'staff' / 'portal' = the two-host set-up. */
export type HostKind = "single" | "staff" | "portal";

export type PageClass = "portal" | "public-quote" | "public-quote-preview" | "root" | "other";

/** What to do with a page request: serve it here, send it to the other host (same path), or go to another path here. */
export type HostDecision =
  | { type: "stay" }
  | { type: "redirect"; to: "portal" | "staff" }
  | { type: "same-host-path"; path: string };

/** The `?preview=1` flag a staff member adds to look at a customer quote page (it needs the staff session cookie). */
export function hasPreviewFlag(search: string): boolean {
  return new URLSearchParams(search).get("preview") === "1";
}

/** `search` is the query string with or without its leading "?". */
export function classifyPage(pathname: string, search: string): PageClass {
  if (pathname === "/") return "root";
  if (pathname === "/portal" || pathname.startsWith("/portal/")) return "portal";
  if (pathname.startsWith("/view-quote/")) return hasPreviewFlag(search) ? "public-quote-preview" : "public-quote";
  return "other";
}

export function decidePageHost(kind: HostKind, pathname: string, search: string): HostDecision {
  if (kind === "single") return { type: "stay" };
  const page = classifyPage(pathname, search);
  if (kind === "staff") {
    return page === "portal" || page === "public-quote" ? { type: "redirect", to: "portal" } : { type: "stay" };
  }
  // The portal host.
  if (page === "root") return { type: "same-host-path", path: "/portal" };
  if (page === "portal" || page === "public-quote") return { type: "stay" };
  return { type: "redirect", to: "staff" };
}
