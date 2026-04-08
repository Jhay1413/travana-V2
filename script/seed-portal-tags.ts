import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { tags } from "../shared/schema.js";
import { ilike, sql } from "drizzle-orm";

const pool = new Pool({
  connectionString: process.env.NEON_DATABASE_URL || process.env.DATABASE_URL,
});

const db = drizzle(pool);

const PORTAL_TAGS = [
  "UK Break",
  "Hot Tub Break",
  "City Breaks",
  "Family",
  "Couples",
  "All Inclusive",
  "Long Haul",
  "Cruise",
  "18-30",
  "Luxury Holidays",
  "Honeymoons",
];

async function seedPortalTags() {
  console.log("🌱 Seeding portal tags...");

  for (const name of PORTAL_TAGS) {
    const [existing] = await db
      .select({ id: tags.id, name: tags.name })
      .from(tags)
      .where(ilike(tags.name, name))
      .limit(1);

    if (existing) {
      console.log(`  ⏭  Already exists: "${existing.name}"`);
    } else {
      const [inserted] = await db
        .insert(tags)
        .values({ name, usageCount: 0 })
        .returning({ id: tags.id, name: tags.name });
      console.log(`  ✅ Created: "${inserted.name}"`);
    }
  }

  console.log("✨ Portal tags seeded successfully!");
  await pool.end();
  process.exit(0);
}

seedPortalTags().catch((err) => {
  console.error("❌ Failed to seed portal tags:", err);
  process.exit(1);
});
