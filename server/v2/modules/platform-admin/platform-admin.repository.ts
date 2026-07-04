import { db } from '../../config/database';
import { organization, user, branches } from '@shared/schema';
import { and, asc, desc, eq, ilike, or, sql } from 'drizzle-orm';
import type { OrgSummary, AdminUserRow, AdminBranchRow } from './platform-admin.types';

export interface ListUsersFilters {
  orgId?:  string;
  search?: string;
  limit:   number;
  offset:  number;
}

// Cross-tenant queries — only ever called from inside the platform-admin module.
// New methods MUST be suffixed *AcrossOrgs (reads) or scoped to a single :id (writes).
export const platformAdminRepository = {
  async findAllOrgsWithCounts(search?: string): Promise<OrgSummary[]> {
    const base = db
      .select({
        id:          organization.id,
        name:        organization.name,
        slug:        organization.slug,
        plan:        organization.plan,
        isActive:    organization.isActive,
        seatLimit:   organization.seatLimit,
        createdAt:   organization.createdAt,
        userCount:   sql<number>`(SELECT COUNT(*)::int FROM "user" WHERE "user"."org_id" = "organization"."id")`,
        branchCount: sql<number>`(SELECT COUNT(*)::int FROM "branches" WHERE "branches"."organization_id" = "organization"."id")`,
      })
      .from(organization);

    // When a search term is supplied (e.g. a searchable org picker), filter by
    // name/slug and cap the result set — ordered alphabetically for the picker.
    // No term keeps the original full list (newest first) for the admin table.
    const term = search?.trim();
    if (term) {
      return base
        .where(or(ilike(organization.name, `%${term}%`), ilike(organization.slug, `%${term}%`)))
        .orderBy(asc(organization.name))
        .limit(50);
    }
    return base.orderBy(desc(organization.createdAt));
  },

  async findOrgByIdWithCounts(id: string): Promise<OrgSummary | null> {
    const [row] = await db
      .select({
        id:          organization.id,
        name:        organization.name,
        slug:        organization.slug,
        plan:        organization.plan,
        isActive:    organization.isActive,
        seatLimit:   organization.seatLimit,
        createdAt:   organization.createdAt,
        userCount:   sql<number>`(SELECT COUNT(*)::int FROM "user" WHERE "user"."org_id" = "organization"."id")`,
        branchCount: sql<number>`(SELECT COUNT(*)::int FROM "branches" WHERE "branches"."organization_id" = "organization"."id")`,
      })
      .from(organization)
      .where(eq(organization.id, id))
      .limit(1);
    return row ?? null;
  },

  async setActive(id: string, isActive: boolean): Promise<void> {
    await db.update(organization).set({ isActive }).where(eq(organization.id, id));
  },

  async updatePlan(id: string, plan: string, seatLimit?: number): Promise<void> {
    const patch: { plan: string; seatLimit?: number } = { plan };
    if (seatLimit !== undefined) patch.seatLimit = seatLimit;
    await db.update(organization).set(patch).where(eq(organization.id, id));
  },

  async findAllUsersAcrossOrgs(filters: ListUsersFilters): Promise<AdminUserRow[]> {
    const conds = [
      filters.orgId  ? eq(user.orgId, filters.orgId)                        : undefined,
      filters.search ? or(
                         ilike(user.email,     `%${filters.search}%`),
                         ilike(user.firstName, `%${filters.search}%`),
                         ilike(user.lastName,  `%${filters.search}%`),
                         ilike(user.name,      `%${filters.search}%`),
                       )                                                    : undefined,
    ].filter((x): x is NonNullable<typeof x> => x !== undefined);

    const base = db
      .select({
        id:        user.id,
        name:      user.name,
        email:     user.email,
        firstName: user.firstName,
        lastName:  user.lastName,
        role:      user.role,
        orgRole:   user.orgRole,
        orgId:     user.orgId,
        banned:    user.banned,
        createdAt: user.createdAt,
      })
      .from(user);

    const filtered = conds.length ? base.where(and(...conds)) : base;

    return filtered
      .orderBy(desc(user.createdAt))
      .limit(filters.limit)
      .offset(filters.offset);
  },

  async findUserByIdAcrossOrgs(id: string): Promise<AdminUserRow | null> {
    const [row] = await db
      .select({
        id:        user.id,
        name:      user.name,
        email:     user.email,
        firstName: user.firstName,
        lastName:  user.lastName,
        role:      user.role,
        orgRole:   user.orgRole,
        orgId:     user.orgId,
        banned:    user.banned,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    return row ?? null;
  },

  async findUsersByOrg(orgId: string): Promise<AdminUserRow[]> {
    return db
      .select({
        id:        user.id,
        name:      user.name,
        email:     user.email,
        firstName: user.firstName,
        lastName:  user.lastName,
        role:      user.role,
        orgRole:   user.orgRole,
        orgId:     user.orgId,
        banned:    user.banned,
        createdAt: user.createdAt,
      })
      .from(user)
      .where(eq(user.orgId, orgId))
      .orderBy(asc(user.email));
  },

  async setUserOrgRole(userId: string, orgId: string, orgRole: string): Promise<void> {
    await db
      .update(user)
      .set({ orgRole, updatedAt: new Date() })
      .where(and(eq(user.id, userId), eq(user.orgId, orgId)));
  },

  async setUserBanned(userId: string, orgId: string, banned: boolean, reason?: string): Promise<void> {
    await db
      .update(user)
      .set({
        banned,
        banReason:  banned ? (reason ?? 'Deactivated by platform admin') : null,
        banExpires: null,
        updatedAt:  new Date(),
      })
      .where(and(eq(user.id, userId), eq(user.orgId, orgId)));
  },

  async findBranchesByOrg(orgId: string): Promise<AdminBranchRow[]> {
    return db
      .select({
        id:           branches.id,
        name:         branches.name,
        code:         branches.code,
        isDefault:    branches.isDefault,
        isActive:     branches.isActive,
        branchType:   branches.branchType,
        createdAt:    branches.createdAt,
        memberCount:  sql<number>`(SELECT COUNT(*)::int FROM "branch_members" WHERE "branch_members"."branch_id" = "branches"."id")`,
      })
      .from(branches)
      .where(eq(branches.organizationId, orgId))
      .orderBy(asc(branches.name));
  },
};
