import { Pool } from 'pg';

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
});

async function markMigrationComplete() {
  const client = await pool.connect();
  
  try {
    // Check if the __drizzle_migrations table exists
    const tableExists = await client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = '__drizzle_migrations'
      );
    `);
    
    console.log('Migration table exists:', tableExists.rows[0].exists);

    // If it doesn't exist, create it
    if (!tableExists.rows[0].exists) {
      console.log('Creating __drizzle_migrations table...');
      await client.query(`
        CREATE TABLE IF NOT EXISTS "__drizzle_migrations" (
          id SERIAL PRIMARY KEY,
          hash text NOT NULL,
          created_at bigint
        );
      `);
    }

    // Mark the migration as applied
    const migrationHash = '0000_aberrant_stingray';
    const timestamp = Date.now();
    
    // Check if already marked
    const existing = await client.query(
      'SELECT * FROM "__drizzle_migrations" WHERE hash = $1',
      [migrationHash]
    );
    
    if (existing.rows.length > 0) {
      console.log('Migration already marked as applied');
    } else {
      await client.query(
        'INSERT INTO "__drizzle_migrations" (hash, created_at) VALUES ($1, $2)',
        [migrationHash, timestamp]
      );
      console.log('✅ Migration marked as applied');
    }

    // List all applied migrations
    const allMigrations = await client.query(
      'SELECT * FROM "__drizzle_migrations" ORDER BY created_at'
    );
    console.log('Applied migrations:', allMigrations.rows);
    
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

markMigrationComplete();
