/** Pure route and tab mapping for the customer portal shell. */

export type PortalTabKey = "home" | "quotes" | "bookings" | "messages" | "agent";

export interface PortalTab {
  key: PortalTabKey;
  label: string;
  /** The page the tab opens; null for the agent's tab, which opens the Message sheet over the current page. */
  path: string | null;
}

/** The fifth tab's label when the customer's agent has no usable first name. */
export const AGENT_TAB_FALLBACK = "Agent";

/**
 * The five bottom tabs: Home, Quotes, Bookings, Message (the chat page) and one labelled with the agent's first name,
 * which opens the "Message <agent>" sheet instead of a page. Deals, Rewards, Travel interests and Account are reached
 * from the full-screen menu.
 */
export function portalTabs(agentFirst: string): readonly PortalTab[] {
  const named = agentFirst && agentFirst !== "your agent";
  return [
    { key: "home", label: "Home", path: "/portal" },
    { key: "quotes", label: "Quotes", path: "/portal/quotes" },
    { key: "bookings", label: "Bookings", path: "/portal/bookings" },
    { key: "messages", label: "Message", path: "/portal/messages" },
    { key: "agent", label: named ? agentFirst : AGENT_TAB_FALLBACK, path: null },
  ];
}

/** The tabs with their fallback label (for code that has no agent name). */
export const PORTAL_TABS: readonly PortalTab[] = portalTabs("");

function cleanPath(pathname: string): string {
  const path = pathname.split(/[?#]/)[0].replace(/\/+$/, "");
  return path === "" ? "/" : path;
}

/** Which bottom tab a portal path belongs to; null for pages without one (deals, account, rewards, interests, login). */
export function activeTabForPath(pathname: string): PortalTabKey | null {
  const path = cleanPath(pathname);
  if (path === "/portal") return "home";
  if (path === "/portal/quotes" || path.startsWith("/portal/quote/")) return "quotes";
  if (path === "/portal/bookings" || path.startsWith("/portal/booking/")) return "bookings";
  if (path === "/portal/messages") return "messages";
  return null;
}

/** The current row of the full-screen menu for a path (the menu also lists the pages that have no tab). */
export function menuKeyForPath(pathname: string): string | null {
  const tab = activeTabForPath(pathname);
  if (tab) return tab;
  const path = cleanPath(pathname);
  if (path === "/portal/deals") return "deals";
  if (path === "/portal/referrals") return "rewards";
  if (path === "/portal/tags") return "interests";
  if (path === "/portal/account") return "account";
  return null;
}

/**
 * Where an old URL now lives, or null when the path needs no redirect.
 * The short-lived Trips tab (/portal/trips, /portal/trips/quotes, /portal/trips/bookings) is gone: quotes and
 * bookings are separate screens again. The query string and hash travel with the redirect.
 */
export function portalRedirectTarget(pathname: string, search = "", hash = ""): string | null {
  const path = cleanPath(pathname);
  const suffix = `${search}${hash}`;
  if (path === "/portal/trips" || path === "/portal/trips/quotes") return `/portal/quotes${suffix}`;
  if (path === "/portal/trips/bookings") return `/portal/bookings${suffix}`;
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
