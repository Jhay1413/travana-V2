import { db } from "../../config/database";
import {
  clientTable,
  clientMergeLog,
  transaction,
  notes,
  task,
  tickets,
  clientFiles,
  smsMessagesTable,
  portalMessages,
  wallet_transaction,
  referral,
  referral_payout,
  referral_withdrawal,
  pushSubscriptions,
  webauthnCredentials,
  clientTags,
  portalLoginTokens,
  type NeonClient as Client,
  type InsertClientTable as InsertClient,
} from "@shared/schema";
import { eq, desc, and, inArray, sql, type SQL } from "drizzle-orm";
import type { Scope } from "../../utils/scope";

type Tx = Parameters<Parameters<typeof db.transaction>[0]>[0];

function buildScopeWhere(scope: Scope): SQL | undefined {
  if (scope.orgRole === "platform_admin") return undefined;

  const conds: SQL[] = [eq(clientTable.orgId, scope.orgId)];
  if (scope.orgRole === "branch_manager" && scope.branchId) {
    conds.push(eq(clientTable.branchId, scope.branchId));
  }
  if ((scope.orgRole === "agent" || scope.orgRole === "homeworker") && scope.userId) {
    conds.push(eq(clientTable.createdBy, scope.userId));
  }
  return and(...conds);
}

