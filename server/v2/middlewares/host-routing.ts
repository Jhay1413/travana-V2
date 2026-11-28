import type { NextFunction, Request, RequestHandler, Response } from "express";
import { decidePageHost } from "@shared/host-routing";
import { createHash } from "node:crypto";
import { getPortalBaseUrl, hostKind, markHostRoutingBypassed, redirectTargetFor } from "../utils/hosts";

/**
 * Keeps the two hosts apart when PORTAL_BASE_URL is set. With it unset (`hostKind` is 'single') both handlers do
 * nothing at all, so a single-host deployment behaves exactly as before.
 */

/**
 * The only APIs the portal host answers: what the customer portal and the public quote page call. Everything else
 * under /api is the staff API and is refused there (see docs/e2e-test-coverage.md for the client call sites).
 */
export const PORTAL_HOST_API_PREFIXES: readonly string[] = ["/api/portal", "/api/v2/portal", "/api/public/quote"];

export function isPortalHostApiPath(path: string): boolean {
  const lower = path.toLowerCase();
  // No way round the prefix with dot segments, encoded dots or backslashes.
  if (lower.includes("\\") || lower.includes("%5c") || lower.includes("%2e") || lower.split("/").includes("..")) return false;
  return PORTAL_HOST_API_PREFIXES.some((prefix) => lower === prefix || lower.startsWith(`${prefix}/`));
}

/**
 * The one non-portal API the portal host serves: the image proxy, which stored quote, deal and agency images point at
 * (`/api/v2/files/img?key=...`). Anonymous by design, GET/HEAD only, and the handler serves only the public image key
 * prefixes (quote-images/, booking-images/, hub-images/, social-upscale/, image-upscale/, tour-operator-logos/,
 * training-assets/, training-thumbnails/, training-videos/); any other key is a 404.
 */
export const PORTAL_HOST_IMAGE_PATH = "/api/v2/files/img";

export function isPortalHostImageRequest(method: string, path: string): boolean {
  return (method === "GET" || method === "HEAD") && path.toLowerCase() === PORTAL_HOST_IMAGE_PATH;
}

const SAFE_METHODS = new Set(["GET", "HEAD", "OPTIONS"]);

function notFound(res: Response): void {
  res.status(404).json({ error: "Not found" });
}

/** On the portal host, every /api request outside the allow-list is a 404 before any auth runs. */
export const hostApiGate: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const kind = hostKind(req);
  if (kind === "single") return next();
  // Express matches routes case-insensitively, so every check here must too.
  const lower = req.path.toLowerCase();
  const isApi = lower === "/api" || lower.startsWith("/api/");

  if (kind === "staff") {
    // The two hosts are the same site, so the staff session cookie would ride along on a state-changing request sent from a
    // page on the portal origin. Refuse those (the portal and public quote APIs, which old installed copies call, excepted).
    if (isApi && !SAFE_METHODS.has(req.method) && !isPortalHostApiPath(req.path)) {
      const portalOrigin = getPortalBaseUrl();
      if (portalOrigin && req.headers.origin === portalOrigin) {
        res.status(403).json({ error: "Forbidden" });
        return;
      }
    }
    return next();
  }

  // Portal host.
  // Nothing on the portal side uses the staff mock-up previews: treat them like a staff page.
  if (lower === "/mockup-previews" || lower.startsWith("/mockup-previews/")) {
    if (req.method !== "GET" && req.method !== "HEAD") return notFound(res);
    return redirect(req, res, next, redirectTargetFor("staff", req.originalUrl));
  }
  if (!isApi) return next();
  if (isPortalHostApiPath(req.path) || isPortalHostImageRequest(req.method, req.path)) return next();
  notFound(res);
};

/**
 * Redirect-loop guard. If the deployment's proxy does not forward the original host, the portal host is seen as the staff
 * host and every redirect would point at the very address that was asked for. Each redirect is therefore marked with a
 * short-lived, host-scoped, HttpOnly cookie (never in the URL, so `mt=` / `next=` and the Referer are untouched) holding how
 * many times this browser was just sent to this exact target. Once it has been sent there twice and asks again, the
 * request is served as single-host instead of redirected, and the mistake is logged.
 */
