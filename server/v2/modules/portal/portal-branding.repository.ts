import { and, desc, eq, isNull, or } from 'drizzle-orm';
import { db } from '../../config/database';
import { clientTable, organization, transaction, user } from '@shared/schema';
import type { PortalActiveAgentRow, PortalBrandingOrgRow } from './portal-branding.types';

const orgColumns = {
  name: organization.name,
  logoUrl: organization.logoUrl,
  brandColor: organization.brandColor,
  settings: organization.settings,
};

export const portalBrandingRepository = {
  /** The agency for a portal slug, only while it is active; undefined otherwise. */
  async findActiveBySlug(slug: string): Promise<PortalBrandingOrgRow | undefined> {
    const [row] = await db
      .select(orgColumns)
      .from(organization)
      .where(and(eq(organization.slug, slug), eq(organization.isActive, true)))
      .limit(1);
    return row;
  },

  /** The agency of a live (non-deleted) customer. */
  async findForClient(clientId: string): Promise<{ orgId: string; slug: string; org: PortalBrandingOrgRow } | undefined> {
    const [row] = await db
      .select({ orgId: organization.id, slug: organization.slug, ...orgColumns })
      .from(clientTable)
      .innerJoin(organization, eq(organization.id, clientTable.orgId))
      .where(and(eq(clientTable.id, clientId), isNull(clientTable.deletedAt)))
      .limit(1);
    if (!row) return undefined;
    const { orgId, slug, ...org } = row;
    return { orgId, slug, org };
  },

  /**
   * The customer's active agent: the owner of their most recent live, non-test deal
   * inside their own agency, who is not banned. Undefined when there is none.
   */
  async findActiveAgentForClient(clientId: string, orgId: string): Promise<PortalActiveAgentRow | undefined> {
    const [row] = await db
      .select({ firstName: user.firstName, lastName: user.lastName })
      .from(transaction)
      .innerJoin(user, eq(user.id, transaction.user_id))
      .where(and(
        eq(transaction.client_id, clientId),
        eq(transaction.org_id, orgId),
        eq(transaction.is_active, true),
        eq(transaction.is_test, false),
        eq(user.orgId, orgId),
        or(isNull(user.banned), eq(user.banned, false)),
      ))
      .orderBy(desc(transaction.created_at))
      .limit(1);
    return row;
  },
};
