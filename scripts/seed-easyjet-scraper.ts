/**
 * Seed an easyJet supplier scraper config for one organization.
 *
 * Reads the trade-portal credentials from the environment
 * (EASYJET_TRADE_USERNAME / EASYJET_TRADE_PASSWORD), encrypts them with the
 * same key the app uses (EMAIL_ENCRYPTION_KEY), and stores them in the
 * supplier_scraper table along with the easyJet reference config.
 *
 * Idempotent: re-running updates the existing row for that org.
 *
 * PREREQUISITE: apply migration 0039_* first (this script does not create the
 * table). Run with the dev server able to reach the database:
 *
 *   npx tsx --env-file-if-exists=.env scripts/seed-easyjet-scraper.ts <org-uuid>
 *
 * The org uuid can also come from SCRAPER_SEED_ORG_ID.
 */
import { and, eq } from "drizzle-orm";
import { db } from "../server/v2/config/database";
import { supplier_scraper, organization } from "../shared/schema";
import { encrypt } from "../server/v2/utils/encryption";
import { EASYJET_DEFAULT_CONFIG } from "../server/v2/modules/scraper/scraper-defaults";

async function main(): Promise<void> {
  const orgId = process.argv[2] || process.env.SCRAPER_SEED_ORG_ID;
  if (!orgId) {
    console.error("Usage: tsx scripts/seed-easyjet-scraper.ts <org-uuid>  (or set SCRAPER_SEED_ORG_ID)");
    process.exit(1);
  }

  const username = process.env.EASYJET_TRADE_USERNAME;
  const password = process.env.EASYJET_TRADE_PASSWORD;
  if (!username || !password) {
    console.error("EASYJET_TRADE_USERNAME / EASYJET_TRADE_PASSWORD must be set in the environment.");
    process.exit(1);
  }

  const [org] = await db.select().from(organization).where(eq(organization.id, orgId));
  if (!org) {
    console.error(`No organization found with id ${orgId}`);
    process.exit(1);
  }

  const encrypted = encrypt(JSON.stringify({ username, password }));

  const [existing] = await db
    .select()
    .from(supplier_scraper)
    .where(and(eq(supplier_scraper.org_id, orgId), eq(supplier_scraper.supplier_key, "easyjet")));

  if (existing) {
    await db
      .update(supplier_scraper)
      .set({ encrypted_credentials: encrypted, config: EASYJET_DEFAULT_CONFIG, is_active: true, updated_at: new Date() })
      .where(eq(supplier_scraper.id, existing.id));
    console.log(`Updated easyJet scraper config for org ${orgId}.`);
  } else {
    await db.insert(supplier_scraper).values({
      org_id: orgId,
      supplier_key: "easyjet",
      supplier_name: "easyJet holidays",
      adapter_type: "easyjet",
      config: EASYJET_DEFAULT_CONFIG,
      encrypted_credentials: encrypted,
      is_active: true,
    });
    console.log(`Created easyJet scraper config for org ${orgId}.`);
  }

  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
