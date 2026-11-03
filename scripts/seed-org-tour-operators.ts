/**
 * Seed the platform tour-operator CATALOGUE, and optionally link it to organizations.
 *
 * Source of truth: scripts/seed-data/tour-operator-commission.ts (150 operators,
 * each with a commission_percentage).
 *
 * Tour operators are now ONE platform-wide catalogue (tour_operator_table:
 * name, code, website, phone, logo). Each organization's own settings
 * (commission, balance weeks, login) live in org_tour_operator.
 *
 *   1. Catalogue (always): inserts every seed operator that is not in the
 *      catalogue yet, matched on lower(trim(name)) with no org. The seed's
 *      canonical ids are NOT reused. Safe to re-run, never duplicates.
 *   2. Links (only with `link`): gives the chosen organization(s) a link to
 *      every seed operator, carrying the seed commission. Existing links are
 *      left exactly as they are (ON CONFLICT DO NOTHING).
 *
 * Usage:
 *   npm run db:seed-org-tour-operators                         # catalogue only
 *   npm run db:seed-org-tour-operators -- link <org-uuid>      # catalogue + links for one org
 *   npm run db:seed-org-tour-operators -- link all             # catalogue + links for every org
 *   npm run db:seed-org-tour-operators -- <org-uuid|all>       # old CLI form, same as `link <org-uuid|all>`
 */
import { db } from "../server/config/database";
import { org_tour_operator, organization, tour_operator } from "../shared/schema";
import { eq } from "drizzle-orm";
import { tourOperatorCommissionSeed } from "./seed-data/tour-operator-commission";

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const norm = (s: string | null | undefined) => (s || "").trim().toLowerCase();

/** Inserts the seed operators missing from the catalogue; returns lower(name) -> catalogue id for ALL seed names. */
async function seedCatalogue(): Promise<Map<string, string>> {
  const existing = await db.select({ id: tour_operator.id, name: tour_operator.name }).from(tour_operator);
  const byName = new Map(existing.map((r) => [norm(r.name), r.id]));

  const toInsert: { name: string }[] = [];
  const queued = new Set<string>();
  for (const op of tourOperatorCommissionSeed) {
    const key = norm(op.name);
    if (!key || byName.has(key) || queued.has(key)) continue; // skip blanks, present, and in-seed dupes
    queued.add(key);
    toInsert.push({ name: op.name!.trim() });
  }

  if (toInsert.length > 0) {
    const inserted = await db
      .insert(tour_operator)
      .values(toInsert)
      .onConflictDoNothing()
      .returning({ id: tour_operator.id, name: tour_operator.name });
    for (const r of inserted) byName.set(norm(r.name), r.id);
  }
  console.log(`Catalogue: inserted ${toInsert.length}, already present ${tourOperatorCommissionSeed.length - toInsert.length}`);
  return byName;
}

async function linkOrg(orgId: string, orgName: string, catalogueIds: Map<string, string>): Promise<number> {
  const values: { org_id: string; tour_operator_id: string; commission_percentage: string }[] = [];
  const queued = new Set<string>();
  for (const op of tourOperatorCommissionSeed) {
    const key = norm(op.name);
    const operatorId = catalogueIds.get(key);
    if (!operatorId || queued.has(operatorId)) continue;
    queued.add(operatorId);
    values.push({ org_id: orgId, tour_operator_id: operatorId, commission_percentage: op.commission_percentage });
  }
  if (values.length === 0) return 0;
  const inserted = await db
    .insert(org_tour_operator)
    .values(values)
    .onConflictDoNothing({ target: [org_tour_operator.org_id, org_tour_operator.tour_operator_id] })
    .returning({ id: org_tour_operator.id });
  console.log(`  ${orgName} (${orgId}): linked ${inserted.length}, already linked ${values.length - inserted.length}`);
  return inserted.length;
}

async function main() {
  const first = process.argv[2]?.trim();
  // The old CLI took a bare <org-uuid|all>; treat that as link mode too.
  const legacyTarget = first === "all" || (first && UUID_RE.test(first)) ? first : undefined;
  const linkMode = first === "link" || legacyTarget !== undefined;
  const catalogueIds = await seedCatalogue();

  if (!linkMode) {
    console.log("\nDone (catalogue only). Pass `link <org-uuid|all>` to also link organizations.");
    process.exit(0);
  }

  const target = legacyTarget ?? process.argv[3]?.trim();
  if (!target) {
    console.error("Usage: -- link <org-uuid|all>");
    process.exit(1);
  }

  const orgs =
    target === "all"
      ? await db.select({ id: organization.id, name: organization.name }).from(organization)
      : await db
          .select({ id: organization.id, name: organization.name })
          .from(organization)
          .where(eq(organization.id, target))
          .limit(1);
  if (orgs.length === 0) {
    console.error(`Organization not found: ${target}`);
    process.exit(1);
  }

  console.log(`Linking ${tourOperatorCommissionSeed.length} tour operators to ${orgs.length} organization(s)...`);
  let total = 0;
  for (const org of orgs) total += await linkOrg(org.id, org.name ?? "(unnamed)", catalogueIds);

  console.log("\nDone.");
  console.log(`  total links created: ${total}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
