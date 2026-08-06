// Repoints room_type at a STRUCTURAL anchor for each supplier.
//
//   npx tsx --env-file-if-exists=.env scripts/fix-room-type-specs.ts          # dry run
//   npx tsx --env-file-if-exists=.env scripts/fix-room-type-specs.ts --apply
//
// Spec rules run case-insensitively, so a rule that keys on the vocabulary
// word "room" also matches it inside ordinary prose. easyJet's generated rule
//     YOUR ROOM[\s\S]{0,100}?\n([A-Z][\w \-]+(room|suite|...)[\w \-]*)
// captured "Best room choice according to your selected duration and dates" —
// the caption above the room list — because that sentence contains "room".
//
// The room NAME always sits on its own line beside a structural marker, so
// anchor there instead:
//   easyJet  ROOM 1 ⏎ <name>            (with an optional "Hurry, only N left!")
//   TUI      <name> ⏎ Sleeps: …
import { Pool } from 'pg';

const APPLY = process.argv.includes('--apply');

// Keyed by supplier_key; suppliers absent here are left alone.
const RULES: Record<string, string> = {
  easyjet: 'ROOM\\s*\\d+\\s*\\n+\\s*(?:Hurry[^\\n]*\\n+\\s*)?([^\\n]+)',
  tui: '\\n([^\\n]+)\\n+\\s*Sleeps:',
};

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const { rows } = await pool.query(
  `select id, supplier_key, config from supplier_scraper where supplier_key = any($1)`,
  [Object.keys(RULES)],
);

if (rows.length === 0) console.log('No matching supplier rows found.');

for (const row of rows) {
  const config = row.config ?? {};
  const spec = config.extraction;
  if (!spec?.fields) {
    console.log(`${row.supplier_key}: no extraction spec yet — skipped.`);
    continue;
  }
  const next = RULES[row.supplier_key];
  console.log(`\n${row.supplier_key}`);
  console.log('  before :', JSON.stringify(spec.fields.room_type?.regex));
  console.log('  after  :', JSON.stringify(next));

  if (!APPLY) continue;

  const nextConfig = {
    ...config,
    extraction: {
      ...spec,
      fields: { ...spec.fields, room_type: { from: 'text', group: 1, regex: next } },
    },
  };
  await pool.query(`update supplier_scraper set config = $1, updated_at = now() where id = $2`, [nextConfig, row.id]);
  console.log('  written.');
}

if (!APPLY) console.log('\n(dry run — re-run with --apply to write)');
await pool.end();
