import type { NextFunction, Request, Response } from 'express';
import { isPortalRequest } from './portal.middleware';

/**
 * In-memory limiter keyed by the signed-in customer (not the network address, which a mobile network or a
 * shared Wi-Fi shares between customers). Must run after `portalAuth`. Single process only.
 */
export function createClientRateLimiter(opts: { max: number; windowMs: number; message: string }) {
  const buckets = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!isPortalRequest(req)) {
      next();
      return;
    }
    const now = Date.now();
    if (buckets.size > 10_000) {
      buckets.forEach((b, k) => {
        if (b.resetAt <= now) buckets.delete(k);
      });
    }
    const key = req.portalClient.clientId;
    const bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
      next();
      return;
    }
    bucket.count += 1;
    if (bucket.count > opts.max) {
      res.setHeader('Retry-After', String(Math.ceil((bucket.resetAt - now) / 1000)));
      res.status(429).json({ error: opts.message });
      return;
    }
    next();
  };
}
