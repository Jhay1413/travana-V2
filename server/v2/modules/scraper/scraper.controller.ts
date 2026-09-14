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
  //
  // The response body stays backward-compatible: the client reads the quote's
  // fields directly off `data` (see client/src/features/quote/api/use-easyjet-import.ts),
  // so the quote is spread at the top level rather than nested — `validation` is
  // added alongside it as a new, additive field existing callers simply ignore.
  scrape: asyncHandler(async (req: Request, res: Response) => {
    const { url, supplierKey, adults, children, infants } = req.body;
    const { quote, validation } = await scraperService.scrapeFromUrl(
      url,
      getScope(req),
      { adults, children, infants },
      supplierKey,
    );
    return successResponse(res, { ...quote, validation }, 'Scraped supplier deal');
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
    // Same backward-compatible shape as `scrape` above: the quote's fields stay
    // at the top level of `data` (client/src/features/quote/api/use-page-capture-import.ts
    // reads `data` as the quote directly), `validation` is additive.
    //
    // `picks` is ONLY present when the capture carried field-picker picks
    // (input.picked) — see importFromPage/applyPickedFields. It is spread in
    // the same additive way as `validation`: an older client that has never
    // heard of `picks` just ignores the key. The client-side guard that
    // matters is the other direction — use-page-capture-import.ts treats a
    // picker payload that comes back WITHOUT a `picks` key as a hard error,
    // specifically so a future regression here can't silently reproduce the
    // whitelist bug this feature fixes. `applied`/`problems`/`preserved` are
    // reshaped to match SupplierScraperPicksResult (supplier-scraper feature)
    // so the client can render both paths with the same component.
    return successResponse(
      res,
      {
        ...result.quote,
        validation: result.validation,
        ...(result.picks
          ? {
              picks: {
                supplierKey: result.supplierKey,
                applied: result.picks.applied,
                problems: result.picks.problems,
                preserved: result.picks.preserved,
                specNeedsReview: true,
              },
            }
          : {}),
      },
      message,
    );
  }),

  // Field-picker submission: merges a click-verified field mapping into the
  // supplier's stored extraction spec. Open to any authenticated agent (see
  // scraper.routes.ts / scraperService.savePicks for why) — the response
  // shape is fixed for the picker UI: { supplierKey, applied, problems,
  // preserved, specNeedsReview }.
  savePicks: asyncHandler(async (req: Request, res: Response) => {
    const scope = getScope(req);
    const result = await scraperService.savePicks(req.body, scope, scope.userId ?? undefined);
    return successResponse(res, result, 'Field picks saved to the extraction spec');
  }),
};
