import type { ScraperAdapter, ScraperAdapterType } from '../scraper-engine.types';
import { easyjetAdapter } from './easyjet.adapter';
import { domAdapter } from './dom.adapter';

// Registry of code adapters keyed by adapterType. 'dom' is the generic
// config-driven DOM adapter (any supplier with an extraction spec); 'jet2' is a
// legacy alias that maps to it so existing rows keep working.
const adapters: Partial<Record<ScraperAdapterType, ScraperAdapter>> = {
  easyjet: easyjetAdapter,
  dom: domAdapter,
  jet2: domAdapter,
};

export function getAdapter(type: ScraperAdapterType): ScraperAdapter | null {
  return adapters[type] ?? null;
}
