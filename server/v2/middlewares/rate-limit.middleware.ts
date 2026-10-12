import type { Request, Response, NextFunction } from "express";

interface RateLimitOptions {
  /** Max requests allowed per client IP within the window. */
  max: number;
  windowMs: number;
  message?: string;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Small in-memory per-IP limiter (single process only). Relies on `req.ip`,
 * which honours `app.set("trust proxy", 1)` configured in setupAuth.
 */
export function createRateLimiter({ max, windowMs, message }: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();

    if (buckets.size > 10_000) {
      buckets.forEach((b, key) => {
        if (b.resetAt <= now) buckets.delete(key);
      });
    }

    const key = req.ip ?? "unknown";
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      res.setHeader("Retry-After", String(Math.ceil((bucket.resetAt - now) / 1000)));
      return res.status(429).json({
        success: false,
        message: message ?? "Too many requests — please try again later.",
      });
    }
    return next();
  };
}
