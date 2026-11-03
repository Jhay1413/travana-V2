import type { Request } from "express";

const LOCAL_FALLBACK = "http://localhost:5000";

export interface LinkBaseInput {
  /** BASE_URL / PUBLIC_BASE_URL, if configured. */
  configured: string | null | undefined;
  /** Origin of the request that triggered the email (browser Origin, else protocol + host). */
  requestOrigin: string | null | undefined;
  isProduction: boolean;
}

export function isProductionRuntime(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV === "production" || Boolean(env.REPLIT_DEPLOYMENT || env.REPLIT_DEPLOYMENT_ID);
}

/** http(s) origin of a URL-ish string, or null when it isn't one. */
function toOrigin(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:" ? url.origin : null;
  } catch {
    return null;
  }
}

/** Where the browser that triggered the email is: its Origin header, else this request's own origin. */
export function requestOrigin(req: Pick<Request, "get" | "protocol">): string | null {
  const origin = req.get("origin");
  if (origin) return origin;
  const host = req.get("host");
  return host ? `${req.protocol}://${host}` : null;
}

/**
 * Base URL for links in emails. Production always uses the configured public URL
 * (never a request header). Elsewhere the request's own origin wins, so a local
 * action gets a local link even when BASE_URL points at production.
 */
export function resolveLinkBase({ configured, requestOrigin, isProduction }: LinkBaseInput): string {
  const configuredOrigin = configured ? configured.replace(/\/+$/, "") : null;
  if (isProduction) return configuredOrigin ?? LOCAL_FALLBACK;
  return toOrigin(requestOrigin) ?? configuredOrigin ?? LOCAL_FALLBACK;
}
