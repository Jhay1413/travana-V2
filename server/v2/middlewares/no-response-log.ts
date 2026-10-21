import type { NextFunction, Request, Response } from 'express';

/**
 * Marks the response as sensitive: the global request logger (server/index.ts)
 * must not print its JSON body. Mount on routers that can return credentials.
 */
export function noResponseLog(_req: Request, res: Response, next: NextFunction): void {
  res.locals.skipResponseLog = true;
  next();
}
