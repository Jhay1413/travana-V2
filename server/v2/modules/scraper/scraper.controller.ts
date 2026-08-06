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

  // Marks an AI-generated extraction spec reviewed (or sends it back for
  // review). Does not gate importing — see scraperService.approveSpec.
  approveSpec: asyncHandler(async (req: Request, res: Response) => {
    const approve = req.body?.approve !== false;
    const data = await scraperService.approveSpec(String(req.params.id), getScope(req), approve);
    return successResponse(res, data, approve ? 'Extraction spec approved' : 'Extraction spec flagged for review');
  }),

  // Manual capture path: the user's own (already logged-in) browser posts the
  // rendered deal page. The supplier is worked out from the captured URL, and an
  // unrecognised site gets a supplier created for it, so the response says what
  // happened — a new supplier and its fresh spec both want reviewing.
  importPage: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const result = await scraperService.importFromPage(req.body, scope, scope.userId ?? undefined);
    const message = result.created
      ? `Created supplier "${result.supplierName}" from this page and generated its extraction spec — approve it in Supplier Scrapers.`
      : result.specRestored
        ? `Reused the saved extraction spec for "${result.supplierName}" — nothing was regenerated.`
        : result.specGenerated
        ? `Learned an extraction spec for "${result.supplierName}" from this page — approve it in Supplier Scrapers.`
        : result.specNeedsReview
          ? `Imported from ${result.supplierName} using an UNAPPROVED extraction spec — check the fields, then approve it in Supplier Scrapers.`
          : `Imported deal from ${result.supplierName}`;
    return successResponse(res, result.quote, message);
  }),
};
