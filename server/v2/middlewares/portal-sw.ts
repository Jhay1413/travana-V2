import type { NextFunction, Request, RequestHandler, Response } from "express";
import { hostKind } from "../utils/hosts";
import { PORTAL_SW_RETIRE_SCRIPT } from "../utils/portal-sw-retire";

/**
 * GET /portal-sw.js. On the staff host, and only when a portal host is configured, the old portal worker is replaced by
 * the one that retires itself and its push subscription. On the portal host, and on a single host (no PORTAL_BASE_URL),
 * this does nothing and the normal file is served unchanged.
 */
export const portalServiceWorker: RequestHandler = (req: Request, res: Response, next: NextFunction) => {
  if (hostKind(req) !== "staff") return next();
  res.status(200);
  res.setHeader("Content-Type", "application/javascript; charset=utf-8");
  // The browser re-checks a worker script on every navigation and push; never let a cache hold the retire script back.
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Service-Worker-Allowed", "/");
  res.send(PORTAL_SW_RETIRE_SCRIPT);
};