export const clientRepository = {
  async findById(id: string, scope: Scope): Promise<Client | undefined> {
    const scopeWhere = buildScopeWhere(scope);
    const where = scopeWhere ? and(eq(clientTable.id, id), scopeWhere) : eq(clientTable.id, id);
    const [result] = await db.select().from(clientTable).where(where).limit(1);
    return result;
  },

  async findAll(scope: Scope, opts?: { includeMerged?: boolean }): Promise<Client[]> {
    const scopeWhere = buildScopeWhere(scope);
    const conds: SQL[] = [];
    if (scopeWhere) conds.push(scopeWhere);
    if (!opts?.includeMerged) conds.push(eq(clientTable.status, "active"));
    const where = conds.length ? and(...conds) : undefined;
    const query = db.select().from(clientTable);
    const rows = where
      ? await query.where(where).orderBy(desc(clientTable.createdAt))
      : await query.orderBy(desc(clientTable.createdAt));
    return rows;
  },

  async create(client: InsertClient, scope: Scope): Promise<Client> {
    const values: InsertClient = {
      ...client,
      orgId: scope.orgId || (client as any).orgId || null,
      branchId: scope.branchId ?? (client as any).branchId ?? null,
      createdBy: scope.userId ?? (client as any).createdBy ?? null,
    } as InsertClient;
    const [result] = await db.insert(clientTable).values(values).returning();
    return result;
  },

  async update(id: string, client: Partial<InsertClient>, scope: Scope): Promise<Client | undefined> {
    const scopeWhere = buildScopeWhere(scope);
    const where = scopeWhere ? and(eq(clientTable.id, id), scopeWhere) : eq(clientTable.id, id);
    const [result] = await db.update(clientTable).set(client).where(where).returning();
    return result;
  },

  async remove(id: string, scope: Scope): Promise<boolean> {
    const scopeWhere = buildScopeWhere(scope);
    const where = scopeWhere ? and(eq(clientTable.id, id), scopeWhere) : eq(clientTable.id, id);
    const result = await db.delete(clientTable).where(where).returning({ id: clientTable.id });
    return result.length > 0;
  },

  /**
   * Atomically reassign every record owned by `source` to `target`, back-fill the
   * target's blank profile fields from the source, then soft-archive the source
   * (status='merged', mergedIntoId=target) and write an audit-log row.
   *
   * All "deals" (enquiries/quotes/bookings) and their children move via the single
   * transaction.client_id reassignment. Returns the updated target client.
   */
  async mergeAtomic(source: Client, target: Client, actorId: string | null): Promise<Client> {
    const sourceId = source.id;
    const targetId = target.id;

    return db.transaction(async (tx) => {
      const counts: Record<string, number> = {};
      const moveCount = (rows: { id: unknown }[]) => rows.length;

      // --- Deals + direct activity/comms (deals cascade via transaction.client_id) ---
      counts.transactions = moveCount(
        await tx.update(transaction).set({ client_id: targetId })
          .where(eq(transaction.client_id, sourceId)).returning({ id: transaction.id }),
      );
      counts.notes = moveCount(
        await tx.update(notes).set({ client_id: targetId })
          .where(eq(notes.client_id, sourceId)).returning({ id: notes.id }),
      );
      counts.tasks = moveCount(
        await tx.update(task).set({ client_id: targetId })
          .where(eq(task.client_id, sourceId)).returning({ id: task.id }),
      );
      counts.tickets = moveCount(
        await tx.update(tickets).set({ clientId: targetId })
          .where(eq(tickets.clientId, sourceId)).returning({ id: tickets.id }),
      );
      counts.files = moveCount(
        await tx.update(clientFiles).set({ clientId: targetId })
          .where(eq(clientFiles.clientId, sourceId)).returning({ id: clientFiles.id }),
      );
      counts.sms = moveCount(
        await tx.update(smsMessagesTable).set({ clientId: targetId })
          .where(eq(smsMessagesTable.clientId, sourceId)).returning({ id: smsMessagesTable.id }),
      );
      counts.portalMessages = moveCount(
        await tx.update(portalMessages).set({ clientId: targetId })
          .where(eq(portalMessages.clientId, sourceId)).returning({ id: portalMessages.id }),
      );

      // --- Wallet (balance is ledger-derived, so reassigning entries merges balances) ---
      counts.walletTransactions = moveCount(
        await tx.update(wallet_transaction).set({ client_id: targetId })
          .where(eq(wallet_transaction.client_id, sourceId)).returning({ id: wallet_transaction.id }),
      );
      counts.referralPayouts = moveCount(
        await tx.update(referral_payout).set({ client_id: targetId })
          .where(eq(referral_payout.client_id, sourceId)).returning({ id: referral_payout.id }),
      );
      counts.referralWithdrawals = moveCount(
        await tx.update(referral_withdrawal).set({ client_id: targetId })
          .where(eq(referral_withdrawal.client_id, sourceId)).returning({ id: referral_withdrawal.id }),
      );

      // --- Referrals: both directions, then drop any self-referral the merge created ---
      counts.referralsAsReferrer = moveCount(
        await tx.update(referral).set({ referrerClientId: targetId })
          .where(eq(referral.referrerClientId, sourceId)).returning({ id: referral.id }),
      );
      counts.referralsAsReferred = moveCount(
        await tx.update(referral).set({ referredClientId: targetId })
          .where(eq(referral.referredClientId, sourceId)).returning({ id: referral.id }),
      );
      await tx.delete(referral)
        .where(and(eq(referral.referrerClientId, targetId), eq(referral.referredClientId, targetId)));

      // Other clients who were referred BY the source now point at the target.
      counts.referredByPointers = moveCount(
        await tx.update(clientTable).set({ referredByClientId: targetId })
          .where(eq(clientTable.referredByClientId, sourceId)).returning({ id: clientTable.id }),
      );

      // --- Portal credentials / devices ---
      counts.pushSubscriptions = moveCount(
        await tx.update(pushSubscriptions).set({ clientId: targetId })
          .where(eq(pushSubscriptions.clientId, sourceId)).returning({ id: pushSubscriptions.id }),
      );
      counts.webauthnCredentials = moveCount(
        await tx.update(webauthnCredentials).set({ clientId: targetId })
          .where(eq(webauthnCredentials.clientId, sourceId)).returning({ id: webauthnCredentials.id }),
      );
      // Ephemeral single-use SMS login codes — discard the source's rather than move.
      counts.portalLoginTokensDeleted = moveCount(
        await tx.delete(portalLoginTokens)
          .where(eq(portalLoginTokens.clientId, sourceId)).returning({ id: portalLoginTokens.id }),
      );

      // --- Tags: dedup against the target first (unique(clientId, tagId)) ---
      const targetTagRows = await tx.select({ tagId: clientTags.tagId })
        .from(clientTags).where(eq(clientTags.clientId, targetId));
      const targetTagIds = targetTagRows.map((r) => r.tagId);
      if (targetTagIds.length) {
        counts.duplicateTagsDropped = moveCount(
          await tx.delete(clientTags)
            .where(and(eq(clientTags.clientId, sourceId), inArray(clientTags.tagId, targetTagIds)))
            .returning({ id: clientTags.id }),
        );
      }
      counts.tags = moveCount(
        await tx.update(clientTags).set({ clientId: targetId })
          .where(eq(clientTags.clientId, sourceId)).returning({ id: clientTags.id }),
      );

      // --- Back-fill blank target profile fields from the source (target wins) ---
      const backfill: Partial<InsertClient> = {};
      const pick = <K extends keyof Client>(key: K) => {
        const t = target[key];
        const s = source[key];
        if ((t === null || t === undefined || t === "") && s !== null && s !== undefined && s !== "") {
          (backfill as Record<string, unknown>)[key as string] = s;
        }
      };
      (
        [
          "title", "DOB", "email", "emailIsAllowed", "VMB", "VMBfirstAccess",
          "mailAllowed", "houseNumber", "city", "street", "country", "post_code",
          "avatarUrl", "badge", "vipTier", "vipEnrolledAt", "portalPin",
        ] as (keyof Client)[]
      ).forEach(pick);

      // Recompute the target's referral count from the (now-merged) referral rows.
      const [{ cnt }] = await tx.select({ cnt: sql<number>`cast(count(*) as int)` })
        .from(referral).where(eq(referral.referrerClientId, targetId));
      (backfill as Record<string, unknown>).totalReferrals = cnt;

      const [updatedTarget] = await tx.update(clientTable)
        .set(backfill).where(eq(clientTable.id, targetId)).returning();

      // --- Soft-archive the source ---
      await tx.update(clientTable).set({
        status: "merged",
        mergedIntoId: targetId,
        mergedAt: new Date(),
        mergedBy: actorId,
      }).where(eq(clientTable.id, sourceId));

      // --- Audit ---
      await tx.insert(clientMergeLog).values({
        sourceClientId: sourceId,
        targetClientId: targetId,
        mergedBy: actorId,
        orgId: target.orgId ?? null,
        branchId: target.branchId ?? null,
        counts,
      });

      return updatedTarget;
    });
  },
};
