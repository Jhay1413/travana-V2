/** Pure route and tab mapping for the customer portal shell. */

export type PortalTabKey = "home" | "trips" | "deals" | "messages" | "account";

export interface PortalTab {
  key: PortalTabKey;
  label: string;
  path: string;
}

/** Five bottom tabs; there is no separate full-screen menu. */
export const PORTAL_TABS: readonly PortalTab[] = [
  { key: "home", label: "Home", path: "/portal" },
  { key: "trips", label: "Trips", path: "/portal/trips" },
  { key: "deals", label: "Deals", path: "/portal/deals" },
  { key: "messages", label: "Messages", path: "/portal/messages" },
  { key: "account", label: "Account", path: "/portal/account" },
];

export type TripsSegment = "quotes" | "bookings";

export const TRIPS_SEGMENTS: readonly { key: TripsSegment; label: string; path: string }[] = [
  { key: "quotes", label: "Quotes", path: "/portal/trips/quotes" },
  { key: "bookings", label: "Bookings", path: "/portal/trips/bookings" },
];

function cleanPath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "");
  return path === "" ? "/" : path;
}

/** Which bottom tab a portal path belongs to; null for pages without one (login, interests). */
export function activeTabForPath(pathname: string): PortalTabKey | null {
  const path = cleanPath(pathname);
  if (path === "/portal") return "home";
  if (path === "/portal/trips" || path.startsWith("/portal/trips/")) return "trips";
  if (path === "/portal/quotes" || path === "/portal/bookings" || path.startsWith("/portal/quote/") || path.startsWith("/portal/booking/")) return "trips";
  if (path === "/portal/deals") return "deals";
  if (path === "/portal/messages") return "messages";
  if (path === "/portal/account" || path === "/portal/referrals" || path === "/portal/tags") return "account";
  return null;
}

/** The Trips segment for a path (a quote opened from a link counts as Quotes). */
export function tripsSegmentForPath(pathname: string): TripsSegment {
  const path = cleanPath(pathname);
  if (path === "/portal/trips/bookings" || path === "/portal/bookings") return "bookings";
  return "quotes";
}

/**
 * Where an old URL now lives, or null when the path needs no redirect.
 * /portal/quotes and /portal/bookings are the old tabs; /portal/trips alone opens Quotes.
 * The query string and hash travel with the redirect.
 */
export function portalRedirectTarget(pathname: string, search = "", hash = ""): string | null {
  const path = cleanPath(pathname);
  const suffix = `${search}${hash}`;
  if (path === "/portal/quotes" || path === "/portal/trips") return `/portal/trips/quotes${suffix}`;
  if (path === "/portal/bookings") return `/portal/trips/bookings${suffix}`;
  return null;
}

/** The post-sign-in / post-interests destination in `?next=`: only same-site portal paths, else the portal home. */
export function portalNextTarget(search: string): string {
  const next = new URLSearchParams(search).get("next");
  return next && next.startsWith("/portal") && !next.startsWith("//") ? next : "/portal";
}

/** The query string (with its `?`, or "") without the named parameters; every other parameter is kept. */
export function withoutParams(search: string, names: readonly string[]): string {
  const params = new URLSearchParams(search);
  for (const name of names) params.delete(name);
  const rest = params.toString();
  return rest ? `?${rest}` : "";
}

/**
 * Where the forced "choose your interests" step sends a customer, carrying a pending
 * ?change-pin=1 through it (via `next`) so the new-PIN form still opens afterwards.
 */
export function interestsRedirectTarget(pathname: string, search: string): string {
  if (new URLSearchParams(search).get("change-pin") === "1") {
    return `/portal/tags?next=${encodeURIComponent(`${pathname}?change-pin=1`)}`;
  }
  return "/portal/tags";
}
