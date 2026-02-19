/**
 * This script:
 * 1. Creates accommodation_images and lodge_images tables (the only new tables not yet in DB)
 * 2. Reads the generated drizzle migration file and computes its SHA256 hash
 * 3. Inserts the hash into __drizzle_migrations so drizzle-kit migrate tracks it as applied
 */
import pg from 'pg';
import fs from 'fs';
import crypto from 'crypto';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const dbUrl = process.env.DATABASE_URL || '';
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: dbUrl,
  ssl: { rejectUnauthorized: false },
});

async function run() {
  const client = await pool.connect();
  try {
    // Step 1: Create the two new tables that don't exist yet
    console.log('Creating new tables...');

    await client.query(`
      CREATE TABLE IF NOT EXISTS accommodation_images (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        accommodation_id uuid NOT NULL,
        image_url varchar NOT NULL,
        "isPrimary" boolean DEFAULT false,
        CONSTRAINT accommodation_images_accommodation_id_image_url_unique UNIQUE(accommodation_id, image_url),
        CONSTRAINT accommodation_images_accommodation_id_fk
          FOREIGN KEY (accommodation_id) REFERENCES accomodation_list_table(id) ON DELETE CASCADE
      )
    `);
    console.log('  ✓ accommodation_images table ready');

    await client.query(`
      CREATE TABLE IF NOT EXISTS lodge_images (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
        lodge_id uuid NOT NULL,
        image_url varchar NOT NULL,
        "isPrimary" boolean DEFAULT false,
        CONSTRAINT lodge_images_lodge_id_image_url_unique UNIQUE(lodge_id, image_url),
        CONSTRAINT lodge_images_lodge_id_fk
          FOREIGN KEY (lodge_id) REFERENCES lodges_table(id) ON DELETE CASCADE
      )
    `);
    console.log('  ✓ lodge_images table ready');

    // Step 2: Set up drizzle schema and __drizzle_migrations table
    // Drizzle stores migrations in the "drizzle" schema, not public
    // Clean up incorrect public.__drizzle_migrations if it exists
    await client.query(`DROP TABLE IF EXISTS public."__drizzle_migrations"`);
    await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    // Step 3: Compute SHA256 hash of the migration file (same as drizzle-orm does)
    const migrationFile = path.resolve(__dirname, '../migrations/0000_organic_gargoyle.sql');
    const content = fs.readFileSync(migrationFile, 'utf-8');
    const hash = crypto.createHash('sha256').update(content).digest('hex');
    console.log(`\nMigration hash: ${hash}`);

    // folderMillis comes from the journal's "when" field - drizzle skips migration
    // if lastDbMigration.created_at >= migration.folderMillis
    const folderMillis = 1771504056558;

    // Step 4: Insert only if not already tracked
    const { rows } = await client.query(
      `SELECT id FROM drizzle."__drizzle_migrations" WHERE hash = $1`,
      [hash]
    );

    if (rows.length === 0) {
      await client.query(
        `INSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
        [hash, folderMillis]
      );
      console.log('  ✓ Migration recorded in drizzle.__drizzle_migrations');
    } else {
      console.log('  ℹ Migration already tracked, skipping');
    }

    console.log('\n✅ Done! All migrations are now tracked. Run drizzle-kit migrate for future changes.');
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error('Error:', e.message);
  process.exit(1);
});
