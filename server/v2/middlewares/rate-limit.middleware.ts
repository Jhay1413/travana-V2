import type { Request, Response, NextFunction } from "express";

interface RateLimitOptions {
  /** Max requests allowed per client IP within the window. */
  max: number;
  windowMs: number;
  message?: string;
  /**
   * Optional custom 429 reply. Receives the response and the seconds until the
   * window resets. Without it the limiter answers with the staff envelope
   * ({ success: false, message }), unchanged.
   */
  onLimit?: (res: Response, retryAfterSeconds: number) => void;
  /**
   * Optional bucket key. Without it the bucket is the client IP (req.ip). Return null to skip limiting the request.
   */
  keyFn?: (req: Request) => string | null;
}

interface Bucket {
  count: number;
  resetAt: number;
}

/**
 * Small in-memory per-IP limiter (single process only). Relies on `req.ip`,
 * which honours `app.set("trust proxy", 1)` configured in setupAuth.
 */
export function createRateLimiter({ max, windowMs, message, onLimit, keyFn }: RateLimitOptions) {
  const buckets = new Map<string, Bucket>();

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();

    if (buckets.size > 10_000) {
      buckets.forEach((b, key) => {
        if (b.resetAt <= now) buckets.delete(key);
      });
    }

    const key = keyFn ? keyFn(req) : (req.ip ?? "unknown");
    if (key === null) return next();
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }

    bucket.count += 1;
    if (bucket.count > max) {
      const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);
      res.setHeader("Retry-After", String(retryAfter));
      if (onLimit) {
        onLimit(res, retryAfter);
        return;
      }
      return res.status(429).json({
        success: false,
        message: message ?? "Too many requests — please try again later.",
      });
    }
    return next();
  };
}
