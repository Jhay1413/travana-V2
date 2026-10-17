import { and, eq, ne, sql } from "drizzle-orm";
import { db } from "../../config/database";
import { organization, user, userOrgRoles } from "@shared/schema";
import { notSuspendedOrBanned } from "../../utils/user-conditions";

export interface SeatCounts {
  limit:          number | null;
  activeMembers:  number;
  pendingInvites: number;
}

/**
 * True for people whose only role in the org is the referral partner one:
 * they use the referral hub, not a seat.
 */
function referralOnly(orgId: string) {
  return sql`(${user.orgRole} = 'referral_agent' AND NOT EXISTS (
    SELECT 1 FROM ${userOrgRoles}
    WHERE ${userOrgRoles.userId} = ${user.id}
      AND ${userOrgRoles.orgId} = ${orgId}
      AND ${userOrgRoles.role} <> 'referral_agent'
  ))`;
}

export const organizationSeatRepository = {
  /**
   * Seats in use. Active = accepted, not platform staff, not suspended / banned /
   * removed (homeworkers included). Pending = invited and not yet accepted.
   * Referral-only people use neither.
   */
  async countUsage(orgId: string): Promise<SeatCounts> {
    const [counts] = await db
      .select({
        active: sql<number>`(count(*) FILTER (WHERE ${user.inviteToken} IS NULL AND ${notSuspendedOrBanned()}))::int`,
        pending: sql<number>`(count(*) FILTER (WHERE ${user.inviteToken} IS NOT NULL))::int`,
      })
      .from(user)
      .where(and(
        eq(user.orgId, orgId),
        ne(user.role, "platform_admin"),
        sql`NOT ${referralOnly(orgId)}`,
      ));
    const [org] = await db
      .select({ seatLimit: organization.seatLimit })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1);
    return {
      limit: org?.seatLimit ?? null,
      activeMembers: Number(counts?.active ?? 0),
      pendingInvites: Number(counts?.pending ?? 0),
    };
  },
};
