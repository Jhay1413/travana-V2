import { db } from '../../config/database';
import { airport } from '@shared/schema';
import { eq, inArray } from 'drizzle-orm';

export const airportRepository = {
  async findAll(opts?: { countryIds?: string[] }) {
    const query = db.select().from(airport);
    if (opts?.countryIds?.length) {
      return query.where(inArray(airport.country_id, opts.countryIds)).orderBy(airport.airport_name);
    }
    return query.orderBy(airport.airport_name);
  },

  async findById(id: string) {
    const [row] = await db.select().from(airport).where(eq(airport.id, id)).limit(1);
    return row || null;
  },

  async create(data: any) {
    const [row] = await db.insert(airport).values(data).returning();
    return row;
  },

  async remove(id: string) {
    await db.delete(airport).where(eq(airport.id, id));
  },
};
