import { db } from '../../config/database';
import { adminAuditLog, type AdminAuditLog, type InsertAdminAuditLog } from '@shared/schema';
import { and, desc, eq } from 'drizzle-orm';

export interface AuditFilters {
  actorId?: string;
  orgId?:   string;
  action?:  string;
  limit:    number;
  offset:   number;
}

export const platformAdminAuditRepository = {
  async create(entry: InsertAdminAuditLog): Promise<AdminAuditLog> {
    const [row] = await db.insert(adminAuditLog).values(entry).returning();
    return row;
  },

  async findAll(filters: AuditFilters): Promise<AdminAuditLog[]> {
    const conds = [
      filters.actorId ? eq(adminAuditLog.actorUserId, filters.actorId)   : undefined,
      filters.orgId   ? eq(adminAuditLog.targetOrgId, filters.orgId)     : undefined,
      filters.action  ? eq(adminAuditLog.action,      filters.action)    : undefined,
    ].filter((x): x is NonNullable<typeof x> => x !== undefined);

    const base = db.select().from(adminAuditLog);
    const filtered = conds.length ? base.where(and(...conds)) : base;

    return filtered
      .orderBy(desc(adminAuditLog.createdAt))
      .limit(filters.limit)
      .offset(filters.offset);
  },
};
