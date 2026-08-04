import type { ScraperAdapter, ScraperAdapterType } from '../scraper-engine.types';
import { easyjetAdapter } from './easyjet.adapter';

// Registry of code adapters keyed by adapterType. Add an entry when a supplier's
// login/fetch shape can't be expressed by an existing adapter's config.
const adapters: Record<ScraperAdapterType, ScraperAdapter> = {
  easyjet: easyjetAdapter,
};

export function getAdapter(type: ScraperAdapterType): ScraperAdapter | null {
  return adapters[type] ?? null;
}
