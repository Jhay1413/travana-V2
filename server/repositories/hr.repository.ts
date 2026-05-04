import { db } from "../config/database";
import { hrEmployeesTable, hrRemindersTable } from "@shared/schema";
import type { HrEmployee, HrReminder, InsertHrEmployee } from "@shared/schema";
import { eq, asc } from "drizzle-orm";

export const hrRepository = {
  async listEmployees(): Promise<HrEmployee[]> {
    return db.select().from(hrEmployeesTable).orderBy(asc(hrEmployeesTable.sortOrder), asc(hrEmployeesTable.name));
  },

  async getEmployee(id: string): Promise<HrEmployee | undefined> {
    const [row] = await db.select().from(hrEmployeesTable).where(eq(hrEmployeesTable.id, id)).limit(1);
    return row;
  },

  async updateEmployee(id: string, patch: Partial<InsertHrEmployee>): Promise<HrEmployee | undefined> {
    const [row] = await db.update(hrEmployeesTable)
      .set({ ...patch, updatedAt: new Date() })
      .where(eq(hrEmployeesTable.id, id))
      .returning();
    return row;
  },

  async listReminders(): Promise<HrReminder[]> {
    return db.select().from(hrRemindersTable).orderBy(asc(hrRemindersTable.sortOrder));
  },
};
