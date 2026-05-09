import { db } from '../../../config/database';
import { accomodation_list, resorts, destination, country, accomodation_type } from '@shared/schema';
import { sql, ilike, or, eq, asc } from 'drizzle-orm';

function parsePagination(query: Record<string, any>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25));
  const search = ((query.search as string) || '').trim();
  const offset = (page - 1) * limit;
  return { page, limit, search, offset };
}

export const accommodationSettingsRepository = {
  async findAll(query: Record<string, any>) {
    const { page, limit, search, offset } = parsePagination(query);
    const where = search
      ? or(ilike(accomodation_list.name, `%${search}%`), ilike(accomodation_list.description, `%${search}%`))
      : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(accomodation_list).where(where);
    const rows = await db
      .select({
        id: accomodation_list.id,
        name: accomodation_list.name,
        description: accomodation_list.description,
        resorts_id: accomodation_list.resorts_id,
        type_id: accomodation_list.type_id,
        resort_name: resorts.name,
        accommodation_type_name: accomodation_type.type,
        destination_name: destination.name,
        country_name: country.country_name,
      })
      .from(accomodation_list)
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .leftJoin(accomodation_type, eq(accomodation_list.type_id, accomodation_type.id))
      .where(where)
      .orderBy(asc(accomodation_list.name))
      .limit(limit)
      .offset(offset);
    return { rows, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  },

  async findById(id: string) {
    const [row] = await db.select().from(accomodation_list).where(eq(accomodation_list.id, id));
    return row || null;
  },

  async create(data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.insert(accomodation_list).values(rest).returning();
    return row;
  },

  async update(id: string, data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.update(accomodation_list).set(rest).where(eq(accomodation_list.id, id)).returning();
    return row || null;
  },

  async remove(id: string) {
    await db.delete(accomodation_list).where(eq(accomodation_list.id, id));
  },
};
