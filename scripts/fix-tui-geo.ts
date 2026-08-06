// Fixes TUI's country / destination / resort / accommodation rules.
//
//   npx tsx --env-file-if-exists=.env scripts/fix-tui-geo.ts          # dry run
//   npx tsx --env-file-if-exists=.env scripts/fix-tui-geo.ts --apply  # write
//
// A Maldives deal imported with Country, Destination, Resort AND Accommodation
// all blank. Two independent faults, either of which alone would have done it:
//
// 1. WRONG jsonPath. The geo rules pointed at "packageData.locationMap.*", but
//    TUI's booking JSON keeps it at "packageData.accommodation.locationMap.*".
//    The path never resolved, so every deal silently fell through to the text
//    regexes below — the JSON, which is exact, was never actually used.
//
// 2. THE REGEXES ASSUME A COMMA. They were learned from "IN PRAGUE, CZECH
//    REPUBLIC" and require "IN <CITY>, <COUNTRY>". TUI prints only "IN
//    MALDIVES" when the destination IS the country, so nothing matched at all.
//    Country now treats the city half as optional and uncaptured, so group 1 is
//    the country either way.
//
// Also: resort took group 0 (the WHOLE match), so even Prague imported a resort
// literally named "IN PRAGUE, CZECH REPUBLIC"; and accommodation was anchored
// with "^", which matches the start of the whole page ("Shortlist (0)…"), not
// the hotel line.
//
// Titles are title-cased because the page shouts them in all caps.
import { Pool } from 'pg';

const APPLY = process.argv.includes('--apply');
const A = 'packageData.accommodation';

const FIXED_FIELDS = {
  accommodation: { from: 'text', group: 1, jsonPath: `${A}.name`, regex: '\\n([^\\n]+)\\n+\\s*IN [A-Z][A-Z ]*' },
  // The city half is optional and NOT captured, so group 1 is the country in
  // both "IN PRAGUE, CZECH REPUBLIC" and a bare "IN MALDIVES".
  country: { from: 'text', group: 1, jsonPath: `${A}.locationMap.COUNTRY`, regex: 'IN (?:[A-Z ]+?,\\s*)?([A-Z ]+)', transform: 'titleCase' },
  destination: { from: 'text', group: 1, jsonPath: `${A}.locationMap.DESTINATION`, regex: 'IN ([A-Z ]+?),', transform: 'titleCase' },
  resort: { from: 'text', group: 1, jsonPath: `${A}.locationMap.RESORT`, regex: 'IN ([A-Z ]+?),', transform: 'titleCase' },
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

const { rows } = await pool.query(
  `select id, supplier_key, config from supplier_scraper where supplier_key = 'tui'`,
);
const row = rows[0];
if (!row?.config?.extraction?.fields) {
  console.log('No "tui" supplier with an extraction spec — nothing to fix.');
  await pool.end();
  process.exit(1);
}

const fields = row.config.extraction.fields;
for (const key of Object.keys(FIXED_FIELDS) as (keyof typeof FIXED_FIELDS)[]) {
  console.log(`${key}`);
  console.log(`  BEFORE: ${JSON.stringify(fields[key])}`);
  console.log(`  AFTER : ${JSON.stringify(FIXED_FIELDS[key])}`);
}

const nextConfig = {
  ...row.config,
  extraction: {
    ...row.config.extraction,
    fields: { ...fields, ...FIXED_FIELDS },
  },
};

if (!APPLY) {
  console.log('\n(dry run — re-run with --apply to write)');
  await pool.end();
  process.exit(0);
}

await pool.query(`update supplier_scraper set config = $1, updated_at = now() where id = $2`, [
  nextConfig,
  row.id,
]);
console.log('\nwritten.');

// Keep the archive in step. It is what an approved spec is restored FROM, so
// leaving the old copy there would quietly resurrect these bugs the next time
// the supplier is deleted and recreated by a capture.
const archived = await pool.query(
  `update supplier_spec_archive set extraction = $1, archived_at = now()
     where supplier_key = 'tui' returning host_includes`,
  [nextConfig.extraction],
);
if (archived.rowCount) console.log(`archive refreshed for ${archived.rows[0].host_includes}.`);

await pool.end();
