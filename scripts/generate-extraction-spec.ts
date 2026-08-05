/**
 * Generate (via AI) a declarative extraction spec for a DOM-based supplier and
 * save it into that supplier's config. Run once per supplier (or when their page
 * layout changes). Afterwards every scrape just pulls the stored spec from the
 * config and runs it through the fixed interpreter — no per-scrape AI cost.
 *
 * Flow: load the supplier row (config + decrypted credentials) → log in and
 * render the deal page → capture title + innerText → ask the AI for a spec →
 * validate → save to config.extraction.
 *
 *   npx tsx --env-file-if-exists=.env scripts/generate-extraction-spec.ts "<dealUrl>" [supplierKey] [orgId]
 *
 * Needs OPENAI_API_KEY and BROWSERLESS_TOKEN. Pass --dry to print without saving.
 */
import { eq } from 'drizzle-orm';
import { db } from '../server/v2/config/database';
import { supplier_scraper } from '../shared/schema';
import { decrypt } from '../server/v2/utils/encryption';
import { scrapeViaDom, captureRenderedDom } from '../server/v2/modules/easyjet/easyjet-browser';
import { extractionAiService } from '../server/v2/modules/scraper/extraction/extraction-ai.service';
import type { EasyJetScrapeContext } from '../server/v2/modules/easyjet/easyjet.context';

const DEAL_URL = process.argv[2];
const SUPPLIER_KEY = process.argv[3] || 'jet2';
const ORG_ID = process.argv[4] && !process.argv[4].startsWith('--') ? process.argv[4] : process.env.SCRAPER_SEED_ORG_ID;
const DRY = process.argv.includes('--dry');

function buildContext(config: any, creds: any): EasyJetScrapeContext {
  const a = config.auth ?? {};
  const b = config.browser ?? {};
  return {
    credentials: { username: creds.username, password: creds.password, abtaNumber: creds.abtaNumber },
    browser: {
      backend: b.backend || 'browserless',
      browserlessToken: process.env.BROWSERLESS_TOKEN,
      browserlessBase: process.env.BROWSERLESS_URL || 'wss://production-lon.browserless.io',
      browserlessPath: b.browserlessPath || '/chromium/stealth',
      proxy: b.proxy,
      proxyCountry: b.proxyCountry || 'gb',
      sessionTimeoutMs: b.sessionTimeoutMs || 60000,
    },
    auth: {
      loginUrl: a.loginUrl || '',
      identityHost: a.identityHost || '',
      usernameSelector: a.usernameSelector || '',
      passwordSelector: a.passwordSelector || '',
      submitSelector: a.submitSelector || '',
      abtaSelector: a.abtaSelector,
      formSelector: a.formSelector || a.usernameSelector || '',
      errorSelector: a.errorSelector,
    },
    fetch: { apiPath: (config.fetch ?? {}).apiPath || '/api/', originPrefix: (config.fetch ?? {}).originPrefix || '' },
  };
}

async function main(): Promise<void> {
  if (!DEAL_URL) {
    console.error('Usage: tsx scripts/generate-extraction-spec.ts "<dealUrl>" [supplierKey] [orgId] [--dry]');
    process.exit(1);
  }

  let rows = await db.select().from(supplier_scraper).where(eq(supplier_scraper.supplier_key, SUPPLIER_KEY));
  if (ORG_ID) rows = rows.filter((r) => r.org_id === ORG_ID);
  const row = rows.find((r) => r.encrypted_credentials) ?? rows[0];
  if (!row) {
    console.error(`No supplier_scraper row for key "${SUPPLIER_KEY}"${ORG_ID ? ` in org ${ORG_ID}` : ''}.`);
    process.exit(1);
  }
  const creds = row.encrypted_credentials ? JSON.parse(decrypt(row.encrypted_credentials)) : {};
  const config = (row.config ?? {}) as any;
  const ctx = buildContext(config, creds);
  console.log(`Supplier: ${row.supplier_name} (org ${row.org_id})`);

  console.log('Logging in and rendering the deal page…');
  const dom = await scrapeViaDom(DEAL_URL, ctx, (page) => captureRenderedDom(page, '£\\s?[\\d,]{2,}', 30000));
  console.log(`Captured page: "${dom.title}" (${dom.text.length} chars)`);

  console.log('Asking the AI to write an extraction spec…');
  const spec = await extractionAiService.generateSpecFromDom({ title: dom.title, text: dom.text, url: DEAL_URL }, row.supplier_name);
  console.log('\n=== Generated extraction spec ===');
  console.log(JSON.stringify(spec, null, 2));

  if (DRY) {
    console.log('\n(--dry) Not saved. Paste the spec into the supplier config to use it.');
    process.exit(0);
  }

  await db
    .update(supplier_scraper)
    .set({ config: { ...config, extraction: spec }, updated_at: new Date() })
    .where(eq(supplier_scraper.id, row.id));
  console.log(`\nSaved extraction spec to supplier "${row.supplier_name}" config. Future scrapes will use it.`);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
