/**
 * Centralized access to client environment configuration.
 *
 * Vite exposes build-time variables (and any `VITE_`-prefixed vars) on
 * `import.meta.env`. Read them here so the rest of the app imports a typed
 * object from `@/config/env` rather than touching `import.meta.env` directly.
 */
import { customerOriginFor, parseHostsMeta, portalHrefFor, SINGLE_HOSTS, staffHrefFor, withActualKind, type HostsConfig } from "./hosts";

/** Read once: the server's `<meta name="travana-hosts">` (absent or malformed = one host, nothing changes). */
function readHosts(): HostsConfig {
  if (typeof document === "undefined") return SINGLE_HOSTS;
  return parseHostsMeta(document.querySelector('meta[name="travana-hosts"]')?.getAttribute("content"));
}

// The kind comes from where the browser really is, not from what the tag claims (see withActualKind).
const hosts = typeof window === "undefined" ? SINGLE_HOSTS : withActualKind(readHosts(), window.location.origin);

/** A customer-facing page (portal, public quote): the plain path unless the staff host must point at the portal host. */
export const portalHref = (path: string): string => portalHrefFor(hosts, path);
/** A staff page: the plain path unless the portal host must point at the staff host. */
export const staffHref = (path: string): string => staffHrefFor(hosts, path);
/** The origin for a link a customer opens (the portal host when there is one, else `fallbackOrigin`). */
export const customerOrigin = (fallbackOrigin: string): string => customerOriginFor(hosts, fallbackOrigin);

export const env = {
  portalBaseUrl: hosts.portalBaseUrl,
  staffBaseUrl: hosts.staffBaseUrl,
  hostKind: hosts.hostKind,
  mode: import.meta.env.MODE,
  isDev: import.meta.env.DEV,
  isProd: import.meta.env.PROD,
  /**
   * Public base URL for building externally-shared links (e.g. quote share
   * links). Falls back to `window.location.origin` when unset so local dev
   * keeps working without configuring `VITE_PUBLIC_APP_URL`.
   */
  /**
   * `VITE_PORTAL_PAYMENTS`: shows the customer portal's Payments placeholder on a booking. Off unless set to
   * "true" (what the customer owes and when is undecided, so no figure is ever shown either way).
   */
  portalPayments: import.meta.env.VITE_PORTAL_PAYMENTS as string | undefined,
  publicBaseUrl: (import.meta.env.VITE_PUBLIC_APP_URL || window.location.origin).replace(/\/+$/, ""),
} as const;

export type Env = typeof env;
