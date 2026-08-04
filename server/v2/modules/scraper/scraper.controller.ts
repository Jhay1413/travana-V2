import { Request, Response } from 'express';
import { asyncHandler } from '../../utils/async-handler';
import { successResponse } from '../../utils/response';
import { getScope } from '../../utils/scope';
import { scraperService } from './scraper.service';

export const scraperController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const data = await scraperService.list(getScope(req));
    return successResponse(res, data, 'Supplier scrapers retrieved');
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const data = await scraperService.getById(String(req.params.id), getScope(req));
    return successResponse(res, data, 'Supplier scraper retrieved');
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const data = await scraperService.create(req.body, scope, scope.userId ?? undefined);
    return successResponse(res, data, 'Supplier scraper created', 201);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const data = await scraperService.update(String(req.params.id), req.body, getScope(req));
    return successResponse(res, data, 'Supplier scraper updated');
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    await scraperService.remove(String(req.params.id), getScope(req));
    return res.status(204).send();
  }),

  // Used by the quote form's "Import" button: resolve the supplier from the URL
  // for this org, then scrape. Returns the ScraperJson the import pipeline eats.
  scrape: asyncHandler(async (req: Request, res: Response) => {
    const { url, supplierKey, adults, children, infants } = req.body;
    const data = await scraperService.scrapeFromUrl(
      url,
      getScope(req),
      { adults, children, infants },
      supplierKey,
    );
    return successResponse(res, data, 'Scraped supplier deal');
  }),
};
