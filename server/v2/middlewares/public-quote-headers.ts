import type { NextFunction, Request, Response } from "express";

/**
 * Headers for everything that carries a public quote link (the API and the /view-quote page): never cached, never
 * indexed, and the link never leaks to other sites through the Referer header.
 */
export function publicQuoteHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Robots-Tag", "noindex, nofollow");
  res.setHeader("Referrer-Policy", "no-referrer");
  next();
}