export const HOST_MARK_COOKIE = "hr_mark";
export const HOST_MARK_MAX_AGE_SECONDS = 15;
export const HOST_MARK_LOOP_AFTER = 2;
export const HOST_LOOP_MESSAGE = "host routing: the proxy is not forwarding the original host; PORTAL_BASE_URL is being ignored";

let loggedLoop = false;
let loggedSameHost = false;

/** Test hook: let the loop error be logged again. */
export function resetHostLoopLog(): void {
  loggedLoop = false;
  loggedSameHost = false;
}

function fingerprint(target: string): string {
  return createHash("sha256").update(target).digest("base64url").slice(0, 16);
}

/** How many times this browser was just redirected to `target` (0 when it carries no mark, or one for another target). */
export function redirectsAlreadyIssued(cookieHeader: string | undefined, target: string): number {
  if (!cookieHeader) return 0;
  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name !== HOST_MARK_COOKIE) continue;
    const [count, fp] = rest.join("=").split(".");
    const n = Number(count);
    if (fp === fingerprint(target) && Number.isInteger(n) && n > 0) return n;
  }
  return 0;
}

function markCookie(target: string, count: number): string {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${HOST_MARK_COOKIE}=${count}.${fingerprint(target)}; Max-Age=${HOST_MARK_MAX_AGE_SECONDS}; Path=/; HttpOnly; SameSite=Lax${secure}`;
}

/** Sends the redirect, or (a loop) lets the request carry on as single-host. */
function redirect(req: Request, res: Response, next: NextFunction, target: string | null): void {
  if (!target) return notFound(res);
  // Never redirect to the host the request already arrived on: that can only be a loop.
  if (new URL(target).hostname === (req.hostname ?? "").toLowerCase().replace(/.$/, "")) {
    if (!loggedSameHost) {
      loggedSameHost = true;
      console.error("host routing: refused to redirect to the host the request arrived on (answered 404); check the proxy and PORTAL_BASE_URL");
    }
    return notFound(res);
  }
  const issued = redirectsAlreadyIssued(req.headers.cookie, target);
  if (issued >= HOST_MARK_LOOP_AFTER) {
    if (!loggedLoop) {
      loggedLoop = true;
      console.error(HOST_LOOP_MESSAGE);
    }
    markHostRoutingBypassed(req);
    return next();
  }
  res.append("Set-Cookie", markCookie(target, issued + 1));
  res.status(302);
  res.setHeader("Location", target);
  res.setHeader("Referrer-Policy", "no-referrer");
  res.setHeader("Cache-Control", "no-store");
  res.end();
}

/**
 * Mounted in front of the page (SPA) fallback only, so static assets, the manifest, the service worker and uploaded
 * images are served on both hosts. Sends a page to the host it belongs to, and keeps the portal host's pages out of frames.
 */
export const hostPageRouting: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  const kind = hostKind(req);
  if (kind === "single") return next();
  if (req.method !== "GET" && req.method !== "HEAD") return next();

  // originalUrl, not req.path: under the app-wide fallback mount req.url is stripped.
  const originalUrl = req.originalUrl;
  const queryAt = originalUrl.indexOf("?");
  const pathname = queryAt === -1 ? originalUrl : originalUrl.slice(0, queryAt);
  const search = queryAt === -1 ? "" : originalUrl.slice(queryAt);

  const decision = decidePageHost(kind, pathname, search);
  if (decision.type === "redirect") return redirect(req, res, next, redirectTargetFor(decision.to, originalUrl));
  if (decision.type === "same-host-path") return redirect(req, res, next, redirectTargetFor("portal", `${decision.path}${search}`));

  if (kind === "portal") {
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'");
  } else if (kind === "staff") {
    // Staff pages may only be framed by the staff site itself (its own same-origin iframes keep working).
    res.setHeader("Content-Security-Policy", "frame-ancestors 'self'");
  }
  next();
};
