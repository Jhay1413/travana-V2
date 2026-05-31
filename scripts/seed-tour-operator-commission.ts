/**
 * Backfill tour_operator.commission_percentage from the retired
 * tour_package_commission_table (MAX commission per operator).
 *
 * Data snapshot: scripts/seed-data/tour-operator-commission.ts (150 operators).
 *
 * Sets each operator's commission by id, ONLY where it is currently NULL, so
 * any value already edited in the app is preserved. Idempotent — safe to re-run.
 *
 * Run AFTER `db push` (or the migration) has added the commission_percentage
 * column to tour_operator_table:
 *
 *   npm run db:seed-commission
 */
import { db } from "../server/config/database";
import { tour_operator } from "../shared/schema";
import { and, eq, isNull } from "drizzle-orm";
import { tourOperatorCommissionSeed } from "./seed-data/tour-operator-commission";

async function main() {
  console.log(`Backfilling commission for ${tourOperatorCommissionSeed.length} tour operators...`);

  let updated = 0;
  let skipped = 0;
  let missing = 0;

  for (const op of tourOperatorCommissionSeed) {
    // Only fill where it's still NULL — never overwrite an edited value.
    const res = await db
      .update(tour_operator)
      .set({ commission_percentage: op.commission_percentage })
      .where(and(eq(tour_operator.id, op.id), isNull(tour_operator.commission_percentage)))
      .returning({ id: tour_operator.id });

    if (res.length > 0) {
      updated += res.length;
    } else {
      const [exists] = await db
        .select({ id: tour_operator.id })
        .from(tour_operator)
        .where(eq(tour_operator.id, op.id))
        .limit(1);
      if (exists) skipped++;
      else missing++;
    }
  }

  console.log("\nDone.");
  console.log(`  updated:                       ${updated}`);
  console.log(`  already set (left untouched):  ${skipped}`);
  console.log(`  operator id no longer present: ${missing}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
