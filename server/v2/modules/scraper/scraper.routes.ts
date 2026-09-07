import { Router } from 'express';
import { scraperController } from './scraper.controller';
import { requirePlatformAdmin } from '../../middlewares/auth';
import { validate } from '../../middlewares/validation.middleware';
import {
  createScraperValidator,
  updateScraperValidator,
  scrapeValidator,
  importPageValidator,
  savePicksValidator,
} from './scraper.validator';

const router = Router();

// Scrape a supplier deal from a pasted URL (quote-form Import button).
// Registered before "/:id" so "scrape" isn't captured as an id.
router.post('/scrape', validate(scrapeValidator), scraperController.scrape);

// Import a deal from a page the user's own browser captured (bookmarklet), for
// credentialed suppliers. Also before "/:id".
router.post('/import-page', validate(importPageValidator), scraperController.importPage);

// Field-picker submission: merge a click-verified field mapping into a
// supplier's extraction spec. Deliberately NOT gated behind requirePlatformAdmin
// like the mutations below — picking is an ordinary agent's workflow while
// looking at a deal page, not a config-management action, and gating it the
// same way would make the feature unusable for the people it's built for.
// scraperService.savePicks still protects rules inside a spec that's been
// archived as `approved: true`: an ordinary agent's pick can't overwrite one
// of those (only add a rule for a field the approved spec didn't cover), and
// its output is always flagged specNeedsReview regardless of who submitted it.
router.post('/picks', validate(savePicksValidator), scraperController.savePicks);

// Per-org supplier scraper config management (org settings UI).
// Reads stay open to every authenticated user: the supplier dropdown and the
// import flow above both depend on them, and `supplier_scraper` is deliberately
// platform-wide (shared/schema.ts:320-323) so any agent needs to see every spec.
router.get('/', scraperController.list);
router.get('/:id', scraperController.getById);
// Mutations gated to platform admins: a spec here is shared by every tenant, so
// an ordinary agent editing or deleting one breaks extraction for the whole
// platform, not just their own org (EXTRACTION_AUDIT.md §1.5).
router.post('/', requirePlatformAdmin, validate(createScraperValidator), scraperController.create);
router.patch('/:id', requirePlatformAdmin, validate(updateScraperValidator), scraperController.update);
// Approve (or re-flag) the AI-generated extraction spec for this supplier.
router.post('/:id/approve-spec', requirePlatformAdmin, scraperController.approveSpec);
router.delete('/:id', requirePlatformAdmin, scraperController.remove);

export default router;
