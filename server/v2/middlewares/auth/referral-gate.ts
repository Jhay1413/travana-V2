import type { Request, Response, NextFunction } from "express";
import { REFERRAL_AGENT_ALLOWED_MOUNTS, REFERRAL_AGENT_ALLOWED_PATHS } from "./referral-allowed-mounts";

/** The first path segment after /api/v2 (or /api) of the mount being served, e.g. "quotes". */
function mountOf(req: Request): string {
  const base = req.baseUrl || "";
  const match = /^\/api(?:\/v2)?\/([^/?]+)/.exec(base);
  return match ? match[1] : "";
}

export function restrictReferralAgent(req: Request, res: Response, next: NextFunction): void {
  const roles = (req.orgRoles && req.orgRoles.length > 0 ? req.orgRoles : [req.orgRole ?? ""]) as string[];
  if (!roles.includes("referral_agent")) {
    next();
    return;
  }
  if (REFERRAL_AGENT_ALLOWED_MOUNTS.includes(mountOf(req))) {
    next();
    return;
  }
  const path = ((req.baseUrl || "") + (req.path === "/" ? "" : req.path || "")).replace(/^\/api(?:\/v2)?/, "");
  if (REFERRAL_AGENT_ALLOWED_PATHS.some((allowed) => path === allowed || path.startsWith(allowed + "/"))) {
    next();
    return;
  }
  res.status(403).json({ message: "You do not have permission to access this resource" });
}
