import { db } from '../../config/database';
import { destinationGuruTable } from '@shared/schema';
import { eq, ilike, or, sql } from 'drizzle-orm';

export const destinationGuruRepository = {
  async findAll() {
    return db.select().from(destinationGuruTable).orderBy(destinationGuruTable.destination);
  },

  async findById(id: string) {
    const [row] = await db.select().from(destinationGuruTable).where(eq(destinationGuruTable.id, id)).limit(1);
    return row || undefined;
  },

  async findByDestination(destination: string) {
    const [row] = await db
      .select()
      .from(destinationGuruTable)
      .where(
        or(
          ilike(destinationGuruTable.destination, destination),
          sql`${destination} ILIKE '%' || ${destinationGuruTable.destination} || '%'`,
        ),
      )
      .limit(1);
    return row || undefined;
  },

  async create(data: any) {
    const [row] = await db.insert(destinationGuruTable).values(data).returning();
    return row;
  },

  async remove(id: string) {
    await db.delete(destinationGuruTable).where(eq(destinationGuruTable.id, id));
  },
};
