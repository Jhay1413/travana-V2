// Points Jet2's spec at the flight details in its own dataLayer blob.
//
//   npx tsx --env-file-if-exists=.env scripts/fix-jet2-flights.ts          # dry run
//   npx tsx --env-file-if-exists=.env scripts/fix-jet2-flights.ts --apply
//
// Jet2 renders flight times only inside the "Compare airport, dates & prices"
// modal, so a capture taken without opening it has no itinerary to parse. Its
// analytics blob does carry them, as loose values rather than an itinerary:
//
//   dimension19            "16:30"   outbound departure
//   dimension20            "11:10"   inbound departure
//   departureAirportCode   "NCL"
//   destinationAirportCode "REU"
//
// No itinerary parser can recognise that shape, so the interpreter now also
// accepts bare "HH:MM" times from named spec fields. These rules supply them.
// Arrival times are genuinely absent from the blob — only opening the modal
// before capturing yields those.
import { Pool } from 'pg';

const APPLY = process.argv.includes('--apply');
const P = '0.ecommerce.detail.products[0]';

const NEW_FIELDS: Record<string, Record<string, unknown>> = {
  outbound_depart_time: { from: 'text', jsonPath: `${P}.dimension19` },
  inbound_depart_time: { from: 'text', jsonPath: `${P}.dimension20` },
  departure_airport: { from: 'text', jsonPath: `${P}.departureAirportCode` },
  arrival_airport: { from: 'text', jsonPath: `${P}.destinationAirportCode` },
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query(
  `select id, supplier_key, config from supplier_scraper where supplier_key like 'jet2%'`,
);
if (rows.length === 0) console.log('No jet2 supplier row found.');

for (const row of rows) {
  const config = row.config ?? {};
  const spec = config.extraction;
  if (!spec?.fields) {
    console.log(`${row.supplier_key}: no extraction spec yet — skipped.`);
    continue;
  }

  console.log(`\n${row.supplier_key}`);
  for (const [name, rule] of Object.entries(NEW_FIELDS)) {
    const before = spec.fields[name];
    console.log(`  ${name.padEnd(22)} ${before ? '(replacing)' : '(new)      '} -> ${rule.jsonPath}`);
  }

  if (!APPLY) continue;
  const nextConfig = {
    ...config,
    extraction: { ...spec, fields: { ...spec.fields, ...NEW_FIELDS } },
  };
  await pool.query(`update supplier_scraper set config = $1, updated_at = now() where id = $2`, [nextConfig, row.id]);
  console.log('  written.');
}

if (!APPLY) console.log('\n(dry run — re-run with --apply to write)');
await pool.end();
