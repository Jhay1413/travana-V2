import type { NextFunction, Request, Response } from 'express';
import { AppError } from '../../utils/error-handler';
import { portalAuthService } from './portal-auth.service';
import type { PortalRequest } from './portal.types';

/** Narrows a request to one that passed `portalAuth`. */
export function isPortalRequest(req: Request): req is PortalRequest {
  return 'portalClient' in req && typeof (req as Partial<PortalRequest>).portalClient === 'object';
}

/** Requires a valid portal bearer token for a live (non-deleted) client. */
export async function portalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  try {
    const payload = await portalAuthService.verifySession(req.headers.authorization);
    (req as PortalRequest).portalClient = payload;
    next();
  } catch (err) {
    next(err);
  }
}

/**
 * Error formatter for the portal routers. The customer portal client reads
 * `{ error: string }` (not the staff `{ success, message }` envelope), so portal
 * errors keep that contract while still flowing through AppError.
 */
export function portalErrorHandler(err: Error, _req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }
  if (err instanceof AppError) {
    res.status(err.statusCode).json(err.code ? { error: err.message, code: err.code, ...(err.details ?? {}) } : { error: err.message });
    return;
  }
  console.error('Portal error:', err);
  res.status(500).json({ error: 'Something went wrong' });
}
