/**
 * Seed `model_pricing` with current per-model rates.
 *
 * Prices are USD MICROS per 1,000,000 tokens (1 micro = $0.000001), so they
 * can be stored/summed as exact integers (never floats). Must be kept
 * current by super-admin/ops as OpenAI pricing changes — re-run this script
 * (or add a new row with a later `effective_from`) when prices drift.
 *
 * Idempotent: skips any model that already has a pricing row.
 *
 *   npm run db:seed-model-pricing
 */
import { db } from "../server/v2/config/database";
import { modelPricing, type InsertModelPricing } from "../shared/schema";
import { eq } from "drizzle-orm";

const SEED_PRICING: InsertModelPricing[] = [
  {
    model: "gpt-4.1",
    inputMicrosPerMtok: 2_000_000,
    cachedInputMicrosPerMtok: 500_000,
    outputMicrosPerMtok: 8_000_000,
  },
  {
    model: "gpt-4.1-mini",
    inputMicrosPerMtok: 400_000,
    cachedInputMicrosPerMtok: 100_000,
    outputMicrosPerMtok: 1_600_000,
  },
  {
    model: "gpt-4o",
    inputMicrosPerMtok: 2_500_000,
    cachedInputMicrosPerMtok: 1_250_000,
    outputMicrosPerMtok: 10_000_000,
  },
  {
    model: "text-embedding-3-small",
    inputMicrosPerMtok: 20_000,
    cachedInputMicrosPerMtok: 0,
    outputMicrosPerMtok: 0,
  },
  {
    model: "gpt-4o-mini",
    inputMicrosPerMtok: 150_000,
    cachedInputMicrosPerMtok: 75_000,
    outputMicrosPerMtok: 600_000,
  },
  {
    model: "gpt-3.5-turbo",
    inputMicrosPerMtok: 500_000,
    cachedInputMicrosPerMtok: 0,
    outputMicrosPerMtok: 1_500_000,
  },
];

async function main() {
  console.log("Seeding model pricing...");

  for (const pricing of SEED_PRICING) {
    const [existing] = await db
      .select({ id: modelPricing.id })
      .from(modelPricing)
      .where(eq(modelPricing.model, pricing.model))
      .limit(1);

    if (existing) {
      console.log(`  skipped "${pricing.model}" (pricing already exists)`);
      continue;
    }

    await db.insert(modelPricing).values(pricing);
    console.log(`  created pricing for "${pricing.model}"`);
  }

  console.log("\nDone.");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
