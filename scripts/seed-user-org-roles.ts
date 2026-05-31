/**
 * Seed user_org_roles (multi-role) from each user's primary org role.
 *
 * The app supports several org-level roles per user; user.orgRole stays as the
 * derived "primary" while user_org_roles is the source of truth. This seeds the
 * initial row for every user from their existing (org_id, org_role).
 *
 * DEPENDS ON seed-org having run first — that is what sets user.orgId and
 * user.orgRole. Users with no org (platform admins / unattached) are skipped.
 *
 * Idempotent — re-running inserts nothing new (ON CONFLICT DO NOTHING on the
 * (user_id, org_id, role) unique key).
 *
 *   npm run db:seed-roles
 */
import { db } from "../server/config/database";
import { user, userOrgRoles } from "../shared/schema";
import { and, isNotNull } from "drizzle-orm";

async function main() {
  console.log("Seeding user_org_roles from user.orgRole...");

  const rows = await db
    .select({ id: user.id, orgId: user.orgId, orgRole: user.orgRole, createdAt: user.createdAt })
    .from(user)
    .where(and(isNotNull(user.orgId), isNotNull(user.orgRole)));

  console.log(`  ${rows.length} user(s) with an org role to seed`);

  let inserted = 0;
  for (const u of rows) {
    const res = await db
      .insert(userOrgRoles)
      .values({
        userId: u.id,
        orgId: u.orgId!,
        role: u.orgRole!,
        grantedAt: u.createdAt ?? undefined,
        grantedBy: null,
      })
      .onConflictDoNothing({
        target: [userOrgRoles.userId, userOrgRoles.orgId, userOrgRoles.role],
      })
      .returning({ id: userOrgRoles.id });
    if (res.length > 0) inserted += 1;
  }

  console.log("\nDone.");
  console.log(`  inserted:               ${inserted}`);
  console.log(`  already present / skipped: ${rows.length - inserted}`);
  process.exit(0);
}

main().catch((err) => {
  console.error("Seed failed:", err);
  process.exit(1);
});
