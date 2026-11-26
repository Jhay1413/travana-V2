import type { Request, RequestHandler, Response } from 'express';
import { AppError } from '../../utils/error-handler';
import { isPortalRequest } from './portal.middleware';
import type { PortalRequest } from './portal.types';

/**
 * Wraps a handler so any AppError flows to the portal error middleware as-is and
 * any unexpected failure is logged and surfaced with the endpoint's own message
 * (the portal client displays it). Resolves once the response has been written.
 */
export function handle(
  fallbackMessage: string,
  fn: (req: Request, res: Response) => Promise<void>,
): RequestHandler {
  return async (req, res, next) => {
    try {
      await fn(req, res);
    } catch (err) {
      if (err instanceof AppError) return next(err);
      console.error(`${fallbackMessage}:`, err);
      next(new AppError(fallbackMessage, 500));
    }
  };
}

/** Same as `handle`, for routes behind `portalAuth`: the handler receives a typed portal request. */
export function handleAuthed(
  fallbackMessage: string,
  fn: (req: PortalRequest, res: Response) => Promise<void>,
): RequestHandler {
  return handle(fallbackMessage, async (req, res) => {
    if (!isPortalRequest(req)) throw new AppError('Unauthorized', 401);
    await fn(req, res);
  });
}
