import { and, eq, exists, notExists, or, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import { user, branchMembers } from "@shared/schema";
import { db } from "../config/database";

// Aliased once at module level so the correlated subqueries never collide with a
// `branch_members` join in the outer query.
const anyMembership = alias(branchMembers, "bm_any");
const activeMembership = alias(branchMembers, "bm_active");

/**
 * Condition that hides people who should no longer be pickable anywhere in the
 * app: someone suspended from their org, or banned by a platform admin.
 *
 * Suspending a member deactivates every one of their `branch_members` rows (see
 * `orgMemberService.setSuspended`), so "suspended" means: has membership rows,
 * and none of them are active. Someone with no membership rows at all is NOT
 * suspended — they're merely unassigned to a branch — so they stay visible.
 * Excluding them would silently hide legitimate users whose membership backfill
 * never ran, which is the worse failure of the two.
 *
 * Apply this to any roster that feeds a picker, filter, assignee list or
 * mention fan-out. Do NOT apply it to rosters whose whole purpose is managing
 * suspended people — the agency team page (`branchMemberRepository`) and the
 * platform-admin user lists must keep showing them.
 *
 * The query must select from the `user` table for the correlation to resolve.
 */
export function notSuspendedOrBanned() {
  return and(
    sql`${user.banned} IS NOT TRUE`,
    or(
      notExists(
        db.select({ one: sql`1` }).from(anyMembership).where(eq(anyMembership.userId, user.id)),
      ),
      exists(
        db
          .select({ one: sql`1` })
          .from(activeMembership)
          .where(and(eq(activeMembership.userId, user.id), eq(activeMembership.isActive, true))),
      ),
    ),
  );
}
