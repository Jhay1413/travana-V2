// Cleans up the TUI suppliers and fixes the overfitted rules the AI generated.
//
//   npx tsx --env-file-if-exists=.env scripts/fix-tui-spec.ts          # dry run
//   npx tsx --env-file-if-exists=.env scripts/fix-tui-spec.ts --apply  # write
//
// Two things went wrong:
//
// 1. DUPLICATE SUPPLIER. A "tui" row already existed but carried no deepLink, so
//    URL matching couldn't see it and the capture created "tui-2" alongside it.
//    The service now adopts a keyless row instead, but these two already exist:
//    this keeps the NEWER spec (learned from a real captured page) and folds it
//    onto the original "tui" row, then removes "tui-2".
//
// 2. ACCOMMODATION never matched. The generated rule was
//        ^(.*?)\s*\n\s*IN PRAGUE, CZECH REPUBLIC
//    which is wrong twice over: "^" anchors to the START OF THE WHOLE TEXT (the
//    page begins "Shortlist (0)…", not the hotel name), and the city/country are
//    this deal's literal values. TUI prints the hotel name on the line directly
//    above "IN <CITY>, <COUNTRY>", so anchor on that shape instead.
import { Pool } from 'pg';

const APPLY = process.argv.includes('--apply');
const FIXED_ACCOMMODATION = '\\n([^\\n]+)\\n+\\s*IN [A-Z][A-Z ]*,';

// 3. room_type required the name to END in room/suite/apartment/studio/villa/
//    classic/deluxe — learned from "Double or Twin Classic", so it extracts
//    NOTHING from "Double or Twin Standard", "Triple Standard", "Family Room
//    Standard". TUI always prints the selected room on the line above its
//    "Sleeps:" line, so anchor on that instead of guessing the vocabulary.
const FIXED_ROOM_TYPE = '\\n([^\\n]+)\\n+\\s*Sleeps:';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { rows } = await pool.query(
  `select id, org_id, supplier_key, config from supplier_scraper where supplier_key in ('tui','tui-2') order by supplier_key`,
);
const original = rows.find((r) => r.supplier_key === 'tui');
const captured = rows.find((r) => r.supplier_key === 'tui-2');

if (!captured) {
  console.log('No "tui-2" row — nothing to merge. Checking "tui" only.');
}

// The spec worth keeping is the captured one (learned from a real deal page).
const source = captured ?? original;
if (!source) {
  console.log('No TUI supplier rows found.');
  await pool.end();
  process.exit(1);
}

const spec = source.config?.extraction;
if (!spec?.fields) {
  console.log('That TUI row has no extraction spec yet — nothing to fix.');
  await pool.end();
  process.exit(1);
}

console.log('accommodation BEFORE :', JSON.stringify(spec.fields.accommodation?.regex));
console.log('accommodation AFTER  :', JSON.stringify(FIXED_ACCOMMODATION));
console.log('room_type     BEFORE :', JSON.stringify(spec.fields.room_type?.regex));
console.log('room_type     AFTER  :', JSON.stringify(FIXED_ROOM_TYPE));

const nextConfig = {
  ...source.config,
  // Keep the deepLink so URL matching finds it.
  deepLink: source.config?.deepLink ?? { hostIncludes: 'tui.co.uk', pathIncludes: '' },
  captureOnly: true,
  specNeedsReview: true,
  extraction: {
    ...spec,
    fields: {
      ...spec.fields,
      accommodation: { from: 'text', group: 1, regex: FIXED_ACCOMMODATION },
      room_type: { from: 'text', group: 1, regex: FIXED_ROOM_TYPE },
    },
  },
};

const target = original ?? captured;
console.log(`\nplan: write the fixed spec onto "${target.supplier_key}" (${target.id})`);
if (original && captured) console.log(`      then DELETE the duplicate "tui-2" (${captured.id})`);

if (!APPLY) {
  console.log('\n(dry run — re-run with --apply to write)');
  await pool.end();
  process.exit(0);
}

await pool.query(`update supplier_scraper set config = $1, updated_at = now() where id = $2`, [nextConfig, target.id]);
console.log('written.');
if (original && captured) {
  await pool.query(`delete from supplier_scraper where id = $1`, [captured.id]);
  console.log('duplicate "tui-2" removed.');
}
await pool.end();
