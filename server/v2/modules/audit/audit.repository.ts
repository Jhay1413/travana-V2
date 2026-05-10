import { db } from '../../config/database';
import { auditLog, clientTable } from '@shared/schema';
import { desc, eq, sql } from 'drizzle-orm';

export const auditRepository = {
  async create(entry: any) {
    const [row] = await db.insert(auditLog).values(entry).returning();
    return row;
  },

  async findAll(orgId: string | null) {
    if (!orgId) {
      return db.select().from(auditLog).orderBy(desc(auditLog.createdAt));
    }

    // audit_log.client_id is varchar; client_table.id is uuid → explicit cast.
    const rows = await db
      .select({
        id: auditLog.id,
        action: auditLog.action,
        entityType: auditLog.entityType,
        entityId: auditLog.entityId,
        entityTitle: auditLog.entityTitle,
        entityData: auditLog.entityData,
        reason: auditLog.reason,
        performedBy: auditLog.performedBy,
        performedByName: auditLog.performedByName,
        clientId: auditLog.clientId,
        clientName: auditLog.clientName,
        createdAt: auditLog.createdAt,
      })
      .from(auditLog)
      .innerJoin(clientTable, sql`${clientTable.id} = ${auditLog.clientId}::uuid`)
      .where(eq(clientTable.orgId, orgId))
      .orderBy(desc(auditLog.createdAt));
    return rows;
  },
};
