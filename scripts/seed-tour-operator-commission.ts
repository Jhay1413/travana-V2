/**
 * Backfill org_tour_operator.commission_percentage from the seed snapshot
 * (the retired tour_package_commission_table, MAX commission per operator).
 *
 * Data snapshot: scripts/seed-data/tour-operator-commission.ts (150 operators).
 *
 * Commission is now per ORGANIZATION (org_tour_operator), not on the shared
 * catalogue row. Seed operators are matched to the catalogue by lower(trim(name)),
 * and the value is written ONLY where an organization's link has no commission
 * yet, so anything already edited in the app is preserved. Idempotent: safe to re-run.
 *
 * This WRITES to org_tour_operator, so it only runs with an explicit --fill-null flag.
 *
 * Usage:
 *   npm run db:seed-commission -- --fill-null                  # every organization
 *   npm run db:seed-commission -- --fill-null <org-uuid>       # one organization
 *   npm run db:seed-commission                                 # prints what it would do and exits
 */
import { db } from "../server/config/database";
import { org_tour_operator, tour_operator } from "../shared/schema";
import { and, eq, isNull, sql } from "drizzle-orm";
import { tourOperatorCommissionSeed } from "./seed-data/tour-operator-commission";

async function main() {
  const args = process.argv.slice(2).map((a) => a.trim());
  const fillNull = args.includes("--fill-null");
  const orgArg = args.find((a) => !a.startsWith("--"));
  const scope = orgArg && orgArg !== "all" ? `organization ${orgArg}` : "every organization";

  if (!fillNull) {
    console.log(
      `This would set org_tour_operator.commission_percentage from the seed snapshot for ${scope}, ` +
        "ONLY on links where it is currently NULL (existing rates are never overwritten).\n" +
        "Nothing was changed. Re-run with --fill-null to apply it.",
    );
    process.exit(0);
  }
  console.log(`Backfilling commission for ${tourOperatorCommissionSeed.length} tour operators in ${scope}...`);

  let updated = 0;
  let notInCatalogue = 0;

  for (const op of tourOperatorCommissionSeed) {
    const key = (op.name || "").trim().toLowerCase();
    if (!key) continue;

    const [catalogueRow] = await db
      .select({ id: tour_operator.id })
      .from(tour_operator)
      .where(sql`lower(btrim(${tour_operator.name})) = ${key}`)
      .limit(1);
    if (!catalogueRow) {
      notInCatalogue++;
      continue;
    }

    // Only fill where it's still NULL — never overwrite an edited value.
    const conds = [eq(org_tour_operator.tour_operator_id, catalogueRow.id), isNull(org_tour_operator.commission_percentage)];
    if (orgArg && orgArg !== "all") conds.push(eq(org_tour_operator.org_id, orgArg));
    const res = await db
      .update(org_tour_operator)
      .set({ commission_percentage: op.commission_percentage, updated_at: new Date() })
      .where(and(...conds))
      .returning({ id: org_tour_operator.id });
    updated += res.length;
  }

  console.log("\nDone.");
  console.log(`  links updated:                  ${updated}`);
  console.log(`  seed operators not in catalogue: ${notInCatalogue} (run db:seed-org-tour-operators first)`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
