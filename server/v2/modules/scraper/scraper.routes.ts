import { Router } from 'express';
import { scraperController } from './scraper.controller';
import { validate } from '../../middlewares/validation.middleware';
import {
  createScraperValidator,
  updateScraperValidator,
  scrapeValidator,
  importPageValidator,
} from './scraper.validator';

const router = Router();

// Scrape a supplier deal from a pasted URL (quote-form Import button).
// Registered before "/:id" so "scrape" isn't captured as an id.
router.post('/scrape', validate(scrapeValidator), scraperController.scrape);

// Import a deal from a page the user's own browser captured (bookmarklet), for
// credentialed suppliers. Also before "/:id".
router.post('/import-page', validate(importPageValidator), scraperController.importPage);

// Per-org supplier scraper config management (org settings UI).
router.get('/', scraperController.list);
router.get('/:id', scraperController.getById);
router.post('/', validate(createScraperValidator), scraperController.create);
router.patch('/:id', validate(updateScraperValidator), scraperController.update);
// Approve (or re-flag) the AI-generated extraction spec for this supplier.
router.post('/:id/approve-spec', scraperController.approveSpec);
router.delete('/:id', scraperController.remove);

export default router;
