import { db } from "../config/database";
import { auditLog, type AuditLog, type InsertAuditLog } from "@shared/schema";
import { desc } from "drizzle-orm";

export const auditRepository = {
  async create(entry: InsertAuditLog): Promise<AuditLog> {
    const [result] = await db.insert(auditLog).values(entry).returning();
    return result;
  },

  async findAll(): Promise<AuditLog[]> {
    return await db.select().from(auditLog).orderBy(desc(auditLog.createdAt));
  },
};
