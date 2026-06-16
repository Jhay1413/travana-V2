import { db } from '../../../config/database';
import { cruise_line, cruise_ship, cruise_itenary, cruise_voyage } from '@shared/schema';
import { sql, ilike, and, or, eq, asc } from 'drizzle-orm';

function parsePagination(query: Record<string, any>) {
  const page = Math.max(1, parseInt(query.page as string) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit as string) || 25));
  const search = ((query.search as string) || '').trim();
  const offset = (page - 1) * limit;
  return { page, limit, search, offset };
}

export const cruiseSettingsRepository = {
  // ─── Cruise Lines ─────────────────────────────────────────────────────────

  async findAllLines(query: Record<string, any>) {
    const { page, limit, search, offset } = parsePagination(query);
    const where = search ? ilike(cruise_line.name, `%${search}%`) : undefined;
    const [{ count }] = await db.select({ count: sql<number>`count(*)` }).from(cruise_line).where(where);
    const rows = await db.select().from(cruise_line).where(where).orderBy(asc(cruise_line.name)).limit(limit).offset(offset);
    return { rows, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  },

  async findLineById(id: string) {
    const [row] = await db.select().from(cruise_line).where(eq(cruise_line.id, id));
    return row || null;
  },

  async createLine(data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.insert(cruise_line).values(rest).returning();
    return row;
  },

  async updateLine(id: string, data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.update(cruise_line).set(rest).where(eq(cruise_line.id, id)).returning();
    return row || null;
  },

  async removeLine(id: string) {
    await db.delete(cruise_line).where(eq(cruise_line.id, id));
  },

  // ─── Cruise Ships ─────────────────────────────────────────────────────────

  async findAllShips(query: Record<string, any>) {
    const { page, limit, search, offset } = parsePagination(query);
    const where = search
      ? or(ilike(cruise_ship.name, `%${search}%`), ilike(cruise_line.name, `%${search}%`))
      : undefined;
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(cruise_ship)
      .leftJoin(cruise_line, eq(cruise_ship.cruise_line_id, cruise_line.id))
      .where(where);
    const rows = await db
      .select({
        id: cruise_ship.id,
        name: cruise_ship.name,
        cruise_line_id: cruise_ship.cruise_line_id,
        cruise_line_name: cruise_line.name,
      })
      .from(cruise_ship)
      .leftJoin(cruise_line, eq(cruise_ship.cruise_line_id, cruise_line.id))
      .where(where)
      .orderBy(asc(cruise_ship.name))
      .limit(limit)
      .offset(offset);
    return { rows, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  },

  async findShipById(id: string) {
    const [row] = await db.select().from(cruise_ship).where(eq(cruise_ship.id, id));
    return row || null;
  },

  async createShip(data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.insert(cruise_ship).values(rest).returning();
    return row;
  },

  async updateShip(id: string, data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.update(cruise_ship).set(rest).where(eq(cruise_ship.id, id)).returning();
    return row || null;
  },

  async removeShip(id: string) {
    await db.delete(cruise_ship).where(eq(cruise_ship.id, id));
  },

  // ─── Cruise Itineraries ──────────────────────────────────────────────────

  async findAllItineraries(query: Record<string, any>) {
    const { page, limit, search, offset } = parsePagination(query);
    const where = search
      ? or(ilike(cruise_itenary.itenary, `%${search}%`), ilike(cruise_itenary.departure_port, `%${search}%`))
      : undefined;
    const [{ count }] = await db
      .select({ count: sql<number>`count(*)` })
      .from(cruise_itenary)
      .leftJoin(cruise_ship, eq(cruise_itenary.ship_id, cruise_ship.id))
      .where(where);
    const rows = await db
      .select({
        id: cruise_itenary.id,
        itenary: cruise_itenary.itenary,
        departure_port: cruise_itenary.departure_port,
        date: cruise_itenary.date,
        ship_id: cruise_itenary.ship_id,
        ship_name: cruise_ship.name,
      })
      .from(cruise_itenary)
      .leftJoin(cruise_ship, eq(cruise_itenary.ship_id, cruise_ship.id))
      .where(where)
      .orderBy(asc(cruise_itenary.date))
      .limit(limit)
      .offset(offset);
    return { rows, total: Number(count), page, limit, totalPages: Math.ceil(Number(count) / limit) };
  },

  async findItineraryById(id: string) {
    const [row] = await db.select().from(cruise_itenary).where(eq(cruise_itenary.id, id));
    return row || null;
  },

  async createItinerary(data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.insert(cruise_itenary).values(rest).returning();
    return row;
  },

  async updateItinerary(id: string, data: any) {
    const { id: _id, ...rest } = data;
    const [row] = await db.update(cruise_itenary).set(rest).where(eq(cruise_itenary.id, id)).returning();
    return row || null;
  },

  async removeItinerary(id: string) {
    await db.delete(cruise_itenary).where(eq(cruise_itenary.id, id));
  },

  // ─── Find-or-create helpers (exact, case-insensitive) ─────────────────────
  // Used by the JSON importer to resolve cruise text values to catalog rows,
  // creating them when they don't already exist. `ilike` with no wildcards is
  // an exact match that ignores case.

  async findLineByName(name: string) {
    if (!name?.trim()) return null;
    const [row] = await db.select().from(cruise_line).where(ilike(cruise_line.name, name.trim())).limit(1);
    return row || null;
  },

  async findShipByName(name: string, cruiseLineId: string) {
    if (!name?.trim() || !cruiseLineId) return null;
    const [row] = await db
      .select()
      .from(cruise_ship)
      .where(and(ilike(cruise_ship.name, name.trim()), eq(cruise_ship.cruise_line_id, cruiseLineId)))
      .limit(1);
    return row || null;
  },

  async findItineraryByShipAndDate(shipId: string, date: string) {
    if (!shipId || !date) return null;
    const [row] = await db
      .select()
      .from(cruise_itenary)
      .where(and(eq(cruise_itenary.ship_id, shipId), eq(cruise_itenary.date, date)))
      .limit(1);
    return row || null;
  },

  async findVoyageByDay(itineraryId: string, dayNumber: number) {
    if (!itineraryId) return null;
    const [row] = await db
      .select()
      .from(cruise_voyage)
      .where(and(eq(cruise_voyage.itinerary_id, itineraryId), eq(cruise_voyage.day_number, String(dayNumber))))
      .limit(1);
    return row || null;
  },

  async createVoyage(itineraryId: string, dayNumber: number, description: string, subDescription = '') {
    const [row] = await db
      .insert(cruise_voyage)
      .values({ itinerary_id: itineraryId, day_number: String(dayNumber), description, sub_description: subDescription || null })
      .returning();
    return row;
  },
};
