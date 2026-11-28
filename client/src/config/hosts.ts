import { decidePageHost, type HostKind } from "@shared/host-routing";

/**
 * The two-host set-up as the browser sees it: the server writes `<meta name="travana-hosts">` into index.html
 * (origins only plus which host this page came from). Everything here is pure; config/env.ts does the one DOM read.
 */
export type { HostKind };

export interface HostsConfig {
  /** Origin of the customer portal / public quote host, "" with one host. */
  portalBaseUrl: string;
  /** Origin of the staff site, "" with one host. */
  staffBaseUrl: string;
  hostKind: HostKind;
}

export const SINGLE_HOSTS: HostsConfig = { portalBaseUrl: "", staffBaseUrl: "", hostKind: "single" };

function asOrigin(value: unknown): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.origin === value ? value : null;
  } catch {
    return null;
  }
}

/** The tag's `content`; anything absent, empty or malformed means one host. */
export function parseHostsMeta(content: string | null | undefined): HostsConfig {
  if (!content) return SINGLE_HOSTS;
  let raw: unknown;
  try {
    raw = JSON.parse(content);
  } catch {
    return SINGLE_HOSTS;
  }
  if (typeof raw !== "object" || raw === null) return SINGLE_HOSTS;
  const { portal, staff, kind } = raw as { portal?: unknown; staff?: unknown; kind?: unknown };
  if (kind !== "staff" && kind !== "portal") return SINGLE_HOSTS;
  const portalBaseUrl = asOrigin(portal);
  const staffBaseUrl = asOrigin(staff);
  if (!portalBaseUrl || !staffBaseUrl || portalBaseUrl === staffBaseUrl) return SINGLE_HOSTS;
  return { portalBaseUrl, staffBaseUrl, hostKind: kind };
}

/**
 * Which host this page is really on: the browser's own origin compared with the two origins the tag lists. The tag's own
 * `kind` (what the server believed) is never trusted: behind a misbehaving proxy or from a poisoned cache it can be wrong.
 * An origin that is neither of the two (or no tag at all) means one host.
 */
export function withActualKind(config: HostsConfig, currentOrigin: string): HostsConfig {
  if (config.hostKind === "single") return config;
  if (currentOrigin === config.portalBaseUrl) return { ...config, hostKind: "portal" };
  if (currentOrigin === config.staffBaseUrl) return { ...config, hostKind: "staff" };
  return SINGLE_HOSTS;
}

/**
 * Where `location.replace()` may go: never to an address on the origin we are already on when the point is to change host
 * (that would only loop), and never to something that is not a plain http(s) address. Null = stay put.
 */
export function safeHostChangeTarget(target: string, currentOrigin: string): string | null {
  try {
    const url = new URL(target, currentOrigin);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.origin === currentOrigin ? null : url.href;
  } catch {
    return null;
  }
}

/** A site-relative path: one leading "/", no "//", no backslash. Anything else becomes "/". */
function safePath(path: string): string {
  return path.startsWith("/") && !path.startsWith("//") && !path.includes("\\") ? path : "/";
}

/** Where a customer-facing page lives: the plain path on one host or on the portal host, else an absolute portal URL. */
export function portalHrefFor(hosts: HostsConfig, path: string): string {
  const safe = safePath(path);
  return hosts.hostKind === "staff" ? `${hosts.portalBaseUrl}${safe}` : safe;
}

/** Where a staff page lives: the plain path on one host or on the staff host, else an absolute staff URL. */
export function staffHrefFor(hosts: HostsConfig, path: string): string {
  const safe = safePath(path);
  return hosts.hostKind === "portal" ? `${hosts.staffBaseUrl}${safe}` : safe;
}

/** The origin to put in a link a customer opens: the portal host when there is one, else `fallbackOrigin` (today's value). */
export function customerOriginFor(hosts: HostsConfig, fallbackOrigin: string): string {
  return hosts.hostKind === "single" ? fallbackOrigin : hosts.portalBaseUrl;
}

export type HostGuardAction =
  | { type: "none" }
  | { type: "redirect"; host: "portal" | "staff"; path: string }
  | { type: "same-host-path"; path: string };

/**
 * What the router does for this page before rendering anything. `path` is pathname plus search (the caller appends
 * the hash). Same rules as the server's page redirects (shared/host-routing.ts).
 */
export function hostGuardAction(kind: HostKind, pathname: string, search: string): HostGuardAction {
  const decision = decidePageHost(kind, pathname, search);
  if (decision.type === "redirect") return { type: "redirect", host: decision.to, path: `${pathname}${search}` };
  if (decision.type === "same-host-path") return { type: "same-host-path", path: decision.path };
  return { type: "none" };
}
