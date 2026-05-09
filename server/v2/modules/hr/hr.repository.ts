import { db } from '../../config/database';
import { hrEmployeesTable, hrRemindersTable } from '@shared/schema';
import { eq, asc } from 'drizzle-orm';

export const hrRepository = {
  async listEmployees() {
    return db.select().from(hrEmployeesTable).orderBy(asc(hrEmployeesTable.sortOrder), asc(hrEmployeesTable.name));
  },

  async getEmployee(id: string) {
    const [row] = await db.select().from(hrEmployeesTable).where(eq(hrEmployeesTable.id, id)).limit(1);
    return row || undefined;
  },

  async updateEmployee(id: string, patch: any) {
    const [row] = await db.update(hrEmployeesTable).set({ ...patch, updatedAt: new Date() }).where(eq(hrEmployeesTable.id, id)).returning();
    return row || undefined;
  },

  async listReminders() {
    return db.select().from(hrRemindersTable).orderBy(asc(hrRemindersTable.sortOrder));
  },
};
