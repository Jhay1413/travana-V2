/**
 * Pure helper for scripts/sync-scraper-image-container.ts: returns a copy of a
 * supplier_scraper `config` with ONLY extraction.imageContainerIncludes replaced.
 * Every other key (fields, wait, auth, priceApi, hand-made fixes) is kept as is.
 * `undefined` removes the key.
 */
export type ScraperConfigJson = Record<string, unknown>;

export function withImageContainer(config: unknown, value: unknown): ScraperConfigJson {
  const base: ScraperConfigJson = config && typeof config === "object" ? { ...(config as ScraperConfigJson) } : {};
  const rawExtraction = base.extraction;
  const extraction: ScraperConfigJson =
    rawExtraction && typeof rawExtraction === "object" ? { ...(rawExtraction as ScraperConfigJson) } : {};
  if (value === undefined) delete extraction.imageContainerIncludes;
  else extraction.imageContainerIncludes = value;
  return { ...base, extraction };
}
