import type { Request, RequestHandler } from 'express';
import { AppError } from '../../utils/error-handler';
import { portalBrandingService } from './portal-branding.service';
import { isPortalRequest } from './portal.middleware';

/** Same contract as the rest of the portal: AppErrors pass through, anything else becomes a plain 500 message. */
function handle(fallbackMessage: string, fn: (req: Request) => Promise<{ body: unknown; cache: string }>): RequestHandler {
  return async (req, res, next) => {
    try {
      const { body, cache } = await fn(req);
      res.setHeader('Cache-Control', cache);
      res.json(body);
    } catch (err) {
      if (err instanceof AppError) return next(err);
      console.error(`${fallbackMessage}:`, err);
      next(new AppError(fallbackMessage, 500));
    }
  };
}

export const portalBrandingController = {
  /** GET /branding — the signed-in customer's agency. */
  forSession: handle('Failed to load branding', async (req) => {
    if (!isPortalRequest(req)) throw new AppError('Unauthorized', 401);
    return { body: await portalBrandingService.getForClient(req.portalClient.clientId), cache: 'private, no-store' };
  }),

  /** GET /branding/:slug — public; always 200. */
  forSlug: handle('Failed to load branding', async (req) => {
    const slug = String(req.params.slug ?? '');
    return { body: await portalBrandingService.getForSlug(slug), cache: 'public, max-age=300' };
  }),
};
