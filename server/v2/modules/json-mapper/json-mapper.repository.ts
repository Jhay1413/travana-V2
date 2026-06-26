import { db } from '../../config/database';
import { country, destination, resorts, accomodation_list, board_basis, tour_operator, airport, room_type, lodges, park } from '@shared/schema';
import { ilike, and, eq } from 'drizzle-orm';

export const jsonMapperRepository = {
  async findCountryByName(name: string) {
    if (!name) return null;
    const [row] = await db.select().from(country).where(ilike(country.country_name, `%${name}%`)).limit(1);
    return row || null;
  },

  async findDestinationByName(name: string, countryId?: string) {
    if (!name) return null;
    const conditions: any[] = [ilike(destination.name, `%${name}%`)];
    if (countryId) conditions.push(eq(destination.country_id, countryId));
    const [row] = await db.select().from(destination).where(and(...conditions)).limit(1);
    return row || null;
  },

  async findResortByName(name: string, destinationId?: string) {
    if (!name) return null;
    const conditions: any[] = [ilike(resorts.name, `%${name}%`)];
    if (destinationId) conditions.push(eq(resorts.destination_id, destinationId));
    const [row] = await db.select().from(resorts).where(and(...conditions)).limit(1);
    return row || null;
  },

  async findAccommodationByName(name: string, resortId?: string) {
    if (!name) return null;
    const conditions: any[] = [ilike(accomodation_list.name, `%${name}%`)];
    if (resortId) conditions.push(eq(accomodation_list.resorts_id, resortId));
    const [row] = await db.select().from(accomodation_list).where(and(...conditions)).limit(1);
    return row || null;
  },

  async getHierarchyFromAccommodation(accommodationId: string) {
    const [row] = await db
      .select({ accommodation: accomodation_list, resort: resorts, destination, country })
      .from(accomodation_list)
      .leftJoin(resorts, eq(accomodation_list.resorts_id, resorts.id))
      .leftJoin(destination, eq(resorts.destination_id, destination.id))
      .leftJoin(country, eq(destination.country_id, country.id))
      .where(eq(accomodation_list.id, accommodationId))
      .limit(1);
    return row || null;
  },

  async findBoardBasisByType(typeName: string) {
    if (!typeName) return null;
    const [row] = await db.select().from(board_basis).where(ilike(board_basis.type, `%${typeName}%`)).limit(1);
    return row || null;
  },

  async findTourOperatorByName(name: string) {
    if (!name) return null;
    const [row] = await db.select().from(tour_operator).where(ilike(tour_operator.name, `%${name}%`)).limit(1);
    return row || null;
  },

  async findAirportByCodeOrName(codeOrName: string) {
    if (!codeOrName) return null;
    const normalized = codeOrName.toUpperCase().trim();
    const [codeRow] = await db.select().from(airport).where(eq(airport.airport_code, normalized)).limit(1);
    if (codeRow) return codeRow;
    const [nameRow] = await db.select().from(airport).where(ilike(airport.airport_name, `%${codeOrName}%`)).limit(1);
    return nameRow || null;
  },

  async findRoomTypeByName(name: string) {
    if (!name) return null;
    const [row] = await db.select().from(room_type).where(ilike(room_type.name, `%${name}%`)).limit(1);
    return row || null;
  },

  async findLodgeByCode(code: string) {
    if (!code) return null;
    const [row] = await db.select().from(lodges).where(ilike(lodges.lodge_code, code.trim())).limit(1);
    return row || null;
  },

  async findLodgeByName(name: string) {
    if (!name) return null;
    const [row] = await db.select().from(lodges).where(ilike(lodges.lodge_name, `%${name.trim()}%`)).limit(1);
    return row || null;
  },

  async findParkByName(name: string) {
    if (!name) return null;
    const [row] = await db.select().from(park).where(ilike(park.name, `%${name.trim()}%`)).limit(1);
    return row || null;
  },

  async findParkByCode(code: string) {
    if (!code) return null;
    const [row] = await db.select().from(park).where(ilike(park.code, code.trim())).limit(1);
    return row || null;
  },

  async createCountry(name: string) {
    const [row] = await db.insert(country).values({ country_name: name }).returning();
    return row;
  },

  async createDestination(name: string, countryId: string) {
    const [row] = await db.insert(destination).values({ name, country_id: countryId }).returning();
    return row;
  },

  async createResort(name: string, destinationId: string) {
    const [row] = await db.insert(resorts).values({ name, destination_id: destinationId }).returning();
    return row;
  },

  async createAccommodation(name: string, resortId: string) {
    const [row] = await db.insert(accomodation_list).values({ name, resorts_id: resortId }).returning();
    return row;
  },

  async createBoardBasis(typeName: string) {
    const [row] = await db.insert(board_basis).values({ type: typeName }).returning();
    return row;
  },

  async createTourOperator(name: string) {
    const [row] = await db.insert(tour_operator).values({ name }).returning();
    return row;
  },

  async createRoomType(name: string) {
    const [row] = await db.insert(room_type).values({ name }).returning();
    return row;
  },

  async createAirport(code: string, name: string, countryId?: string) {
    const [row] = await db.insert(airport).values({ airport_code: code.toUpperCase().trim(), airport_name: name.trim(), ...(countryId ? { country_id: countryId } : {}) }).returning();
    return row;
  },

  async createPark(name: string, code?: string) {
    const [row] = await db.insert(park).values({ name, code: code || null }).returning();
    return row;
  },

  async createLodge(parkId: string, lodgeCode?: string | null, lodgeName?: string | null) {
    const [row] = await db.insert(lodges).values({ park_id: parkId, lodge_code: lodgeCode || null, lodge_name: lodgeName || null }).returning();
    return row;
  },
};
