// Corrects two rules in easyJet's stored extraction spec.
//
//   npx tsx --env-file-if-exists=.env scripts/fix-easyjet-spec.ts          # dry run
//   npx tsx --env-file-if-exists=.env scripts/fix-easyjet-spec.ts --apply  # write
//
// 1. sales_price matched "total £4,663" — the TAX-INCLUSIVE total — instead of
//    the headline holiday price (£4,573). The page reads:
//        £4,573 / from £2,287 pp / +£90 taxes & charges, total £4,663
//    so the fixed rule anchors on the "<price> from <pp> pp" structure.
//
// 2. arrival_airport_name was generated as "Rhodes, Diagoras\s*\((RHO)\)" —
//    pinned to the ONE deal the spec was learned from. Left in place it stamps
//    RHO on every future easyJet deal regardless of destination, which is worse
//    than leaving the field empty. It is removed here; the destination airport
//    is better sourced from the flight-details modal, which the interpreter
//    already prefers when a capture includes one.
import { Pool } from 'pg';

const APPLY = process.argv.includes('--apply');
const SUPPLIER = 'easyjet';

const FIXED_SALES_PRICE = '£([\\d,]+)\\s*from\\s*£[\\d,]+\\s*pp';

// 3. country/destination/resort each read ONE URL SEGMENT TOO FAR. The path is
//        /en/holidays/trade-portal/greece/rhodes/pefkos/<hotel-slug>
//         0    1          2          3      4      5        6
//    so the stored 4/5/6 yield Rhodes/Pefkos/<hotel> instead of
//    Greece/Rhodes/Pefkos — the hotel name ends up in the Resort box.
const FIXED_SEGMENTS: Record<string, number> = { country: 3, destination: 4, resort: 5 };

// 4. accommodation was generated as "([A-Z][\w\s,\-]+,? a Luxury Collection
//    Resort, Rhodes)" — pinned to this ONE hotel, so it matches nothing on any
//    other deal, and here it ran backwards into the price block ("discount
//    Continue LUXURY COLLECTION Play video …"). easyJet always prints the hotel
//    name on the line directly above its review count, so anchor on that shape.
const FIXED_ACCOMMODATION = '\\n([^\\n]+)\\n\\d[\\d,]*\\s+reviews';

// 5. adults read the URL's "aa=1" and produced 1 adult on a 2-adult deal. The
//    URL is ambiguous here (aa=1 alongside rooms=2), but the page states the
//    party in words — "2 adults, 1 room" — so read that instead.
// 6. no_of_nights was generated as a URL date-RANGE regex with group 0 and no
//    transform, which yields nothing; the page prints "7 nights" plainly.
const FIXED_TEXT_RULES: Record<string, { regex: string; transform?: string }> = {
  adults: { regex: '(\\d+)\\s*adults?\\b', transform: 'number' },
  no_of_nights: { regex: '(\\d+)\\s*nights?\\b', transform: 'number' },
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { rows } = await pool.query(
  `select id, org_id, config from supplier_scraper where supplier_key = $1`,
  [SUPPLIER],
);
if (rows.length === 0) {
  console.log(`No "${SUPPLIER}" scraper row found.`);
  await pool.end();
  process.exit(1);
}

for (const row of rows) {
  const config = row.config ?? {};
  const spec = config.extraction;
  if (!spec?.fields) {
    console.log(`row ${row.id}: no extraction spec yet — nothing to fix.`);
    continue;
  }

  console.log(`\nrow ${row.id} (org ${row.org_id})`);
  const nextFields = { ...spec.fields };

  console.log('  sales_price             :', JSON.stringify(spec.fields.sales_price?.regex), '→', JSON.stringify(FIXED_SALES_PRICE));
  nextFields.sales_price = { ...(nextFields.sales_price ?? { from: 'text', group: 1 }), regex: FIXED_SALES_PRICE, transform: 'number' };

  console.log('  arrival_airport_name    :', JSON.stringify(spec.fields.arrival_airport_name?.regex ?? '(already absent)'), '→ removed');
  delete nextFields.arrival_airport_name;

  for (const [field, segment] of Object.entries(FIXED_SEGMENTS)) {
    console.log(`  ${field.padEnd(23)} : urlSegment ${spec.fields[field]?.urlSegment} → ${segment}`);
    nextFields[field] = { ...(nextFields[field] ?? { from: 'url', transform: 'titleCase' }), from: 'url', urlSegment: segment };
  }

  console.log('  accommodation           :', JSON.stringify(spec.fields.accommodation?.regex), '→', JSON.stringify(FIXED_ACCOMMODATION));
  nextFields.accommodation = { from: 'text', group: 1, regex: FIXED_ACCOMMODATION };

  for (const [field, rule] of Object.entries(FIXED_TEXT_RULES)) {
    const before = spec.fields[field];
    console.log(`  ${field.padEnd(23)} : ${JSON.stringify(before?.regex)} (${before?.from}) → ${JSON.stringify(rule.regex)} (text)`);
    nextFields[field] = { from: 'text', group: 1, ...rule };
  }

  const nextConfig = { ...config, extraction: { ...spec, fields: nextFields } };

  if (!APPLY) {
    console.log('  (dry run — re-run with --apply to write)');
    continue;
  }
  await pool.query(`update supplier_scraper set config = $1, updated_at = now() where id = $2`, [nextConfig, row.id]);
  console.log('  written.');
}

await pool.end();
