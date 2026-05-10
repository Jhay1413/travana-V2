import { db } from "../server/config/database";
import {
  organization,
  branches,
  branchMembers,
  user,
  transaction,
  task,
  tasks,
  tickets,
  forwardsReport,
  tour_operator,
  tourOperators,
  clientTable,
} from "../shared/schema";
import { eq, isNull } from "drizzle-orm";

const ORG_NAME    = "Tinas Travel Deals";
const ORG_SLUG    = "tinas-travel-deals";
const BRANCH_NAME = "Tinas Travel Deals";

async function main() {
  console.log("Seeding organization, branch, and user memberships...");

  // ── 1. Upsert organization ────────────────────────────────────────────────
  const existing = await db
    .select({ id: organization.id })
    .from(organization)
    .where(eq(organization.slug, ORG_SLUG))
    .limit(1);

  let orgId: string;
  if (existing.length > 0) {
    orgId = existing[0].id;
    console.log(`  organization already exists: "${ORG_NAME}" (${orgId})`);
  } else {
    const [newOrg] = await db
      .insert(organization)
      .values({ name: ORG_NAME, slug: ORG_SLUG, plan: "enterprise", isActive: true, seatLimit: 100 })
      .returning({ id: organization.id });
    orgId = newOrg.id;
    console.log(`  organization created: "${ORG_NAME}" (${orgId})`);
  }

  // ── 2. Upsert default branch ──────────────────────────────────────────────
  const existingBranch = await db
    .select({ id: branches.id })
    .from(branches)
    .where(eq(branches.organizationId, orgId))
    .limit(1);

  let branchId: string;
  if (existingBranch.length > 0) {
    branchId = existingBranch[0].id;
    console.log(`  branch already exists: "${BRANCH_NAME}" (${branchId})`);
  } else {
    const [newBranch] = await db
      .insert(branches)
      .values({ organizationId: orgId, name: BRANCH_NAME, code: "TTD", isDefault: true, isActive: true })
      .returning({ id: branches.id });
    branchId = newBranch.id;
    console.log(`  branch created: "${BRANCH_NAME}" (${branchId})`);
  }

  // ── 3. Backfill users: org_id + org_role + branch_members ─────────────────
  const allUsers = await db.select({ id: user.id, role: user.role }).from(user);
  console.log(`  backfilling ${allUsers.length} user(s)...`);

  for (const u of allUsers) {
    const orgRole = mapOrgRole(u.role);

    await db.update(user).set({ orgId, orgRole }).where(eq(user.id, u.id));

    if (orgRole !== "org_admin") {
      // onConflictDoNothing uses the UNIQUE (branch_id, user_id) constraint
      await db
        .insert(branchMembers)
        .values({ orgId, branchId, userId: u.id, orgRole, isActive: true })
        .onConflictDoNothing();
    }
  }

  const enrolled = allUsers.filter(u => mapOrgRole(u.role) !== "org_admin").length;
  console.log(`  enrolled ${enrolled} user(s) into branch "${BRANCH_NAME}"`);

  // ── 4. Backfill transaction ───────────────────────────────────────────────
  const txResult = await db
    .update(transaction)
    .set({ org_id: orgId, branch_id: branchId })
    .where(isNull(transaction.org_id));
  console.log(`  transaction: backfilled`);

  // ── 5. Backfill task ──────────────────────────────────────────────────────
  await db
    .update(task)
    .set({ org_id: orgId, branch_id: branchId })
    .where(isNull(task.org_id));
  console.log(`  task: backfilled`);

  // ── 6. Backfill tasks ─────────────────────────────────────────────────────
  await db
    .update(tasks)
    .set({ orgId, branchId })
    .where(isNull(tasks.orgId));
  console.log(`  tasks: backfilled`);

  // ── 7. Backfill tickets ───────────────────────────────────────────────────
  await db
    .update(tickets)
    .set({ orgId, branchId })
    .where(isNull(tickets.orgId));
  console.log(`  tickets: backfilled`);

  // ── 7a. Backfill clientTable ──────────────────────────────────────────────
  await db
    .update(clientTable)
    .set({ orgId, branchId })
    .where(isNull(clientTable.orgId));
  console.log(`  clientTable: backfilled`);

  // ── 8. Backfill forwardsReport ────────────────────────────────────────────
  await db
    .update(forwardsReport)
    .set({ org_id: orgId, branch_id: branchId })
    .where(isNull(forwardsReport.org_id));
  console.log(`  forwardsReport: backfilled`);

  // ── 9. Backfill tour_operator (org-scoped, no branch) ─────────────────────
  await db
    .update(tour_operator)
    .set({ org_id: orgId })
    .where(isNull(tour_operator.org_id));
  console.log(`  tour_operator: backfilled`);

  // ── 10. Backfill tourOperators (org-scoped, no branch) ────────────────────
  await db
    .update(tourOperators)
    .set({ orgId })
    .where(isNull(tourOperators.orgId));
  console.log(`  tourOperators: backfilled`);

  console.log("\nDone.");
  process.exit(0);
}

function mapOrgRole(role: string | null): string {
  switch (role) {
    case "admin":      return "org_admin";
    case "Manager":    return "branch_manager";
    case "Homeworker": return "homeworker";
    case "Referer":    return "referral_agent";
    default:           return "agent";
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
