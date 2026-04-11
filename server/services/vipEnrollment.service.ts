import { db } from "../config/database";
import { clientTable, referral } from "@shared/schema";
import { eq, and, sql } from "drizzle-orm";

function computeTier(totalReferrals: number): "standard" | "gold" | "elite" {
  if (totalReferrals >= 5) return "elite";
  if (totalReferrals >= 3) return "gold";
  return "standard";
}

export const vipEnrollmentService = {
  /**
   * Enrolls a client into the VIP club if not already enrolled.
   * Called after a booking is confirmed.
   */
  async enrollClient(clientId: string): Promise<void> {
    const [client] = await db
      .select({ vipEnrolledAt: clientTable.vipEnrolledAt })
      .from(clientTable)
      .where(eq(clientTable.id, clientId))
      .limit(1);

    if (!client || client.vipEnrolledAt) return; // already enrolled

    await db
      .update(clientTable)
      .set({
        vipTier: "standard",
        vipEnrolledAt: new Date(),
        totalReferrals: 0,
      })
      .where(eq(clientTable.id, clientId));
  },

  /**
   * Recalculates and updates a client's VIP tier based on successful referral count.
   * Called after any referral status change.
   */
  async recalculateTier(referrerClientId: string): Promise<void> {
    const successfulReferrals = await db
      .select({ id: referral.id })
      .from(referral)
      .where(
        and(
          eq(referral.referrerClientId, referrerClientId),
          sql`${referral.referralStatus} IN ('IN_WALLET', 'PAID')`
        )
      );

    const count = successfulReferrals.length;
    const newTier = computeTier(count);

    await db
      .update(clientTable)
      .set({ totalReferrals: count, vipTier: newTier })
      .where(eq(clientTable.id, referrerClientId));
  },

  /**
   * When a referred friend books, links them to the pending referral
   * and enrolls them into VIP.
   */
  async handleReferredClientBooked(
    newClientId: string,
    referredByClientId: string
  ): Promise<void> {
    // Enroll the new client into VIP
    await vipEnrollmentService.enrollClient(newClientId);

    // Find the open referral the referrer logged for this person
    const [pendingReferral] = await db
      .select({ id: referral.id })
      .from(referral)
      .where(
        and(
          eq(referral.referrerClientId, referredByClientId),
          eq(referral.referralStatus, "PENDING"),
          sql`${referral.referredClientId} IS NULL`
        )
      )
      .orderBy(referral.createdAt)
      .limit(1);

    if (pendingReferral) {
      await db
        .update(referral)
        .set({ referredClientId: newClientId, updatedAt: new Date() })
        .where(eq(referral.id, pendingReferral.id));
    }
  },
};
