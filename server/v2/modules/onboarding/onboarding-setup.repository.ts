import { and, asc, eq, gt, isNotNull, isNull, ne, or, sql } from "drizzle-orm";
import { db } from "../../config/database";
import { agentTargetTable, branches, orgTargetTable, organization, shopTargetTable, transaction, user } from "@shared/schema";
import type { InsertBranch, User } from "@shared/schema";
import { notSuspendedOrBanned } from "../../utils/user-conditions";
import { organizationRepository } from "../organization/organization.repository";
import { branchRepository, type Tx } from "../branch/branch.repository";

export type OrgTx = Tx;

export interface SaveBusinessInput {
  orgId: string;
  name: string;
  profile: Record<string, unknown>;
  businessType: string;
  /** The signup placeholder to mirror the business details onto (single-shop only). */
  branchCopy?: { id: string; fields: Partial<InsertBranch> };
}

export const onboardingSetupRepository = {
  /**
   * Runs `fn` in a transaction holding a per-org advisory lock, so concurrent
   * wizard shop submissions are serialised (branch-limit count + insert and the
   * placeholder claim cannot race).
   */
  async withOrgLock<T>(orgId: string, fn: (tx: OrgTx) => Promise<T>): Promise<T> {
    return db.transaction(async (tx) => {
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`onboarding-shops:${orgId}`}))`);
      return fn(tx);
    });
  },

  /** Raw settings.onboarding object (null when absent). */
  async readOnboarding(orgId: string, tx?: OrgTx): Promise<unknown> {
    const [row] = await (tx ?? db)
      .select({ onboarding: sql<unknown>`${organization.settings} -> 'onboarding'` })
      .from(organization)
      .where(eq(organization.id, orgId))
      .limit(1);
    return row?.onboarding ?? null;
  },

  /**
   * Marks the placeholder branch claimed. Conditional on it being THE placeholder
   * and not yet claimed; returns whether this call won the claim.
   */
  async claimPlaceholder(orgId: string, branchId: string, tx?: OrgTx): Promise<boolean> {
    const rows = await (tx ?? db)
      .update(organization)
      .set({
        settings: sql`coalesce(${organization.settings}, '{}'::jsonb) || jsonb_build_object('onboarding', (${organization.settings} -> 'onboarding') || '{"defaultBranchClaimed": true}'::jsonb)`,
      })
      .where(
        and(
          eq(organization.id, orgId),
          sql`${organization.settings} -> 'onboarding' ->> 'placeholderBranchId' = ${branchId}`,
          sql`coalesce(${organization.settings} -> 'onboarding' ->> 'defaultBranchClaimed', 'false') <> 'true'`,
        ),
      )
      .returning({ id: organization.id });
    return rows.length > 0;
  },

  /** Business step in one transaction: name, profile merge, business type, optional placeholder copy. */
  async saveBusiness(input: SaveBusinessInput): Promise<void> {
    await db.transaction(async (tx) => {
      await tx.update(organization).set({ name: input.name }).where(eq(organization.id, input.orgId));
      await organizationRepository.mergeSettingsSection(input.orgId, "profile", input.profile, tx);
      await organizationRepository.mergeSettingsSection(input.orgId, "onboarding", { businessType: input.businessType }, tx);
      if (input.branchCopy) {
        await branchRepository.update(input.branchCopy.id, input.branchCopy.fields, input.orgId, tx);
      }
    });
  },

  /** The org's owner: its earliest org_admin (not the possibly-impersonating requester). */
  async findOwner(orgId: string): Promise<User | null> {
    const [row] = await db
      .select()
      .from(user)
      .where(and(eq(user.orgId, orgId), eq(user.orgRole, "org_admin")))
      .orderBy(asc(user.createdAt))
      .limit(1);
    return row ?? null;
  },

  /**
   * Active members plus pending invites other than the owner. Excludes platform staff,
   * deactivated / banned / removed people and referral partners (who use no seat).
   */
  async countOtherUsers(orgId: string, ownerId: string): Promise<number> {
    const [row] = await db
      .select({ n: sql<number>`count(*)::int` })
      .from(user)
      .where(
        and(
          eq(user.orgId, orgId),
          ne(user.id, ownerId),
          ne(user.role, "platform_admin"),
          or(isNull(user.orgRole), ne(user.orgRole, "referral_agent")),
          or(isNotNull(user.inviteToken), notSuspendedOrBanned()),
        ),
      );
    return Number(row?.n ?? 0);
  },

  /** True when a business, shop or agent target exists for the org in the month. */
  async hasTargetForMonth(orgId: string, year: number, month: number): Promise<boolean> {
    const shop = await db
      .select({ id: shopTargetTable.id })
      .from(shopTargetTable)
      .innerJoin(branches, eq(branches.id, shopTargetTable.branchId))
      .where(and(eq(branches.organizationId, orgId), eq(shopTargetTable.year, year), eq(shopTargetTable.month, month)))
      .limit(1);
    if (shop.length > 0) return true;
    const agent = await db
      .select({ id: agentTargetTable.id })
      .from(agentTargetTable)
      .innerJoin(branches, eq(branches.id, agentTargetTable.branchId))
      .where(and(eq(branches.organizationId, orgId), eq(agentTargetTable.year, year), eq(agentTargetTable.month, month)))
      .limit(1);
    if (agent.length > 0) return true;
    const business = await db
      .select({ id: orgTargetTable.id })
      .from(orgTargetTable)
      .where(and(eq(orgTargetTable.organizationId, orgId), eq(orgTargetTable.year, year), eq(orgTargetTable.month, month), gt(orgTargetTable.targetAmount, "0")))
      .limit(1);
    return business.length > 0;
  },

  async hasTransaction(orgId: string): Promise<boolean> {
    const rows = await db.select({ id: transaction.id }).from(transaction).where(eq(transaction.org_id, orgId)).limit(1);
    return rows.length > 0;
  },
};
