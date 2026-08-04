import { AppError } from '../../utils/error-handler';
import { parseEasyJetDeepLink, buildOffersApiUrl } from './easyjet-link.parser';
import { offersResponseSchema } from './easyjet-offer.schema';
import { mapOfferToScrapedQuote } from './easyjet-offer.mapper';
import { fetchOffers } from './easyjet-browser';
import { buildDefaultContext, type EasyJetScrapeContext } from './easyjet.context';
import type { ScrapeRequestBody, ScrapedQuoteJson } from './easyjet.types';

export const easyjetService = {
  /**
   * Turns a trade-portal deep link into a quote-form-ready ScraperJson object:
   * parse link → authenticated in-browser API call → validate → map.
   *
   * `ctx` carries credentials + browser/auth/fetch config. It defaults to the
   * env-based context so the legacy route and local dev keep working; the
   * config-driven scraper module passes a per-org context instead.
   */
  async scrapeQuoteFromLink(
    input: ScrapeRequestBody,
    ctx: EasyJetScrapeContext = buildDefaultContext(),
  ): Promise<ScrapedQuoteJson> {
    const params = parseEasyJetDeepLink(input.url, {
      adults: input.adults,
      children: input.children,
      infants: input.infants,
    });

    const apiUrl = buildOffersApiUrl(params);
    // Navigate to the hotel page and intercept its offers response (primary);
    // fall back to an in-page fetch of the reconstructed API URL.
    const raw = await fetchOffers(input.url, apiUrl, ctx);

    const parsed = offersResponseSchema.safeParse(raw);
    if (!parsed.success) {
      const issue = parsed.error.errors[0];
      // Most common real-world cause: the package sold out / dates no longer
      // available, which returns a payload without offers.
      throw new AppError(
        `easyJet response did not match the expected shape (${issue.path.join('.')}: ${issue.message}). ` +
          'The package may no longer be available, or easyJet changed their API.',
        502,
      );
    }

    return mapOfferToScrapedQuote(parsed.data, input.url);
  },
};
