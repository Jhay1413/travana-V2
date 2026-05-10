import { db } from '../../config/database';
import { hrEmployeesTable, hrRemindersTable } from '@shared/schema';
import { and, eq, asc } from 'drizzle-orm';

export const hrRepository = {
  async listEmployees(orgId: string | null) {
    if (!orgId) {
      return db.select().from(hrEmployeesTable).orderBy(asc(hrEmployeesTable.sortOrder), asc(hrEmployeesTable.name));
    }
    return db
      .select()
      .from(hrEmployeesTable)
      .where(eq(hrEmployeesTable.orgId, orgId))
      .orderBy(asc(hrEmployeesTable.sortOrder), asc(hrEmployeesTable.name));
  },

  async getEmployee(id: string, orgId: string | null) {
    const where = orgId
      ? and(eq(hrEmployeesTable.id, id), eq(hrEmployeesTable.orgId, orgId))
      : eq(hrEmployeesTable.id, id);
    const [row] = await db.select().from(hrEmployeesTable).where(where).limit(1);
    return row || undefined;
  },

  async employeeBelongsToOrg(id: string, orgId: string): Promise<boolean> {
    const [row] = await db
      .select({ id: hrEmployeesTable.id })
      .from(hrEmployeesTable)
      .where(and(eq(hrEmployeesTable.id, id), eq(hrEmployeesTable.orgId, orgId)))
      .limit(1);
    return !!row;
  },

  async updateEmployee(id: string, patch: any, orgId: string | null) {
    const where = orgId
      ? and(eq(hrEmployeesTable.id, id), eq(hrEmployeesTable.orgId, orgId))
      : eq(hrEmployeesTable.id, id);
    const [row] = await db.update(hrEmployeesTable).set({ ...patch, updatedAt: new Date() }).where(where).returning();
    return row || undefined;
  },

  async listReminders(orgId: string | null) {
    if (!orgId) {
      return db.select().from(hrRemindersTable).orderBy(asc(hrRemindersTable.sortOrder));
    }
    return db
      .select()
      .from(hrRemindersTable)
      .where(eq(hrRemindersTable.orgId, orgId))
      .orderBy(asc(hrRemindersTable.sortOrder));
  },
};
