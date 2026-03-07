/**
 * Mark all existing migration files as applied in the database
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
    console.log('Setting up drizzle migrations table...');
    
    // Create schema and table if needed
    await client.query(`CREATE SCHEMA IF NOT EXISTS drizzle`);
    await client.query(`
      CREATE TABLE IF NOT EXISTS drizzle."__drizzle_migrations" (
        id SERIAL PRIMARY KEY,
        hash text NOT NULL,
        created_at bigint
      )
    `);

    // Read migration journal to get migration info
    const journalPath = path.resolve(__dirname, '../migrations/meta/_journal.json');
    const journal = JSON.parse(fs.readFileSync(journalPath, 'utf-8'));
    
    console.log(`Found ${journal.entries.length} migrations in journal`);
    
    for (const entry of journal.entries) {
      const migrationFile = path.resolve(__dirname, `../migrations/${entry.tag}.sql`);
      
      if (!fs.existsSync(migrationFile)) {
        console.log(`  ⚠ Migration file ${entry.tag}.sql not found, skipping`);
        continue;
      }
      
      const content = fs.readFileSync(migrationFile, 'utf-8');
      const hash = crypto.createHash('sha256').update(content).digest('hex');
      
      // Check if already tracked
      const { rows } = await client.query(
        `SELECT id FROM drizzle."__drizzle_migrations" WHERE hash = $1`,
        [hash]
      );

      if (rows.length === 0) {
        await client.query(
          `INSERT INTO drizzle."__drizzle_migrations" (hash, created_at) VALUES ($1, $2)`,
          [hash, entry.when]
        );
        console.log(`  ✓ Marked ${entry.tag} as applied`);
      } else {
        console.log(`  ℹ ${entry.tag} already tracked`);
      }
    }

    console.log('\n✅ All migrations marked as applied!');
  } catch (error: any) {
    console.error('Error:', error.message);
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((e) => {
  console.error('Failed:', e.message);
  process.exit(1);
});
