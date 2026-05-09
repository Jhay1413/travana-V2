import { db } from '../../config/database';
import { auditLog } from '@shared/schema';
import { desc } from 'drizzle-orm';

export const auditRepository = {
  async create(entry: any) {
    const [row] = await db.insert(auditLog).values(entry).returning();
    return row;
  },

  async findAll() {
    return db.select().from(auditLog).orderBy(desc(auditLog.createdAt));
  },
};
