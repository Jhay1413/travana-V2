import { Router } from 'express';
import { easyjetController } from './easyjet.controller';
import { validate } from '../../middlewares/validation.middleware';
import { scrapeQuoteValidator } from './easyjet.validator';

const router = Router();

// POST /api/v2/easyjet/scrape — trade-portal deep link → quote-form JSON.
// Scrapes run sequentially through one browser session; a warm session takes
// a few seconds, a full re-login ~20s.
router.post('/scrape', validate(scrapeQuoteValidator), easyjetController.scrapeQuote);

export default router;
