import type { Request } from "express";
import type { HostKind } from "@shared/host-routing";
import { AppError } from "./error-handler";
import { getPublicBaseUrl } from "./public-url";

/**
 * The two-host set-up: the staff CRM on the main host, the customer portal and the public quote page on a portal host
 * (PORTAL_BASE_URL). With that setting unset or invalid everything stays on one host and every link is exactly what it
 * was before this module existed.
 */

/** Longest request URL we will copy into a redirect. */
export const MAX_REDIRECT_URL_LENGTH = 8192;

const CONTROL_CHARS = /[\u0000-\u001f\u007f]/;
const loggedOnce = new Set<string>();

function warnOnce(key: string, message: string): void {
  if (loggedOnce.has(key)) return;
  loggedOnce.add(key);
  console.warn(`[hosts] ${message}`);
}

/** Test hook: forget what was already logged. */
export function resetHostsLogState(): void {
  loggedOnce.clear();
}

function invalidPortalBase(reason: string): null {
  // Only the reason is logged, never the value (it could carry credentials).
  warnOnce(`portal:${reason}`, `PORTAL_BASE_URL ignored (${reason}); serving everything from one host.`);
  return null;
}

function staffUrlParsed(): URL | null {
  const base = getPublicBaseUrl();
  if (!base) return null;
  try {
    return new URL(base);
  } catch {
    return null;
  }
}

/** The origin of the staff site, or null when no site address is configured. */
export function getStaffOrigin(): string | null {
  const parsed = staffUrlParsed();
  return parsed && (parsed.protocol === "http:" || parsed.protocol === "https:") ? parsed.origin : null;
}

/** The portal host's origin (no trailing slash), or null when it is not set or not usable. */
export function getPortalBaseUrl(): string | null {
  const raw = process.env.PORTAL_BASE_URL?.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return invalidPortalBase("not an absolute URL");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return invalidPortalBase("not an http(s) URL");
  if (url.username || url.password) return invalidPortalBase("contains credentials");
  if (process.env.NODE_ENV === "production" && url.protocol !== "https:") return invalidPortalBase("not https in production");
  if (url.pathname !== "/" || url.search || url.hash || raw.includes("?") || raw.includes("#")) {
    return invalidPortalBase("has a path, query or hash");
  }
  const staff = staffUrlParsed();
  if (!staff) return invalidPortalBase("no staff site address is configured");
  if (staff.hostname.toLowerCase() === url.hostname.toLowerCase()) return invalidPortalBase("same host as the staff site");
  return url.origin;
}

function normaliseHostname(hostname: string | undefined): string {
  return (hostname ?? "").toLowerCase().replace(/\.$/, "");
}

const bypassedRequests = new WeakSet<object>();

/**
 * The redirect-loop guard decided this request must be served as if there were one host (the proxy is not forwarding the
 * original host, so redirecting would only loop). Everything that asks hostKind for this request then sees 'single'.
 */
export function markHostRoutingBypassed(req: object): void {
  bypassedRequests.add(req);
}

/** Which host a request arrived on. 'single' whenever no (usable) portal host is configured. */
export function hostKind(req: Pick<Request, "hostname">): HostKind {
  if (bypassedRequests.has(req)) return "single";
  const portal = getPortalBaseUrl();
  if (!portal) return "single";
  return normaliseHostname(req.hostname) === new URL(portal).hostname ? "portal" : "staff";
}

/** A site-relative path: one leading "/", no "//", no backslash, no control characters. */
export function isSafePath(path: unknown): path is string {
  return typeof path === "string" && path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") && !CONTROL_CHARS.test(path);
}

function checkedPath(path: string): string {
  if (isSafePath(path)) return path;
  if (process.env.NODE_ENV === "production") {
    // Fail closed: never a message with a bare "https://portal.../" link. Callers already treat this error as "no site address".
    warnOnce("unsafe-path", "refused an unsafe link path.");
    throw new AppError(SITE_ADDRESS_ERROR, 500);
  }
  throw new Error("Unsafe link path: it must start with a single '/' and contain no backslash or control characters.");
}

/** The message the callers already use for "there is no usable site address". */
export const SITE_ADDRESS_ERROR = "The site address is not configured";

/** Like portalUrl, but answers null (never throws) for an unsafe path, for callers that skip the send instead. */
export function tryPortalUrl(path: string): string | null {
  if (!isSafePath(path)) {
    warnOnce("unsafe-path", "refused an unsafe link path.");
    return null;
  }
  return portalUrl(path);
}

/** A link a customer opens (portal, sign-in, quote page). Same as the staff link when there is one host. */
export function portalUrl(path: string): string {
  const safe = checkedPath(path);
  return `${getPortalBaseUrl() ?? getPublicBaseUrl()}${safe}`;
}

/** A link a staff member opens. Always the staff site, whatever the portal host. */
export function staffUrl(path: string): string {
  return `${getPublicBaseUrl()}${checkedPath(path)}`;
}

/**
 * Where to send a request that arrived on the wrong host: the other host's origin followed by the request URL, built by
 * string concatenation and then checked to still be on that origin (never `new URL(url, base)`, which lets "//evil.com"
 * jump host). Null when there is no such host or the URL is not a plain path: the caller answers 404.
 */
export function redirectTargetFor(to: "portal" | "staff", originalUrl: string): string | null {
  const origin = to === "portal" ? getPortalBaseUrl() : getStaffOrigin();
  if (!origin) return null;
  if (typeof originalUrl !== "string" || originalUrl.length > MAX_REDIRECT_URL_LENGTH || !isSafePath(originalUrl)) return null;
  const target = `${origin}${originalUrl}`;
  try {
    return new URL(target).origin === origin ? target : null;
  } catch {
    return null;
  }
}

/** What the page tells the browser about the hosts (see injectHostsMeta). Empty origins when there is one host. */
export function hostsForPage(req: Pick<Request, "hostname">): { portal: string; staff: string; kind: HostKind } {
  const kind = hostKind(req);
  if (kind === "single") return { portal: "", staff: "", kind };
  return { portal: getPortalBaseUrl() ?? "", staff: getStaffOrigin() ?? "", kind };
}
